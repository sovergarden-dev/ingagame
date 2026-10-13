import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const STORAGE_KEY = "inga.hiddenGames";

type HiddenState = { ids: string[]; genres: string[] };

const EMPTY: HiddenState = { ids: [], genres: [] };

type HiddenGamesValue = HiddenState & {
  isHidden: (gameId: string) => boolean;
  isGenreHidden: (genre: string) => boolean;
  toggle: (gameId: string) => void;
  toggleGenre: (genre: string) => void;
  clear: () => void;
};

function readHidden(raw: string | null): HiddenState {
  if (!raw) return EMPTY;
  const parsed = JSON.parse(raw) as unknown;
  if (Array.isArray(parsed)) {
    return { ids: parsed.filter((id): id is string => typeof id === "string"), genres: [] };
  }
  if (!parsed || typeof parsed !== "object") return EMPTY;
  const record = parsed as { ids?: unknown; genres?: unknown };
  return {
    ids: Array.isArray(record.ids)
      ? record.ids.filter((id): id is string => typeof id === "string")
      : [],
    genres: Array.isArray(record.genres)
      ? record.genres.filter((genre): genre is string => typeof genre === "string")
      : [],
  };
}

const HiddenGamesContext = createContext<HiddenGamesValue | null>(null);

export function HiddenGamesProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<HiddenState>(EMPTY);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      setState(readHidden(window.localStorage.getItem(STORAGE_KEY)));
    } catch {
      /* ignore malformed storage */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* storage unavailable */
    }
  }, [hydrated, state]);

  const toggle = useCallback((gameId: string) => {
    setState((prev) => ({
      ...prev,
      ids: prev.ids.includes(gameId)
        ? prev.ids.filter((id) => id !== gameId)
        : [...prev.ids, gameId],
    }));
  }, []);

  const toggleGenre = useCallback((genre: string) => {
    const key = genre.toLowerCase();
    setState((prev) => ({
      ...prev,
      genres: prev.genres.some((item) => item.toLowerCase() === key)
        ? prev.genres.filter((item) => item.toLowerCase() !== key)
        : [...prev.genres, genre],
    }));
  }, []);

  const clear = useCallback(() => setState(EMPTY), []);

  const value = useMemo<HiddenGamesValue>(
    () => ({
      ...state,
      isHidden: (gameId) => state.ids.includes(gameId),
      isGenreHidden: (genre) =>
        state.genres.some((item) => item.toLowerCase() === genre.toLowerCase()),
      toggle,
      toggleGenre,
      clear,
    }),
    [clear, state, toggle, toggleGenre],
  );

  return <HiddenGamesContext.Provider value={value}>{children}</HiddenGamesContext.Provider>;
}

export function useHiddenGames() {
  const ctx = useContext(HiddenGamesContext);
  if (!ctx) throw new Error("useHiddenGames must be used within HiddenGamesProvider");
  return ctx;
}
