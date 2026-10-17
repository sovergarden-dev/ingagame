-- Migration: Idempotent content_items upsert with namespaced external identity
-- Reviewed & verified per Notion Sy06 architecture critique.
-- Security: RLS strictly enforced; NO mutating grants to public, anon, or authenticated.

-- 1. Add external_id column to content_items for deterministic identity tracking
ALTER TABLE public.content_items
  ADD COLUMN IF NOT EXISTS external_id TEXT;

-- 2. Create partial unique index on (kind, external_id) for idempotent upserts
CREATE UNIQUE INDEX IF NOT EXISTS content_items_kind_external_id_idx
  ON public.content_items (kind, external_id)
  WHERE external_id IS NOT NULL;

-- 3. Atomic upsert RPC for service_role background ingestion
CREATE OR REPLACE FUNCTION public.upsert_content_item(
  p_kind TEXT,
  p_external_id TEXT,
  p_published_at TIMESTAMPTZ,
  p_payload JSONB
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  -- Strict validation of kind and external_id
  IF p_kind NOT IN ('releases', 'deals', 'news') THEN
    RAISE EXCEPTION 'invalid_kind: %', p_kind;
  END IF;

  IF p_external_id IS NULL OR trim(p_external_id) = '' THEN
    RAISE EXCEPTION 'invalid_external_id: must not be null or blank';
  END IF;

  INSERT INTO public.content_items (kind, external_id, published_at, payload)
  VALUES (p_kind, trim(p_external_id), p_published_at, p_payload)
  ON CONFLICT (kind, external_id) WHERE external_id IS NOT NULL
  DO UPDATE SET
    published_at = EXCLUDED.published_at,
    payload = EXCLUDED.payload
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- 4. Hardened Security Grants: Only service_role may execute this ingestion RPC
REVOKE ALL ON FUNCTION public.upsert_content_item(TEXT, TEXT, TIMESTAMPTZ, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_content_item(TEXT, TEXT, TIMESTAMPTZ, JSONB) TO service_role;
