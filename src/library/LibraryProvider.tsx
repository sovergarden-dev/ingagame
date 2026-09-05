import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/AuthProvider";

interface LibraryValue {
  wishlist: string[];
  following: string[];
  /** True when the lists live in the user's cloud account instead of this device. */
  synced: boolean;
  loading: boolean;
  isWishlisted: (gameId: string) => boolean;
  isFollowing: (gameId: string) => boolean;
  toggleWishlist: (gameId: string) => void;
  toggleFollow: (gameId: string) => void;
}

const LibraryContext = createContext<LibraryValue | null>(null);
const STORAGE_KEY = "gamepulse.library";

type Kind = "wishlist" | "following";

/** Local-first watchlist that syncs to Lovable Cloud once signed in. */
export function LibraryProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [wishlist, setWishlist] = useState<string[]>(["game-1", "game-5"]);
  const [following, setFollowing] = useState<string[]>(["game-1"]);
  const [loading, setLoading] = useState(false);
  const hydrated = useRef(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { wishlist?: string[]; following?: string[] };
        if (parsed.wishlist) setWishlist(parsed.wishlist);
        if (parsed.following) setFollowing(parsed.following);
      }
    } catch {
      /* ignore */
    }
    hydrated.current = true;
  }, []);

  // Local persistence only while signed out.
  useEffect(() => {
    if (user) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ wishlist, following }));
    } catch {
      /* ignore */
    }
  }, [wishlist, following, user]);

  // On sign-in: push whatever is on this device, then read the account lists back.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const sync = async () => {
      setLoading(true);
      const local = [
        ...wishlist.map((game_id) => ({ user_id: user.id, game_id, kind: "wishlist" as Kind })),
        ...following.map((game_id) => ({ user_id: user.id, game_id, kind: "following" as Kind })),
      ];
      if (local.length) {
        await supabase
          .from("watchlist_items")
          .upsert(local, { onConflict: "user_id,game_id,kind", ignoreDuplicates: true });
      }
      const { data } = await supabase.from("watchlist_items").select("game_id, kind");
      if (cancelled) return;
      if (data) {
        setWishlist(data.filter((r) => r.kind === "wishlist").map((r) => r.game_id));
        setFollowing(data.filter((r) => r.kind === "following").map((r) => r.game_id));
      }
      setLoading(false);
    };

    void sync();
    return () => {
      cancelled = true;
    };
    // Runs once per signed-in user; local lists are read at that moment on purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const toggle = useCallback(
    (kind: Kind) => (id: string) => {
      const setter = kind === "wishlist" ? setWishlist : setFollowing;
      setter((prev) => {
        const has = prev.includes(id);
        if (user) {
          void (has
            ? supabase
                .from("watchlist_items")
                .delete()
                .eq("user_id", user.id)
                .eq("game_id", id)
                .eq("kind", kind)
            : supabase
                .from("watchlist_items")
                .upsert(
                  { user_id: user.id, game_id: id, kind },
                  { onConflict: "user_id,game_id,kind", ignoreDuplicates: true },
                ));
        }
        return has ? prev.filter((x) => x !== id) : [...prev, id];
      });
    },
    [user],
  );

  const toggleWishlist = useCallback((id: string) => toggle("wishlist")(id), [toggle]);
  const toggleFollow = useCallback((id: string) => toggle("following")(id), [toggle]);

  const value = useMemo<LibraryValue>(
    () => ({
      wishlist,
      following,
      synced: Boolean(user),
      loading,
      isWishlisted: (id) => wishlist.includes(id),
      isFollowing: (id) => following.includes(id),
      toggleWishlist,
      toggleFollow,
    }),
    [wishlist, following, user, loading, toggleWishlist, toggleFollow],
  );

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

export function useLibrary() {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error("useLibrary must be used within LibraryProvider");
  return ctx;
}
