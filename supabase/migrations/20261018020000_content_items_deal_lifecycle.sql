-- Migration: Typed projections and lifecycle management for content_items deals
-- Architecture validated by Notion AI (Sy06) - Ref: 6211733343554f86a6f0965d2702ebcc
-- Security: service_role only; zero public/anon mutation rights.

-- 1. Add typed projection columns to content_items
ALTER TABLE public.content_items
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS offer_state TEXT NOT NULL DEFAULT 'active'
    CHECK (offer_state IN ('active', 'expired', 'withdrawn', 'archived')),
  ADD COLUMN IF NOT EXISTS source_fresh_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- 2. Partial static index for active deals queries
-- Avoids dynamic now() inside index predicates; query planner uses static boundary filters
CREATE INDEX IF NOT EXISTS content_items_deals_active_idx
  ON public.content_items (expires_at, source_fresh_until)
  WHERE kind = 'deals' AND offer_state = 'active';

-- 3. Atomic upsert RPC supporting typed deal projections and re-observation freshness
CREATE OR REPLACE FUNCTION public.upsert_content_item(
  p_kind TEXT,
  p_external_id TEXT,
  p_published_at TIMESTAMPTZ,
  p_payload JSONB,
  p_expires_at TIMESTAMPTZ DEFAULT NULL,
  p_offer_state TEXT DEFAULT 'active',
  p_source_fresh_until TIMESTAMPTZ DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF p_kind NOT IN ('releases', 'deals', 'news') THEN
    RAISE EXCEPTION 'invalid_kind: %', p_kind;
  END IF;

  IF p_external_id IS NULL OR trim(p_external_id) = '' THEN
    RAISE EXCEPTION 'invalid_external_id: must not be null or blank';
  END IF;

  IF p_offer_state NOT IN ('active', 'expired', 'withdrawn', 'archived') THEN
    RAISE EXCEPTION 'invalid_offer_state: %', p_offer_state;
  END IF;

  INSERT INTO public.content_items (
    kind,
    external_id,
    published_at,
    payload,
    expires_at,
    offer_state,
    source_fresh_until,
    last_seen_at
  )
  VALUES (
    p_kind,
    trim(p_external_id),
    p_published_at,
    p_payload,
    p_expires_at,
    p_offer_state,
    p_source_fresh_until,
    now()
  )
  ON CONFLICT (kind, external_id) WHERE external_id IS NOT NULL
  DO UPDATE SET
    published_at = EXCLUDED.published_at,
    payload = EXCLUDED.payload,
    expires_at = EXCLUDED.expires_at,
    offer_state = EXCLUDED.offer_state,
    source_fresh_until = EXCLUDED.source_fresh_until,
    last_seen_at = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- 4. Periodic maintenance RPC: Purge hard-expired deals past operational retention window (default 7 days)
CREATE OR REPLACE FUNCTION public.purge_expired_deals(
  p_retention_interval INTERVAL DEFAULT INTERVAL '7 days'
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  DELETE FROM public.content_items
  WHERE kind = 'deals'
    AND expires_at IS NOT NULL
    AND expires_at < (now() - p_retention_interval)
    AND offer_state IN ('expired', 'withdrawn', 'active');

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN v_deleted_count;
END;
$$;

-- 5. Hardened Permissions: strictly service_role only
REVOKE ALL ON FUNCTION public.upsert_content_item(TEXT, TEXT, TIMESTAMPTZ, JSONB, TIMESTAMPTZ, TEXT, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_content_item(TEXT, TEXT, TIMESTAMPTZ, JSONB, TIMESTAMPTZ, TEXT, TIMESTAMPTZ) TO service_role;

REVOKE ALL ON FUNCTION public.purge_expired_deals(INTERVAL) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_expired_deals(INTERVAL) TO service_role;
