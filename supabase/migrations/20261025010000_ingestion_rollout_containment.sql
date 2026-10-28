-- Forward-only containment. Automation stays OFF until a separately reviewed
-- atomic dispatch/epoch rollout exists. Preserve audit rows and prior migrations.
BEGIN;

DO $$
DECLARE v_job RECORD;
BEGIN
  IF to_regclass('cron.job') IS NOT NULL AND
     to_regprocedure('cron.unschedule(bigint)') IS NOT NULL THEN
    FOR v_job IN EXECUTE $q$SELECT jobid FROM cron.job
      WHERE jobname IN ('inga-canary-sync-steam-deals', 'inga-collect-pg-net-dispatches')
         OR command LIKE '%dispatch_ingestion_action%'
         OR command LIKE '%collect_pg_net_dispatch_outcomes%'$q$
    LOOP
      EXECUTE 'SELECT cron.unschedule($1::bigint)' USING v_job.jobid;
    END LOOP;
  END IF;
END;
$$;

ALTER TABLE public.ingestion_config ALTER COLUMN is_enabled SET DEFAULT FALSE;
UPDATE public.ingestion_config SET is_enabled = FALSE,
  paused_reason = 'rollout_safety_gate', updated_at = clock_timestamp();
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ingestion_cooldown_nonnegative') THEN
    ALTER TABLE public.ingestion_config ADD CONSTRAINT ingestion_cooldown_nonnegative
      CHECK (cooldown_seconds >= 0) NOT VALID;
  END IF;
END;
$$;

DROP FUNCTION IF EXISTS public.upsert_content_item(TEXT,TEXT,TIMESTAMPTZ,JSONB);
DROP FUNCTION IF EXISTS public.upsert_content_item(TEXT,TEXT,TIMESTAMPTZ,JSONB,TIMESTAMPTZ,TEXT,TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.upsert_content_item(TEXT,TEXT,TIMESTAMPTZ,JSONB,TIMESTAMPTZ,TEXT,TIMESTAMPTZ,TEXT,TIMESTAMPTZ,TIMESTAMPTZ,TEXT);
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES ON
  public.content_items, public.ingestion_config, public.ingestion_leases,
  public.ingestion_runs, public.ingestion_dispatches
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.dispatch_ingestion_action(
  p_action TEXT, p_scheduled_for TIMESTAMPTZ DEFAULT date_trunc('minute', clock_timestamp()),
  p_attempt INTEGER DEFAULT 1
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
BEGIN
  RAISE EXCEPTION 'scheduler_not_ready' USING ERRCODE = '55000';
END;
$$;
REVOKE ALL ON FUNCTION private.dispatch_ingestion_action(TEXT,TIMESTAMPTZ,INTEGER)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.dispatch_ingestion_action(TEXT,TIMESTAMPTZ,INTEGER) TO postgres;

-- Legacy callbacks cannot rebind a dispatch or invent transport evidence.
CREATE OR REPLACE FUNCTION public.link_dispatch_to_run(
  p_dispatch_id UUID, p_run_id UUID DEFAULT NULL,
  p_http_status INTEGER DEFAULT NULL, p_outcome TEXT DEFAULT NULL
) RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
BEGIN
  RAISE EXCEPTION 'scheduler_not_ready' USING ERRCODE = '55000';
END;
$$;
REVOKE ALL ON FUNCTION public.link_dispatch_to_run(UUID,UUID,INTEGER,TEXT)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.record_ingestion_dispatch(TEXT,TIMESTAMPTZ,INTEGER,BIGINT)
  FROM PUBLIC, anon, authenticated, service_role;

ALTER TABLE public.ingestion_dispatches
  ADD COLUMN IF NOT EXISTS transport_observed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS transport_collected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS transport_status_code INTEGER,
  ADD COLUMN IF NOT EXISTS transport_error_code TEXT;

CREATE OR REPLACE FUNCTION private.collect_pg_net_dispatch_outcomes()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE v_count INTEGER;
BEGIN
  IF to_regclass('net._http_response') IS NULL THEN RETURN 0; END IF;
  EXECUTE $q$
    UPDATE public.ingestion_dispatches d
    SET transport_observed_at = r.created,
        transport_collected_at = clock_timestamp(),
        transport_status_code = r.status_code,
        transport_error_code = CASE WHEN r.timed_out THEN 'transport_timeout'
          WHEN r.error_msg IS NOT NULL THEN 'transport_error'
          WHEN r.status_code IN (401,403) THEN 'auth_error'
          WHEN r.status_code >= 500 THEN 'server_error'
          WHEN r.status_code >= 400 THEN 'http_error' ELSE NULL END
    FROM net._http_response r
    WHERE d.pg_net_request_id = r.id AND d.transport_collected_at IS NULL
  $q$;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION private.collect_pg_net_dispatch_outcomes() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.collect_pg_net_dispatch_outcomes() TO service_role;

CREATE OR REPLACE FUNCTION public.claim_ingestion_run(
  p_action TEXT, p_trigger TEXT DEFAULT 'manual', p_lease_seconds INTEGER DEFAULT 300
) RETURNS TABLE(claimed BOOLEAN, run_id UUID, reason TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE
  v_config public.ingestion_config%ROWTYPE;
  v_lease public.ingestion_leases%ROWTYPE;
  v_now TIMESTAMPTZ;
  v_run UUID;
BEGIN
  IF p_action IS NULL OR p_action NOT IN ('sync_steam_releases','sync_steam_deals','sync_steam_news','sync_epic_free_games') THEN
    RETURN QUERY SELECT FALSE,NULL::UUID,'unknown_action'::TEXT; RETURN;
  END IF;
  IF p_trigger IS DISTINCT FROM 'manual' THEN
    RETURN QUERY SELECT FALSE,NULL::UUID,'scheduler_not_ready'::TEXT; RETURN;
  END IF;
  IF p_lease_seconds IS NULL OR p_lease_seconds < 30 OR p_lease_seconds > 300 THEN
    RETURN QUERY SELECT FALSE,NULL::UUID,'invalid_lease_seconds'::TEXT; RETURN;
  END IF;
  SELECT * INTO v_config FROM public.ingestion_config WHERE action=p_action FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE,NULL::UUID,'missing_config'::TEXT; RETURN;
  END IF;
  IF NOT v_config.is_enabled THEN
    RETURN QUERY SELECT FALSE,NULL::UUID,'action_disabled'::TEXT; RETURN;
  END IF;
  INSERT INTO public.ingestion_leases(action,lease_expires_at)
    VALUES(p_action,clock_timestamp()) ON CONFLICT(action) DO NOTHING;
  SELECT * INTO v_lease FROM public.ingestion_leases WHERE action=p_action FOR UPDATE;
  v_now := clock_timestamp();
  IF v_lease.active_run_id IS NOT NULL AND v_lease.lease_expires_at > v_now THEN
    RETURN QUERY SELECT FALSE,NULL::UUID,'lease_held'::TEXT; RETURN;
  END IF;
  IF v_config.next_allowed_at > v_now THEN
    RETURN QUERY SELECT FALSE,NULL::UUID,'cooldown_active'::TEXT; RETURN;
  END IF;
  UPDATE public.ingestion_runs SET status='failed',error_message='lease_expired_reclaimed',finished_at=v_now
    WHERE id=v_lease.active_run_id AND status='running';
  INSERT INTO public.ingestion_runs(action,trigger,status,started_at)
    VALUES(p_action,'manual','running',v_now) RETURNING id INTO v_run;
  UPDATE public.ingestion_leases SET active_run_id=v_run,
    lease_expires_at=v_now+make_interval(secs=>p_lease_seconds),updated_at=v_now WHERE action=p_action;
  UPDATE public.ingestion_config SET next_allowed_at=v_now+make_interval(secs=>cooldown_seconds),updated_at=v_now
    WHERE action=p_action;
  RETURN QUERY SELECT TRUE,v_run,'ok'::TEXT;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_ingestion_run(TEXT,TEXT,INTEGER) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_ingestion_run(TEXT,TEXT,INTEGER) TO service_role;

CREATE OR REPLACE FUNCTION public.finalize_ingestion_run(
  p_run_id UUID,p_status TEXT,p_synced INTEGER DEFAULT 0,p_dropped INTEGER DEFAULT 0,
  p_total INTEGER DEFAULT 0,p_error TEXT DEFAULT NULL
) RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE
  v_action TEXT;
  v_owner UUID;
  v_expiry TIMESTAMPTZ;
  v_status TEXT;
  v_now TIMESTAMPTZ;
BEGIN
  IF p_status IS NULL OR p_status NOT IN ('completed','failed') OR
    p_synced IS NULL OR p_dropped IS NULL OR p_total IS NULL OR
    p_synced<0 OR p_dropped<0 OR p_total<0 OR p_synced::BIGINT+p_dropped>p_total THEN
    RAISE EXCEPTION 'invalid_finalize' USING ERRCODE='22023';
  END IF;
  SELECT action INTO v_action FROM public.ingestion_runs WHERE id=p_run_id;
  IF NOT FOUND THEN RETURN FALSE; END IF;
  PERFORM 1 FROM public.ingestion_config WHERE action=v_action FOR UPDATE;
  SELECT active_run_id,lease_expires_at INTO v_owner,v_expiry FROM public.ingestion_leases WHERE action=v_action FOR UPDATE;
  SELECT status INTO v_status FROM public.ingestion_runs WHERE id=p_run_id FOR UPDATE;
  v_now:=clock_timestamp();
  IF v_owner IS DISTINCT FROM p_run_id OR v_status IS DISTINCT FROM 'running' THEN RETURN FALSE; END IF;
  IF v_expiry <= v_now THEN
    UPDATE public.ingestion_runs SET status='failed',error_message='lease_expired',finished_at=v_now WHERE id=p_run_id;
    RETURN FALSE;
  END IF;
  UPDATE public.ingestion_runs SET status=p_status,synced_count=p_synced,dropped_count=p_dropped,total_count=p_total,
    error_message=CASE WHEN p_error IS NULL THEN NULL ELSE left(p_error,100) END,finished_at=v_now WHERE id=p_run_id;
  UPDATE public.ingestion_leases SET active_run_id=NULL,lease_expires_at=v_now,updated_at=v_now
    WHERE action=v_action AND active_run_id=p_run_id;
  RETURN TRUE;
END;
$$;
REVOKE ALL ON FUNCTION public.finalize_ingestion_run(UUID,TEXT,INTEGER,INTEGER,INTEGER,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_ingestion_run(UUID,TEXT,INTEGER,INTEGER,INTEGER,TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.upsert_content_item(
  p_run_id UUID,p_kind TEXT,p_external_id TEXT,p_published_at TIMESTAMPTZ,p_payload JSONB,
  p_expires_at TIMESTAMPTZ DEFAULT NULL,p_offer_state TEXT DEFAULT 'active',
  p_source_fresh_until TIMESTAMPTZ DEFAULT NULL,p_offer_type TEXT DEFAULT 'discount',
  p_claim_ends_at TIMESTAMPTZ DEFAULT NULL,p_access_ends_at TIMESTAMPTZ DEFAULT NULL,
  p_classification_status TEXT DEFAULT 'unverified'
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE
  v_action TEXT;
  v_owner UUID;
  v_expiry TIMESTAMPTZ;
  v_status TEXT;
  v_enabled BOOLEAN;
  v_id UUID;
  v_now TIMESTAMPTZ;
BEGIN
  IF p_run_id IS NULL THEN RAISE EXCEPTION 'lease_required' USING ERRCODE='55000'; END IF;
  IF p_kind IS NULL OR p_kind NOT IN ('releases','deals','news') OR p_external_id IS NULL OR
    length(btrim(p_external_id))=0 OR p_published_at IS NULL OR p_payload IS NULL OR jsonb_typeof(p_payload)<>'object' OR
    p_offer_state IS NULL OR p_offer_state NOT IN ('active','expired','withdrawn','archived') OR
    p_offer_type IS NULL OR p_offer_type NOT IN ('free_to_keep','free_weekend','trial','permanently_free','discount','unknown') OR
    p_classification_status IS NULL OR p_classification_status NOT IN ('unverified','verified','flagged') THEN
    RAISE EXCEPTION 'invalid_content' USING ERRCODE='22023';
  END IF;
  SELECT action INTO v_action FROM public.ingestion_runs WHERE id=p_run_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'lease_not_running' USING ERRCODE='55000'; END IF;
  IF NOT ((v_action='sync_steam_releases' AND p_kind='releases' AND p_external_id LIKE 'steam:app:%') OR
    (v_action='sync_steam_deals' AND p_kind='deals' AND p_external_id LIKE 'steam:app:%') OR
    (v_action='sync_steam_news' AND p_kind='news' AND p_external_id LIKE 'news:steam:app:%') OR
    (v_action='sync_epic_free_games' AND p_kind='deals' AND p_external_id LIKE 'epic:v2:%')) THEN
    RAISE EXCEPTION 'action_kind_mismatch' USING ERRCODE='55000';
  END IF;
  SELECT is_enabled INTO v_enabled FROM public.ingestion_config WHERE action=v_action FOR UPDATE;
  IF v_enabled IS DISTINCT FROM TRUE THEN RAISE EXCEPTION 'action_disabled' USING ERRCODE='55000'; END IF;
  SELECT active_run_id,lease_expires_at INTO v_owner,v_expiry FROM public.ingestion_leases WHERE action=v_action FOR UPDATE;
  SELECT status INTO v_status FROM public.ingestion_runs WHERE id=p_run_id FOR UPDATE;
  IF v_owner IS DISTINCT FROM p_run_id OR v_status IS DISTINCT FROM 'running' THEN
    RAISE EXCEPTION 'lease_not_owner' USING ERRCODE='55000';
  END IF;
  PERFORM 1 FROM public.content_items WHERE kind=p_kind AND external_id=btrim(p_external_id) FOR UPDATE;
  v_now:=clock_timestamp();
  IF v_expiry<=v_now THEN RAISE EXCEPTION 'lease_expired' USING ERRCODE='55000'; END IF;
  INSERT INTO public.content_items(kind,external_id,published_at,payload,expires_at,offer_state,source_fresh_until,
    last_seen_at,offer_type,claim_ends_at,access_ends_at,classification_status)
  VALUES(p_kind,btrim(p_external_id),p_published_at,p_payload,p_expires_at,p_offer_state,p_source_fresh_until,
    v_now,p_offer_type,p_claim_ends_at,p_access_ends_at,p_classification_status)
  ON CONFLICT(kind,external_id) WHERE external_id IS NOT NULL DO UPDATE SET
    published_at=EXCLUDED.published_at,payload=EXCLUDED.payload,expires_at=EXCLUDED.expires_at,
    offer_state=EXCLUDED.offer_state,source_fresh_until=EXCLUDED.source_fresh_until,last_seen_at=v_now,
    offer_type=EXCLUDED.offer_type,claim_ends_at=EXCLUDED.claim_ends_at,access_ends_at=EXCLUDED.access_ends_at,
    classification_status=EXCLUDED.classification_status RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.upsert_content_item(UUID,TEXT,TEXT,TIMESTAMPTZ,JSONB,TIMESTAMPTZ,TEXT,TIMESTAMPTZ,TEXT,TIMESTAMPTZ,TIMESTAMPTZ,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_content_item(UUID,TEXT,TEXT,TIMESTAMPTZ,JSONB,TIMESTAMPTZ,TEXT,TIMESTAMPTZ,TEXT,TIMESTAMPTZ,TIMESTAMPTZ,TEXT) TO service_role;

-- Preserve legacy Epic payloads as audit records, not duplicate active offers.
UPDATE public.content_items SET offer_state='archived',classification_status='flagged'
  WHERE kind='deals' AND external_id LIKE 'epic:namespace:%';
COMMIT;
