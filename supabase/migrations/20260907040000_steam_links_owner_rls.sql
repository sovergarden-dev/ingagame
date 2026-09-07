-- P0c: user-owned Steam public profile link + server-only OpenID nonces.
-- GitHub-only: do not apply this migration to the remote database until named go.
-- Do not deploy steam-connect or set STEAM_* secrets until named go.
-- steam_links is readable/deletable by the owning authenticated user (public fields only).
-- Inserts/updates are Edge/service_role only so the client cannot forge a steam_id.
-- Steam OpenID 2.0 does not issue a refresh token; library/wishlist sync is a later server job.
-- Linking completes on POST /confirm with the same auth.uid() that started connect (CSRF).

CREATE TABLE public.steam_links (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  steam_id TEXT NOT NULL,
  persona_name TEXT,
  avatar_url TEXT,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (steam_id)
);

ALTER TABLE public.steam_links ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.steam_links FROM PUBLIC, anon, authenticated;
GRANT SELECT, DELETE ON public.steam_links TO authenticated;
GRANT ALL ON public.steam_links TO service_role;

CREATE POLICY "steam_links_select_own"
  ON public.steam_links
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "steam_links_delete_own"
  ON public.steam_links
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TABLE public.steam_connect_nonces (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  nonce TEXT NOT NULL UNIQUE,
  ticket TEXT NOT NULL UNIQUE,
  steam_id TEXT,
  persona_name TEXT,
  avatar_url TEXT,
  return_origin TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.steam_connect_nonces ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.steam_connect_nonces TO service_role;
REVOKE ALL ON TABLE public.steam_connect_nonces FROM PUBLIC, anon, authenticated;
