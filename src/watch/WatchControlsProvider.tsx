import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { EMPTY_WATCH_CONTROLS, toggleMutedGame, type WatchControls } from "@/domain/watch-controls";

const STORAGE_KEY = "inga.watchControls";

type WatchControlsValue = WatchControls & {
  hydrated: boolean;
  setPaused: (paused: boolean) => void;
  toggleMute: (gameId: string) => void;
  isMuted: (gameId: string) => boolean;
};

const WatchControlsContext = createContext<WatchControlsValue | null>(null);

export function WatchControlsProvider({ children }: { children: ReactNode }) {
  const [controls, setControls] = useState<WatchControls>(EMPTY_WATCH_CONTROLS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<WatchControls>;
        setControls({
          paused: parsed.paused === true,
          mutedGameIds: Array.isArray(parsed.mutedGameIds)
            ? parsed.mutedGameIds.filter((id): id is string => typeof id === "string")
            : [],
        });
      }
    } catch {
      /* ignore malformed storage */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(controls));
    } catch {
      /* storage unavailable */
    }
  }, [controls, hydrated]);

  const setPaused = useCallback((paused: boolean) => {
    setControls((prev) => ({ ...prev, paused }));
  }, []);

  const toggleMute = useCallback((gameId: string) => {
    setControls((prev) => toggleMutedGame(prev, gameId));
  }, []);

  const value = useMemo<WatchControlsValue>(
    () => ({
      ...controls,
      hydrated,
      setPaused,
      toggleMute,
      isMuted: (gameId) => controls.mutedGameIds.includes(gameId),
    }),
    [controls, hydrated, setPaused, toggleMute],
  );

  return <WatchControlsContext.Provider value={value}>{children}</WatchControlsContext.Provider>;
}

export function useWatchControls() {
  const ctx = useContext(WatchControlsContext);
  if (!ctx) throw new Error("useWatchControls must be used within WatchControlsProvider");
  return ctx;
}
