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
import { allowsCloudSync } from "@/domain/privacy";
import { usePreferences } from "@/preferences/PreferencesProvider";
import { libraryOnAccountChange, type LibraryLists } from "./account-switch";

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
  const { privacy } = usePreferences();
  const cloud = allowsCloudSync(privacy);
  const [wishlist, setWishlist] = useState<string[]>(["game-1", "game-5"]);
  const [following, setFollowing] = useState<string[]>(["game-1"]);
  const [loading, setLoading] = useState(false);
  const hydrated = useRef(false);
  const anonymous = useRef<LibraryLists>({ wishlist: ["game-1", "game-5"], following: ["game-1"] });
  const previousUserId = useRef<string | null>(null);
  const lists = useRef<LibraryLists>({ wishlist, following });
  lists.current = { wishlist, following };

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { wishlist?: string[]; following?: string[] };
        if (parsed.wishlist) setWishlist(parsed.wishlist);
        if (parsed.following) setFollowing(parsed.following);
        anonymous.current = {
          wishlist: parsed.wishlist ?? anonymous.current.wishlist,
          following: parsed.following ?? anonymous.current.following,
        };
      }
    } catch {
      /* ignore */
    }
    hydrated.current = true;
  }, []);

  // Local persistence only while signed out.
  useEffect(() => {
    if (!hydrated.current) return;
    const stored = user && cloud ? anonymous.current : { wishlist, following };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    } catch {
      /* ignore */
    }
  }, [wishlist, following, user, cloud]);

  // On sign-in or account switch, show that account's rows. Never upload the previous account.
  useEffect(() => {
    const nextId = user?.id ?? null;
    const prevId = previousUserId.current;
    if (prevId === nextId && cloud) return;
    if (!nextId || !cloud) {
      const result = libraryOnAccountChange({
        previousUserId: prevId,
        nextUserId: nextId,
        current: lists.current,
        anonymous: anonymous.current,
        account: null,
      });
      anonymous.current = result.anonymous;
      setWishlist(result.current.wishlist);
      setFollowing(result.current.following);
      previousUserId.current = nextId;
      return;
    }

    let cancelled = false;
    const sync = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("watchlist_items")
        .select("game_id, kind")
        .eq("user_id", nextId);
      if (cancelled) return;
      const account: LibraryLists = {
        wishlist: (data ?? []).filter((row) => row.kind === "wishlist").map((row) => row.game_id),
        following: (data ?? []).filter((row) => row.kind === "following").map((row) => row.game_id),
      };
      const result = libraryOnAccountChange({
        previousUserId: prevId,
        nextUserId: nextId,
        current: lists.current,
        anonymous: anonymous.current,
        account,
      });
      anonymous.current = result.anonymous;
      const accountEmpty = account.wishlist.length === 0 && account.following.length === 0;
      if (
        !prevId &&
        accountEmpty &&
        result.current.wishlist.length + result.current.following.length > 0
      ) {
        const local = [
          ...result.current.wishlist.map((game_id) => ({
            user_id: nextId,
            game_id,
            kind: "wishlist" as Kind,
          })),
          ...result.current.following.map((game_id) => ({
            user_id: nextId,
            game_id,
            kind: "following" as Kind,
          })),
        ];
        await supabase
          .from("watchlist_items")
          .upsert(local, { onConflict: "user_id,game_id,kind", ignoreDuplicates: true });
      }
      if (cancelled) return;
      setWishlist(result.current.wishlist);
      setFollowing(result.current.following);
      previousUserId.current = nextId;
      setLoading(false);
    };

    void sync();
    return () => {
      cancelled = true;
    };
  }, [user?.id, cloud]);

  const toggle = useCallback(
    (kind: Kind) => (id: string) => {
      const setter = kind === "wishlist" ? setWishlist : setFollowing;
      setter((prev) => {
        const has = prev.includes(id);
        if (user && cloud) {
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
    [user, cloud],
  );

  const toggleWishlist = useCallback((id: string) => toggle("wishlist")(id), [toggle]);
  const toggleFollow = useCallback((id: string) => toggle("following")(id), [toggle]);

  const value = useMemo<LibraryValue>(
    () => ({
      wishlist,
      following,
      synced: Boolean(user) && cloud,
      loading,
      isWishlisted: (id) => wishlist.includes(id),
      isFollowing: (id) => following.includes(id),
      toggleWishlist,
      toggleFollow,
    }),
    [wishlist, following, user, cloud, loading, toggleWishlist, toggleFollow],
  );

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

export function useLibrary() {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error("useLibrary must be used within LibraryProvider");
  return ctx;
}
