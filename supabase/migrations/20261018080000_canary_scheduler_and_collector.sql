-- Migration: 20261018080000_canary_scheduler_and_collector.sql
-- Description: Canary scheduler wrapper (pg_cron + pg_net + Vault) for sync_steam_deals,
--              telemetry collector from net._http_response, and sync_epic_free_games action allowlist
--              per Notion Sy06 architectural review.

-- 1. Extend action ↔ kind validation in upsert_content_item to support sync_epic_free_games
DROP FUNCTION IF EXISTS public.upsert_content_item(
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
);

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
  IF p_run_id IS NULL THEN
    RAISE EXCEPTION 'lease_required: write requires active run_id' USING ERRCODE = '55000';
  END IF;

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

  SELECT action INTO v_action
  FROM public.ingestion_runs
  WHERE id = p_run_id AND status = 'running';

  IF v_action IS NULL THEN
    RAISE EXCEPTION 'lease_not_running: run % is not active or does not exist', p_run_id USING ERRCODE = '55000';
  END IF;

  IF v_action = 'sync_steam_releases' AND p_kind <> 'releases' THEN
    RAISE EXCEPTION 'action_kind_mismatch: action % cannot write kind %', v_action, p_kind USING ERRCODE = '55000';
  ELSIF v_action IN ('sync_steam_deals', 'sync_epic_free_games') AND p_kind <> 'deals' THEN
    RAISE EXCEPTION 'action_kind_mismatch: action % cannot write kind %', v_action, p_kind USING ERRCODE = '55000';
  ELSIF v_action = 'sync_steam_news' AND p_kind <> 'news' THEN
    RAISE EXCEPTION 'action_kind_mismatch: action % cannot write kind %', v_action, p_kind USING ERRCODE = '55000';
  ELSIF v_action NOT IN ('sync_steam_releases', 'sync_steam_deals', 'sync_steam_news', 'sync_epic_free_games', 'ingest_batch') THEN
    RAISE EXCEPTION 'unrecognized_action: %', v_action USING ERRCODE = '55000';
  END IF;

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

-- Seed default configuration for sync_epic_free_games
INSERT INTO public.ingestion_config (action, is_enabled, cooldown_seconds, paused_reason)
VALUES ('sync_epic_free_games', TRUE, 120, NULL)
ON CONFLICT (action) DO NOTHING;

-- 2. Private schema for scheduler & telemetry operations
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO postgres, service_role;

-- 3. Canary Scheduler Wrapper: private.dispatch_ingestion_action
CREATE OR REPLACE FUNCTION private.dispatch_ingestion_action(
  p_action TEXT,
  p_scheduled_for TIMESTAMPTZ DEFAULT date_trunc('minute', clock_timestamp()),
  p_attempt INTEGER DEFAULT 1
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, extensions
AS $$
DECLARE
  v_enabled BOOLEAN := FALSE;
  v_endpoint_url TEXT;
  v_invoke_secret TEXT;
  v_dispatch_id UUID;
  v_req_id BIGINT;
BEGIN
  IF p_action NOT IN ('sync_steam_deals', 'sync_steam_releases', 'sync_steam_news', 'sync_epic_free_games') THEN
    RAISE EXCEPTION 'disallowed_action: %', p_action USING ERRCODE = '55000';
  END IF;

  SELECT is_enabled INTO v_enabled
  FROM public.ingestion_config
  WHERE action = p_action;

  IF NOT COALESCE(v_enabled, FALSE) THEN
    RETURN NULL;
  END IF;

  -- Retrieve endpoint URL and invocation secret from Supabase Vault when available
  IF to_regclass('vault.decrypted_secrets') IS NOT NULL THEN
    EXECUTE $q$
      SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'ingest_endpoint_url' LIMIT 1
    $q$ INTO v_endpoint_url;

    EXECUTE $q$
      SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'ingest_service_role_key' LIMIT 1
    $q$ INTO v_invoke_secret;
  END IF;

  IF v_endpoint_url IS NULL OR trim(v_endpoint_url) = '' OR v_invoke_secret IS NULL OR trim(v_invoke_secret) = '' THEN
    -- Fail-closed if Vault secrets are not yet provisioned
    INSERT INTO public.ingestion_dispatches (
      action,
      scheduled_for,
      attempt,
      enqueued_at,
      transport_error,
      execution_outcome
    )
    VALUES (
      p_action,
      p_scheduled_for,
      COALESCE(p_attempt, 1),
      clock_timestamp(),
      'vault_secrets_unconfigured',
      'skipped_unconfigured'
    )
    ON CONFLICT (action, scheduled_for, attempt) DO NOTHING
    RETURNING id INTO v_dispatch_id;

    RETURN v_dispatch_id;
  END IF;

  INSERT INTO public.ingestion_dispatches (
    action,
    scheduled_for,
    attempt,
    enqueued_at
  )
  VALUES (
    p_action,
    p_scheduled_for,
    COALESCE(p_attempt, 1),
    clock_timestamp()
  )
  ON CONFLICT (action, scheduled_for, attempt) DO NOTHING
  RETURNING id INTO v_dispatch_id;

  IF v_dispatch_id IS NULL THEN
    -- Slot already dispatched
    RETURN NULL;
  END IF;

  IF to_regproc('net.http_post') IS NOT NULL THEN
    EXECUTE $q$
      SELECT net.http_post(
        url := $1,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || $2
        ),
        body := jsonb_build_object(
          'action', $3,
          'trigger', 'cron',
          'dispatchId', $4::text
        ),
        timeout_milliseconds := 30000
      )
    $q$
    INTO v_req_id
    USING v_endpoint_url, v_invoke_secret, p_action, v_dispatch_id;

    UPDATE public.ingestion_dispatches
    SET pg_net_request_id = v_req_id
    WHERE id = v_dispatch_id;
  ELSE
    UPDATE public.ingestion_dispatches
    SET transport_error = 'pg_net_unavailable',
        execution_outcome = 'transport_failed'
    WHERE id = v_dispatch_id;
  END IF;

  RETURN v_dispatch_id;
END;
$$;

REVOKE ALL ON FUNCTION private.dispatch_ingestion_action(TEXT, TIMESTAMPTZ, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.dispatch_ingestion_action(TEXT, TIMESTAMPTZ, INTEGER) TO postgres, service_role;

-- 4. Telemetry Collector: private.collect_pg_net_dispatch_outcomes
CREATE OR REPLACE FUNCTION private.collect_pg_net_dispatch_outcomes() RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_updated INTEGER := 0;
BEGIN
  IF to_regclass('net._http_response') IS NULL THEN
    RETURN 0;
  END IF;

  EXECUTE $q$
    UPDATE public.ingestion_dispatches d
    SET response_at = COALESCE(r.created, clock_timestamp()),
        http_status = r.status_code,
        transport_error = CASE
          WHEN r.timed_out THEN 'http_timeout'
          WHEN r.error_msg IS NOT NULL THEN left(r.error_msg, 250)
          ELSE d.transport_error
        END,
        execution_outcome = COALESCE(
          d.execution_outcome,
          CASE
            WHEN r.timed_out THEN 'unknown_timeout'
            WHEN r.status_code BETWEEN 200 AND 299 THEN 'http_ok'
            WHEN r.status_code = 409 THEN 'conflict_or_disabled'
            WHEN r.status_code = 429 THEN 'cooldown_throttled'
            ELSE 'http_error'
          END
        )
    FROM net._http_response r
    WHERE d.pg_net_request_id = r.id
      AND d.response_at IS NULL
  $q$;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

REVOKE ALL ON FUNCTION private.collect_pg_net_dispatch_outcomes() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.collect_pg_net_dispatch_outcomes() TO postgres, service_role;

-- 5. RPC to correlate dispatchId with runId and final execution outcome from Edge Worker
CREATE OR REPLACE FUNCTION public.link_dispatch_to_run(
  p_dispatch_id UUID,
  p_run_id UUID DEFAULT NULL,
  p_http_status INTEGER DEFAULT NULL,
  p_outcome TEXT DEFAULT NULL
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows INTEGER := 0;
BEGIN
  IF p_dispatch_id IS NULL THEN
    RETURN FALSE;
  END IF;

  UPDATE public.ingestion_dispatches
  SET run_id = COALESCE(p_run_id, run_id),
      http_status = COALESCE(p_http_status, http_status),
      response_at = COALESCE(response_at, clock_timestamp()),
      execution_outcome = COALESCE(p_outcome, execution_outcome)
  WHERE id = p_dispatch_id;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.link_dispatch_to_run(UUID, UUID, INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.link_dispatch_to_run(UUID, UUID, INTEGER, TEXT) TO service_role;

-- 6. Canary Schedule Registration via pg_cron (when extension is installed)
-- Only schedules sync_steam_deals (7 */2 * * *) + collector (*/10 * * * *) per 48h Canary Gate.
DO $$
BEGIN
  IF to_regproc('cron.schedule') IS NOT NULL THEN
    PERFORM cron.schedule(
      'inga-canary-sync-steam-deals',
      '7 */2 * * *',
      $cron$SELECT private.dispatch_ingestion_action('sync_steam_deals', date_trunc('hour', clock_timestamp()));$cron$
    );

    PERFORM cron.schedule(
      'inga-collect-pg-net-dispatches',
      '*/10 * * * *',
      $cron$SELECT private.collect_pg_net_dispatch_outcomes();$cron$
    );
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipping pg_cron schedule registration: %', SQLERRM;
END;
$$;
