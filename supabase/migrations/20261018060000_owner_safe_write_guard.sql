-- Migration: 20261018060000_owner_safe_write_guard.sql
-- Description: Enforce owner-safe write path on upsert_content_item by verifying
--              the active run lease and action-kind mapping per Notion Sy06 architecture review.

-- 1. Drop 11-argument legacy RPC to prevent un-fenced backdoor writes
DROP FUNCTION IF EXISTS public.upsert_content_item(
  TEXT,
  TEXT,
  TIMESTAMPTZ,
  JSONB,
  TIMESTAMPTZ,
  TEXT,
  TIMESTAMPTZ,
  TEXT,
  TIMESTAMPTZ,
  TIMESTAMPTZ,
  TEXT
);

-- 2. Create hardened 12-argument RPC requiring active p_run_id
CREATE OR REPLACE FUNCTION public.upsert_content_item(
  p_run_id UUID,
  p_kind TEXT,
  p_external_id TEXT,
  p_published_at TIMESTAMPTZ,
  p_payload JSONB,
  p_expires_at TIMESTAMPTZ DEFAULT NULL,
  p_offer_state TEXT DEFAULT 'active',
  p_source_fresh_until TIMESTAMPTZ DEFAULT NULL,
  p_offer_type TEXT DEFAULT 'discount',
  p_claim_ends_at TIMESTAMPTZ DEFAULT NULL,
  p_access_ends_at TIMESTAMPTZ DEFAULT NULL,
  p_classification_status TEXT DEFAULT 'unverified'
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_action TEXT;
  v_lease_expiry TIMESTAMPTZ;
  v_now TIMESTAMPTZ := clock_timestamp();
BEGIN
  -- 2.1 Validate run_id existence
  IF p_run_id IS NULL THEN
    RAISE EXCEPTION 'lease_required: write requires active run_id' USING ERRCODE = '55000';
  END IF;

  -- 2.2 Validate input arguments
  IF p_kind NOT IN ('releases', 'deals', 'news') THEN
    RAISE EXCEPTION 'invalid_kind: %', p_kind;
  END IF;

  IF p_external_id IS NULL OR trim(p_external_id) = '' THEN
    RAISE EXCEPTION 'invalid_external_id: must not be null or blank';
  END IF;

  IF p_offer_state NOT IN ('active', 'expired', 'withdrawn', 'archived') THEN
    RAISE EXCEPTION 'invalid_offer_state: %', p_offer_state;
  END IF;

  IF p_offer_type NOT IN ('free_to_keep', 'free_weekend', 'trial', 'permanently_free', 'discount', 'unknown') THEN
    RAISE EXCEPTION 'invalid_offer_type: %', p_offer_type;
  END IF;

  IF p_classification_status NOT IN ('unverified', 'verified', 'flagged') THEN
    RAISE EXCEPTION 'invalid_classification_status: %', p_classification_status;
  END IF;

  -- 2.3 Verify run is in running state
  SELECT action INTO v_action
  FROM public.ingestion_runs
  WHERE id = p_run_id AND status = 'running';

  IF v_action IS NULL THEN
    RAISE EXCEPTION 'lease_not_running: run % is not active or does not exist', p_run_id USING ERRCODE = '55000';
  END IF;

  -- 2.4 Verify action ↔ kind mapping
  IF v_action = 'sync_steam_releases' AND p_kind <> 'releases' THEN
    RAISE EXCEPTION 'action_kind_mismatch: action % cannot write kind %', v_action, p_kind USING ERRCODE = '55000';
  ELSIF v_action = 'sync_steam_deals' AND p_kind <> 'deals' THEN
    RAISE EXCEPTION 'action_kind_mismatch: action % cannot write kind %', v_action, p_kind USING ERRCODE = '55000';
  ELSIF v_action = 'sync_steam_news' AND p_kind <> 'news' THEN
    RAISE EXCEPTION 'action_kind_mismatch: action % cannot write kind %', v_action, p_kind USING ERRCODE = '55000';
  ELSIF v_action NOT IN ('sync_steam_releases', 'sync_steam_deals', 'sync_steam_news', 'ingest_batch') THEN
    RAISE EXCEPTION 'unrecognized_action: %', v_action USING ERRCODE = '55000';
  END IF;

  -- 2.5 Lock lease row FOR UPDATE to prevent TOCTOU race with concurrent reclaim
  SELECT lease_expires_at INTO v_lease_expiry
  FROM public.ingestion_leases
  WHERE action = v_action AND active_run_id = p_run_id
  FOR UPDATE;

  IF v_lease_expiry IS NULL THEN
    RAISE EXCEPTION 'lease_not_owner: run % does not hold active lease for %', p_run_id, v_action USING ERRCODE = '55000';
  END IF;

  IF v_lease_expiry <= v_now THEN
    RAISE EXCEPTION 'lease_expired: lease for run % expired at %', p_run_id, v_lease_expiry USING ERRCODE = '55000';
  END IF;

  -- 2.6 Atomic upsert into content_items
  INSERT INTO public.content_items (
    kind,
    external_id,
    published_at,
    payload,
    expires_at,
    offer_state,
    source_fresh_until,
    last_seen_at,
    offer_type,
    claim_ends_at,
    access_ends_at,
    classification_status
  )
  VALUES (
    p_kind,
    trim(p_external_id),
    p_published_at,
    p_payload,
    p_expires_at,
    p_offer_state,
    p_source_fresh_until,
    v_now,
    p_offer_type,
    p_claim_ends_at,
    p_access_ends_at,
    p_classification_status
  )
  ON CONFLICT (kind, external_id) WHERE external_id IS NOT NULL
  DO UPDATE SET
    published_at = EXCLUDED.published_at,
    payload = EXCLUDED.payload,
    expires_at = EXCLUDED.expires_at,
    offer_state = EXCLUDED.offer_state,
    source_fresh_until = EXCLUDED.source_fresh_until,
    last_seen_at = v_now,
    offer_type = EXCLUDED.offer_type,
    claim_ends_at = EXCLUDED.claim_ends_at,
    access_ends_at = EXCLUDED.access_ends_at,
    classification_status = EXCLUDED.classification_status
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- 3. Restrict execution strictly to service_role
REVOKE ALL ON FUNCTION public.upsert_content_item(
  UUID,
  TEXT,
  TEXT,
  TIMESTAMPTZ,
  JSONB,
  TIMESTAMPTZ,
  TEXT,
  TIMESTAMPTZ,
  TEXT,
  TIMESTAMPTZ,
  TIMESTAMPTZ,
  TEXT
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.upsert_content_item(
  UUID,
  TEXT,
  TEXT,
  TIMESTAMPTZ,
  JSONB,
  TIMESTAMPTZ,
  TEXT,
  TIMESTAMPTZ,
  TEXT,
  TIMESTAMPTZ,
  TIMESTAMPTZ,
  TEXT
) TO service_role;
