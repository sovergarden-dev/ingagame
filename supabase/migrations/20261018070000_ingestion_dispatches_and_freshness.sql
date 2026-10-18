-- Migration: 20261018070000_ingestion_dispatches_and_freshness.sql
-- Description: Ingestion dispatch ledger and data freshness telemetry view
--              for operational monitoring and watchdog alerting per Notion Sy06 review.

-- 1. Dispatch ledger table
CREATE TABLE IF NOT EXISTS public.ingestion_dispatches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  attempt INTEGER NOT NULL DEFAULT 1,
  pg_net_request_id BIGINT,
  enqueued_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  response_at TIMESTAMPTZ,
  http_status INTEGER,
  transport_error TEXT,
  run_id UUID REFERENCES public.ingestion_runs(id) ON DELETE SET NULL,
  execution_outcome TEXT,
  CONSTRAINT uq_ingestion_dispatches_action_slot UNIQUE (action, scheduled_for, attempt)
);

CREATE INDEX IF NOT EXISTS idx_ingestion_dispatches_action_enqueued
  ON public.ingestion_dispatches (action, enqueued_at DESC);

CREATE INDEX IF NOT EXISTS idx_ingestion_dispatches_run_id
  ON public.ingestion_dispatches (run_id)
  WHERE run_id IS NOT NULL;

ALTER TABLE public.ingestion_dispatches ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ingestion_dispatches FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.ingestion_dispatches TO service_role;

-- 2. Dispatch recorder helper RPC
CREATE OR REPLACE FUNCTION public.record_ingestion_dispatch(
  p_action TEXT,
  p_scheduled_for TIMESTAMPTZ,
  p_attempt INTEGER DEFAULT 1,
  p_pg_net_request_id BIGINT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dispatch_id UUID;
BEGIN
  INSERT INTO public.ingestion_dispatches (
    action,
    scheduled_for,
    attempt,
    pg_net_request_id,
    enqueued_at
  )
  VALUES (
    p_action,
    p_scheduled_for,
    COALESCE(p_attempt, 1),
    p_pg_net_request_id,
    clock_timestamp()
  )
  ON CONFLICT (action, scheduled_for, attempt)
  DO UPDATE SET
    pg_net_request_id = EXCLUDED.pg_net_request_id,
    enqueued_at = clock_timestamp()
  RETURNING id INTO v_dispatch_id;

  RETURN v_dispatch_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_ingestion_dispatch(TEXT, TIMESTAMPTZ, INTEGER, BIGINT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_ingestion_dispatch(TEXT, TIMESTAMPTZ, INTEGER, BIGINT) TO service_role;

-- 3. Data freshness telemetry view
CREATE OR REPLACE VIEW public.v_data_freshness AS
WITH kind_summary AS (
  SELECT
    k.kind,
    COUNT(c.id) AS total_items,
    COUNT(c.id) FILTER (WHERE c.offer_state = 'active' AND (c.expires_at IS NULL OR c.expires_at > clock_timestamp())) AS active_items,
    MAX(c.last_seen_at) AS last_seen_at,
    MAX(c.published_at) AS last_published_at
  FROM (
    VALUES ('releases'::TEXT), ('deals'::TEXT), ('news'::TEXT)
  ) AS k(kind)
  LEFT JOIN public.content_items c ON c.kind = k.kind
  GROUP BY k.kind
)
SELECT
  s.kind,
  s.total_items,
  s.active_items,
  s.last_seen_at,
  s.last_published_at,
  CASE
    WHEN s.last_seen_at IS NOT NULL
    THEN ROUND(EXTRACT(EPOCH FROM (clock_timestamp() - s.last_seen_at)) / 3600.0, 2)
    ELSE NULL
  END AS hours_since_last_seen,
  CASE
    WHEN s.total_items = 0 THEN 'empty_feed'
    WHEN s.last_seen_at < clock_timestamp() - INTERVAL '24 hours' THEN 'stale'
    ELSE 'healthy'
  END AS health_status
FROM kind_summary s;

REVOKE ALL ON public.v_data_freshness FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.v_data_freshness TO service_role;
