import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

interface LibraryValue {
  wishlist: string[];
  following: string[];
  isWishlisted: (gameId: string) => boolean;
  isFollowing: (gameId: string) => boolean;
  toggleWishlist: (gameId: string) => void;
  toggleFollow: (gameId: string) => void;
}

const LibraryContext = createContext<LibraryValue | null>(null);
const STORAGE_KEY = "gamepulse.library";

/** Local-only placeholder for the future Cloud-backed watchlist. */
export function LibraryProvider({ children }: { children: ReactNode }) {
  const [wishlist, setWishlist] = useState<string[]>(["game-1", "game-5"]);
  const [following, setFollowing] = useState<string[]>(["game-1"]);

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
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ wishlist, following }));
    } catch {
      /* ignore */
    }
  }, [wishlist, following]);

  const toggle = (setter: typeof setWishlist) => (id: string) =>
    setter((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const toggleWishlist = useCallback((id: string) => toggle(setWishlist)(id), []);
  const toggleFollow = useCallback((id: string) => toggle(setFollowing)(id), []);

  const value = useMemo<LibraryValue>(
    () => ({
      wishlist,
      following,
      isWishlisted: (id) => wishlist.includes(id),
      isFollowing: (id) => following.includes(id),
      toggleWishlist,
      toggleFollow,
    }),
    [wishlist, following, toggleWishlist, toggleFollow],
  );

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

export function useLibrary() {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error("useLibrary must be used within LibraryProvider");
  return ctx;
}
