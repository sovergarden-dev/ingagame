-- P0a: deny PUBLIC/anon table rights. Authenticated owner RLS is unchanged;
-- service_role grants from the baseline migration remain.
REVOKE ALL ON TABLE public.profiles FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.watchlist_items FROM PUBLIC, anon;

-- Re-assert: trigger-only, not callable via the Data API.
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
