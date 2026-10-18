-- Migration: Ingestion run telemetry audit and atomic concurrency leases
-- Approved under Notion Sy06 architecture review
-- Prevents overlapping concurrent ingestion runs, ensures fencing tokens, and provides audit trails.

-- 1. Ingestion audit log table
CREATE TABLE IF NOT EXISTS public.ingestion_runs (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  trigger TEXT NOT NULL DEFAULT 'manual',
  scope TEXT DEFAULT 'steam',
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'timeout')),
  synced_count INTEGER NOT NULL DEFAULT 0,
  dropped_count INTEGER NOT NULL DEFAULT 0,
  total_count INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ DEFAULT NULL,
  error_message TEXT DEFAULT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS ingestion_runs_action_started_idx
  ON public.ingestion_runs (action, started_at DESC);

ALTER TABLE public.ingestion_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ingestion_runs FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.ingestion_runs TO service_role;

-- 2. Concurrency lease table
CREATE TABLE IF NOT EXISTS public.ingestion_leases (
  action TEXT NOT NULL PRIMARY KEY,
  active_run_id UUID REFERENCES public.ingestion_runs(id) ON DELETE SET NULL,
  lease_expires_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ingestion_leases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ingestion_leases FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.ingestion_leases TO service_role;

-- 3. Atomic lease claim RPC
CREATE OR REPLACE FUNCTION public.claim_ingestion_run(
  p_action TEXT,
  p_trigger TEXT DEFAULT 'manual',
  p_lease_seconds INTEGER DEFAULT 300
) RETURNS TABLE (
  claimed BOOLEAN,
  run_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := now();
  v_lease_expiry TIMESTAMPTZ;
  v_new_run_id UUID;
BEGIN
  -- Insert dummy lease row if not exists
  INSERT INTO public.ingestion_leases (action, lease_expires_at)
  VALUES (p_action, v_now - INTERVAL '1 second')
  ON CONFLICT (action) DO NOTHING;

  -- Lock lease row
  SELECT lease_expires_at INTO v_lease_expiry
  FROM public.ingestion_leases
  WHERE action = p_action
  FOR UPDATE;

  IF v_lease_expiry > v_now THEN
    -- Active lease held
    RETURN QUERY SELECT FALSE, NULL::UUID;
    RETURN;
  END IF;

  -- Create run record
  INSERT INTO public.ingestion_runs (action, trigger, status, started_at)
  VALUES (p_action, p_trigger, 'running', v_now)
  RETURNING id INTO v_new_run_id;

  -- Update lease
  UPDATE public.ingestion_leases
  SET active_run_id = v_new_run_id,
      lease_expires_at = v_now + make_interval(secs => p_lease_seconds),
      updated_at = v_now
  WHERE action = p_action;

  RETURN QUERY SELECT TRUE, v_new_run_id;
END;
$$;

-- 4. Atomic lease finalization RPC
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
BEGIN
  UPDATE public.ingestion_runs
  SET status = p_status,
      synced_count = p_synced,
      dropped_count = p_dropped,
      total_count = p_total,
      error_message = p_error,
      finished_at = now()
  WHERE id = p_run_id
  RETURNING action INTO v_action;

  IF v_action IS NOT NULL THEN
    UPDATE public.ingestion_leases
    SET lease_expires_at = now(),
        updated_at = now()
    WHERE action = v_action AND active_run_id = p_run_id;
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

-- 5. Hardened Permissions: strictly service_role only
REVOKE ALL ON FUNCTION public.claim_ingestion_run(TEXT, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_ingestion_run(TEXT, TEXT, INTEGER) TO service_role;

REVOKE ALL ON FUNCTION public.finalize_ingestion_run(UUID, TEXT, INTEGER, INTEGER, INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_ingestion_run(UUID, TEXT, INTEGER, INTEGER, INTEGER, TEXT) TO service_role;
