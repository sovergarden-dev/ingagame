-- Migration: Semantic offer classification and giveaway tracking for content_items
-- Architecture validated by Notion AI (Sy06) - Ref: 48cf607c210b4da18192fc1529e1369c
-- Security: service_role only; zero public/anon mutation rights.

-- 1. Add semantic offer classification columns to content_items
ALTER TABLE public.content_items
  ADD COLUMN IF NOT EXISTS offer_type TEXT NOT NULL DEFAULT 'discount'
    CHECK (offer_type IN ('free_to_keep', 'free_weekend', 'trial', 'permanently_free', 'discount', 'unknown')),
  ADD COLUMN IF NOT EXISTS classification_status TEXT NOT NULL DEFAULT 'unverified'
    CHECK (classification_status IN ('unverified', 'verified', 'flagged')),
  ADD COLUMN IF NOT EXISTS claim_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS access_ends_at TIMESTAMPTZ;

-- 2. Partial static index for active free-to-keep and free-weekend offers
CREATE INDEX IF NOT EXISTS content_items_free_active_idx
  ON public.content_items (claim_ends_at, offer_type)
  WHERE kind = 'deals' AND offer_state = 'active' AND offer_type IN ('free_to_keep', 'free_weekend');

-- 3. Atomic upsert RPC supporting semantic offer projections
DROP FUNCTION IF EXISTS public.upsert_content_item(TEXT, TEXT, TIMESTAMPTZ, JSONB, TIMESTAMPTZ, TEXT, TIMESTAMPTZ);
CREATE OR REPLACE FUNCTION public.upsert_content_item(
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

  IF p_offer_type NOT IN ('free_to_keep', 'free_weekend', 'trial', 'permanently_free', 'discount', 'unknown') THEN
    RAISE EXCEPTION 'invalid_offer_type: %', p_offer_type;
  END IF;

  IF p_classification_status NOT IN ('unverified', 'verified', 'flagged') THEN
    RAISE EXCEPTION 'invalid_classification_status: %', p_classification_status;
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
    now(),
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
    last_seen_at = now(),
    offer_type = EXCLUDED.offer_type,
    claim_ends_at = EXCLUDED.claim_ends_at,
    access_ends_at = EXCLUDED.access_ends_at,
    classification_status = EXCLUDED.classification_status
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- 4. Hardened Permissions: strictly service_role only
REVOKE ALL ON FUNCTION public.upsert_content_item(TEXT, TEXT, TIMESTAMPTZ, JSONB, TIMESTAMPTZ, TEXT, TIMESTAMPTZ, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_content_item(TEXT, TEXT, TIMESTAMPTZ, JSONB, TIMESTAMPTZ, TEXT, TIMESTAMPTZ, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT) TO service_role;
