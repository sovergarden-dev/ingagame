-- P0b: catalogue rows for the content-feed Edge function.
-- GitHub-only: do not apply this migration to the remote database until named go.
-- No CMS write path in P0. Edge uses service_role SELECT; publishable roles get no table rights.

CREATE TABLE public.content_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('releases', 'deals', 'news')),
  published_at TIMESTAMPTZ NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX content_items_kind_published_at_idx
  ON public.content_items (kind, published_at DESC);

ALTER TABLE public.content_items ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.content_items FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.content_items TO service_role;
