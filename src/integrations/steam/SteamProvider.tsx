import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { fetchSteamLibrary, SteamConnectError, type SteamLibrarySnapshot } from "./mock";

export type SteamStatus = "disconnected" | "connecting" | "connected" | "error";

interface SteamValue {
  status: SteamStatus;
  snapshot: SteamLibrarySnapshot | null;
  errorCode: string | null;
  ownedGameIds: string[];
  owns: (gameId: string) => boolean;
  connect: (handle: string) => Promise<void>;
  resync: () => Promise<void>;
  disconnect: () => void;
}

const SteamContext = createContext<SteamValue | null>(null);
const STORAGE_KEY = "gamepulse.steam";

/** Local, mock-backed Steam connection. Swaps to a Cloud provider later. */
export function SteamProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SteamStatus>("disconnected");
  const [snapshot, setSnapshot] = useState<SteamLibrarySnapshot | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as SteamLibrarySnapshot;
      if (parsed?.profile?.steamId) {
        setSnapshot(parsed);
        setStatus("connected");
      }
    } catch {
      /* ignore malformed storage */
    }
  }, []);

  const persist = (next: SteamLibrarySnapshot | null) => {
    try {
      if (next) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      else window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  };

  const connect = useCallback(async (handle: string) => {
    setStatus("connecting");
    setErrorCode(null);
    try {
      const next = await fetchSteamLibrary(handle);
      setSnapshot(next);
      persist(next);
      setStatus("connected");
    } catch (err) {
      setErrorCode(err instanceof SteamConnectError ? err.message : "unknown");
      setStatus("error");
    }
  }, []);

  const resync = useCallback(async () => {
    if (!snapshot) return;
    await connect(snapshot.profile.personaName);
  }, [snapshot, connect]);

  const disconnect = useCallback(() => {
    setSnapshot(null);
    persist(null);
    setErrorCode(null);
    setStatus("disconnected");
  }, []);

  const value = useMemo<SteamValue>(() => {
    const ownedGameIds = snapshot?.ownedGames.map((g) => g.gameId) ?? [];
    return {
      status,
      snapshot,
      errorCode,
      ownedGameIds,
      owns: (id) => ownedGameIds.includes(id),
      connect,
      resync,
      disconnect,
    };
  }, [status, snapshot, errorCode, connect, resync, disconnect]);

  return <SteamContext.Provider value={value}>{children}</SteamContext.Provider>;
}

export function useSteam() {
  const ctx = useContext(SteamContext);
  if (!ctx) throw new Error("useSteam must be used within SteamProvider");
  return ctx;
}
