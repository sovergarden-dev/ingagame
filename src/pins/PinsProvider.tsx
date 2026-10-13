import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { togglePin } from "@/domain/pins";

const STORAGE_KEY = "inga.pins";

type PinsValue = {
  ids: string[];
  isPinned: (gameId: string) => boolean;
  toggle: (gameId: string) => void;
};

const PinsContext = createContext<PinsValue | null>(null);

export function PinsProvider({ children }: { children: ReactNode }) {
  const [ids, setIds] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as unknown) : [];
      if (Array.isArray(parsed)) {
        setIds(parsed.filter((id): id is string => typeof id === "string"));
      }
    } catch {
      /* ignore malformed storage */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    } catch {
      /* storage unavailable */
    }
  }, [hydrated, ids]);

  const toggle = useCallback((gameId: string) => {
    setIds((prev) => togglePin(prev, gameId));
  }, []);

  const value = useMemo<PinsValue>(
    () => ({
      ids,
      isPinned: (gameId) => ids.includes(gameId),
      toggle,
    }),
    [ids, toggle],
  );

  return <PinsContext.Provider value={value}>{children}</PinsContext.Provider>;
}

export function usePins() {
  const ctx = useContext(PinsContext);
  if (!ctx) throw new Error("usePins must be used within PinsProvider");
  return ctx;
}
