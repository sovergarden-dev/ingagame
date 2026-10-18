-- Migration: 20261018050000_ingestion_config_and_hardening.sql
-- Description: Ingestion configuration table (kill-switch, per-action cooldown),
--              hardened claim RPC with typed outcome reasons and abandoned run reclamation,
--              and telemetry health view per Notion Sy06 review.

-- 1. Configuration table for runtime kill-switch and cooldown
CREATE TABLE IF NOT EXISTS public.ingestion_config (
  action TEXT NOT NULL PRIMARY KEY,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  cooldown_seconds INTEGER NOT NULL DEFAULT 60,
  next_allowed_at TIMESTAMPTZ,
  paused_reason TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ingestion_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ingestion_config FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.ingestion_config TO service_role;

-- Seed default configuration for known actions
INSERT INTO public.ingestion_config (action, is_enabled, cooldown_seconds, paused_reason)
VALUES
  ('sync_steam_releases', TRUE, 120, NULL),
  ('sync_steam_deals', TRUE, 60, NULL),
  ('sync_steam_news', TRUE, 60, NULL)
ON CONFLICT (action) DO NOTHING;

-- 2. Drop legacy claim RPC to update return signature to (claimed, run_id, reason)
DROP FUNCTION IF EXISTS public.claim_ingestion_run(TEXT, TEXT, INTEGER);

CREATE OR REPLACE FUNCTION public.claim_ingestion_run(
  p_action TEXT,
  p_trigger TEXT DEFAULT 'manual',
  p_lease_seconds INTEGER DEFAULT 300
) RETURNS TABLE (
  claimed BOOLEAN,
  run_id UUID,
  reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := clock_timestamp();
  v_config_enabled BOOLEAN := TRUE;
  v_cooldown_seconds INTEGER := 0;
  v_next_allowed TIMESTAMPTZ;
  v_lease_expiry TIMESTAMPTZ;
  v_current_run_id UUID;
  v_new_run_id UUID;
  v_bounded_lease INTEGER := LEAST(GREATEST(p_lease_seconds, 30), 3600);
BEGIN
  -- 2.1 Ensure config row exists
  INSERT INTO public.ingestion_config (action)
  VALUES (p_action)
  ON CONFLICT (action) DO NOTHING;

  -- 2.2 Check kill-switch and cooldown policy with row-level lock
  SELECT is_enabled, cooldown_seconds, next_allowed_at
  INTO v_config_enabled, v_cooldown_seconds, v_next_allowed
  FROM public.ingestion_config
  WHERE action = p_action
  FOR UPDATE;

  IF NOT v_config_enabled THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, 'action_disabled'::TEXT;
    RETURN;
  END IF;

  IF v_next_allowed IS NOT NULL AND v_next_allowed > v_now THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, 'cooldown_active'::TEXT;
    RETURN;
  END IF;

  -- 2.3 Ensure lease row exists
  INSERT INTO public.ingestion_leases (action, lease_expires_at)
  VALUES (p_action, v_now - INTERVAL '1 second')
  ON CONFLICT (action) DO NOTHING;

  -- 2.4 Lock lease row
  SELECT lease_expires_at, active_run_id
  INTO v_lease_expiry, v_current_run_id
  FROM public.ingestion_leases
  WHERE action = p_action
  FOR UPDATE;

  -- Refresh v_now after acquiring lock
  v_now := clock_timestamp();

  IF v_lease_expiry > v_now THEN
    -- Active lease is held by another worker
    RETURN QUERY SELECT FALSE, NULL::UUID, 'lease_held'::TEXT;
    RETURN;
  END IF;

  -- 2.5 Lazy reclaim of abandoned run if previous lease expired while running
  IF v_current_run_id IS NOT NULL THEN
    UPDATE public.ingestion_runs
    SET status = 'failed',
        error_message = 'lease_expired_reclaimed',
        finished_at = v_now
    WHERE id = v_current_run_id AND status = 'running';
  END IF;

  -- 2.6 Record new run
  INSERT INTO public.ingestion_runs (action, trigger, status, started_at)
  VALUES (p_action, p_trigger, 'running', v_now)
  RETURNING id INTO v_new_run_id;

  -- 2.7 Update lease and next allowed cooldown timestamp
  UPDATE public.ingestion_leases
  SET active_run_id = v_new_run_id,
      lease_expires_at = v_now + make_interval(secs => v_bounded_lease),
      updated_at = v_now
  WHERE action = p_action;

  UPDATE public.ingestion_config
  SET next_allowed_at = v_now + make_interval(secs => v_cooldown_seconds),
      updated_at = v_now
  WHERE action = p_action;

  RETURN QUERY SELECT TRUE, v_new_run_id, 'ok'::TEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_ingestion_run(TEXT, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_ingestion_run(TEXT, TEXT, INTEGER) TO service_role;

-- 3. Hardened owner-safe finalize RPC
CREATE OR REPLACE FUNCTION public.finalize_ingestion_run(
  p_run_id UUID,
  p_status TEXT,
  p_synced INTEGER DEFAULT 0,
  p_dropped INTEGER DEFAULT 0,
  p_total INTEGER DEFAULT 0,
  p_error TEXT DEFAULT NULL
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action TEXT;
  v_updated INTEGER := 0;
BEGIN
  -- Terminal-safe update: only finalize if run is currently 'running'
  UPDATE public.ingestion_runs
  SET status = p_status,
      synced_count = p_synced,
      dropped_count = p_dropped,
      total_count = p_total,
      error_message = p_error,
      finished_at = clock_timestamp()
  WHERE id = p_run_id AND status = 'running'
  RETURNING action INTO v_action;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated > 0 AND v_action IS NOT NULL THEN
    -- Owner-safe release: only clear lease if this run still owns it
    UPDATE public.ingestion_leases
    SET lease_expires_at = clock_timestamp(),
        updated_at = clock_timestamp()
    WHERE action = v_action AND active_run_id = p_run_id;
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_ingestion_run(UUID, TEXT, INTEGER, INTEGER, INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_ingestion_run(UUID, TEXT, INTEGER, INTEGER, INTEGER, TEXT) TO service_role;

-- 4. Telemetry health view for operational monitoring
CREATE OR REPLACE VIEW public.v_ingestion_health AS
SELECT
  c.action,
  c.is_enabled,
  c.cooldown_seconds,
  c.paused_reason,
  c.next_allowed_at,
  l.lease_expires_at,
  (l.lease_expires_at > clock_timestamp()) AS is_lease_held,
  l.active_run_id,
  r.status AS last_run_status,
  r.started_at AS last_run_started_at,
  r.finished_at AS last_run_finished_at,
  CASE
    WHEN r.finished_at IS NOT NULL AND r.started_at IS NOT NULL
    THEN GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (r.finished_at - r.started_at)) * 1000)::INTEGER)
    ELSE NULL
  END AS last_run_duration_ms,
  r.synced_count AS last_items_synced,
  r.dropped_count AS last_items_dropped,
  r.total_count AS last_items_total,
  r.error_message AS last_error_message
FROM public.ingestion_config c
LEFT JOIN public.ingestion_leases l ON l.action = c.action
LEFT JOIN LATERAL (
  SELECT *
  FROM public.ingestion_runs ir
  WHERE ir.action = c.action
  ORDER BY ir.started_at DESC
  LIMIT 1
) r ON TRUE;

REVOKE ALL ON public.v_ingestion_health FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.v_ingestion_health TO service_role;
