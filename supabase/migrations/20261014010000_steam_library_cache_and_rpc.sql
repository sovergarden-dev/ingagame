-- Steam Library Cache and Atomic Sync RPCs
-- Approved under Notion Sy06 architecture review
-- Enforces row serialization, lease attempt tokens, 15m cooldown, and revision verification.

ALTER TABLE public.steam_links
  ADD COLUMN IF NOT EXISTS link_revision UUID NOT NULL DEFAULT gen_random_uuid();

CREATE TABLE IF NOT EXISTS public.steam_library_cache (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  steam_id TEXT NOT NULL,
  link_revision UUID NOT NULL,
  owned_app_ids BIGINT[] DEFAULT NULL,
  synced_at TIMESTAMPTZ DEFAULT NULL,
  sync_status TEXT NOT NULL DEFAULT 'idle' CHECK (sync_status IN ('idle', 'synced', 'unavailable', 'failed')),
  game_count INTEGER DEFAULT NULL,
  last_attempt_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  next_sync_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  active_attempt_id UUID DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now()
);

ALTER TABLE public.steam_library_cache ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.steam_library_cache FROM PUBLIC, anon, authenticated;
GRANT SELECT, DELETE ON public.steam_library_cache TO authenticated;
GRANT ALL ON TABLE public.steam_library_cache TO service_role;

CREATE POLICY "steam_library_cache_select_own"
  ON public.steam_library_cache
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "steam_library_cache_delete_own"
  ON public.steam_library_cache
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Atomic Claim RPC
CREATE OR REPLACE FUNCTION public.claim_steam_sync(
  p_user_id UUID,
  p_min_interval INTERVAL DEFAULT INTERVAL '15 minutes'
) RETURNS TABLE (
  claimed BOOLEAN,
  attempt_id UUID,
  steam_id TEXT,
  link_revision UUID,
  current_status TEXT,
  owned_app_ids BIGINT[],
  synced_at TIMESTAMPTZ,
  retry_after_seconds INTEGER
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_link_steam_id TEXT;
  v_link_revision UUID;
  v_cache RECORD;
  v_now TIMESTAMPTZ := pg_catalog.now();
  v_new_attempt_id UUID;
  v_retry_sec INTEGER := 0;
BEGIN
  -- 1. Serialize on steam_links row
  SELECT sl.steam_id, sl.link_revision
    INTO v_link_steam_id, v_link_revision
    FROM public.steam_links sl
   WHERE sl.user_id = p_user_id
     FOR UPDATE;

  IF NOT FOUND THEN
    -- No steam link exists for this user
    RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT, NULL::UUID, 'unlinked'::TEXT, NULL::BIGINT[], NULL::TIMESTAMPTZ, 0;
    RETURN;
  END IF;

  -- 2. Inspect existing cache
  SELECT sc.*
    INTO v_cache
    FROM public.steam_library_cache sc
   WHERE sc.user_id = p_user_id
     FOR UPDATE;

  -- Invalidate cache if link revision or steam_id changed
  IF FOUND AND (v_cache.steam_id <> v_link_steam_id OR v_cache.link_revision <> v_link_revision) THEN
    DELETE FROM public.steam_library_cache WHERE user_id = p_user_id;
    v_cache := NULL;
  END IF;

  -- 3. Check cooldown
  IF v_cache IS NOT NULL AND v_now < v_cache.next_sync_at THEN
    v_retry_sec := GREATEST(1, EXTRACT(EPOCH FROM (v_cache.next_sync_at - v_now))::INTEGER);
    RETURN QUERY SELECT
      false,
      NULL::UUID,
      v_link_steam_id,
      v_link_revision,
      v_cache.sync_status,
      v_cache.owned_app_ids,
      v_cache.synced_at,
      v_retry_sec;
    RETURN;
  END IF;

  -- 4. Claim lease
  v_new_attempt_id := extensions.gen_random_uuid();

  INSERT INTO public.steam_library_cache (
    user_id,
    steam_id,
    link_revision,
    owned_app_ids,
    synced_at,
    sync_status,
    game_count,
    last_attempt_at,
    next_sync_at,
    active_attempt_id,
    updated_at
  ) VALUES (
    p_user_id,
    v_link_steam_id,
    v_link_revision,
    COALESCE(v_cache.owned_app_ids, NULL),
    COALESCE(v_cache.synced_at, NULL),
    COALESCE(v_cache.sync_status, 'idle'),
    COALESCE(v_cache.game_count, NULL),
    v_now,
    v_now + p_min_interval,
    v_new_attempt_id,
    v_now
  )
  ON CONFLICT (user_id) DO UPDATE SET
    steam_id = v_link_steam_id,
    link_revision = v_link_revision,
    last_attempt_at = v_now,
    next_sync_at = v_now + p_min_interval,
    active_attempt_id = v_new_attempt_id,
    updated_at = v_now;

  RETURN QUERY SELECT
    true,
    v_new_attempt_id,
    v_link_steam_id,
    v_link_revision,
    COALESCE(v_cache.sync_status, 'idle'),
    COALESCE(v_cache.owned_app_ids, NULL),
    COALESCE(v_cache.synced_at, NULL),
    0;
END;
$$;

-- Atomic Finalize RPC
CREATE OR REPLACE FUNCTION public.finalize_steam_sync(
  p_user_id UUID,
  p_steam_id TEXT,
  p_link_revision UUID,
  p_attempt_id UUID,
  p_sync_status TEXT,
  p_owned_app_ids BIGINT[],
  p_game_count INTEGER
) RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_link_steam_id TEXT;
  v_link_revision UUID;
  v_now TIMESTAMPTZ := pg_catalog.now();
  v_updated INTEGER := 0;
BEGIN
  -- 1. Validate current link still matches
  SELECT sl.steam_id, sl.link_revision
    INTO v_link_steam_id, v_link_revision
    FROM public.steam_links sl
   WHERE sl.user_id = p_user_id
     FOR UPDATE;

  IF NOT FOUND OR v_link_steam_id <> p_steam_id OR v_link_revision <> p_link_revision THEN
    -- Link changed or was deleted; abort write safely
    RETURN false;
  END IF;

  -- 2. Update cache if attempt matches
  IF p_sync_status = 'synced' THEN
    UPDATE public.steam_library_cache
       SET owned_app_ids = p_owned_app_ids,
           game_count = p_game_count,
           synced_at = v_now,
           sync_status = 'synced',
           active_attempt_id = NULL,
           updated_at = v_now
     WHERE user_id = p_user_id
       AND steam_id = p_steam_id
       AND link_revision = p_link_revision
       AND active_attempt_id = p_attempt_id;
  ELSE
    -- Preserve existing owned_app_ids and synced_at on error/unavailable
    UPDATE public.steam_library_cache
       SET sync_status = p_sync_status,
           active_attempt_id = NULL,
           updated_at = v_now
     WHERE user_id = p_user_id
       AND steam_id = p_steam_id
       AND link_revision = p_link_revision
       AND active_attempt_id = p_attempt_id;
  END IF;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

-- Least privilege on RPCs
REVOKE ALL ON FUNCTION public.claim_steam_sync(UUID, INTERVAL) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_steam_sync(UUID, INTERVAL) TO service_role;

REVOKE ALL ON FUNCTION public.finalize_steam_sync(UUID, TEXT, UUID, UUID, TEXT, BIGINT[], INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_steam_sync(UUID, TEXT, UUID, UUID, TEXT, BIGINT[], INTEGER) TO service_role;
