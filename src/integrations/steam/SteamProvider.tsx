import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import {
  STEAM_LINKS_PUBLIC_COLUMNS,
  SteamConnectError,
  allowMockSteam,
  startSteamConnect,
  toPublicSteamProfile,
  type SteamPublicProfile,
} from "./client";
import type { SteamLibrarySnapshot } from "./mock";

export type SteamStatus = "disconnected" | "connecting" | "connected" | "error";

interface SteamValue {
  status: SteamStatus;
  snapshot: SteamLibrarySnapshot | null;
  publicProfile: SteamPublicProfile;
  errorCode: string | null;
  ownedGameIds: string[];
  mock: boolean;
  owns: (gameId: string) => boolean;
  connect: (handle?: string) => Promise<void>;
  resync: () => Promise<void>;
  disconnect: () => void;
}

const SteamContext = createContext<SteamValue | null>(null);
const STORAGE_KEY = "gamepulse.steam";

function snapshotFromPublic(profile: SteamPublicProfile): SteamLibrarySnapshot | null {
  if (!profile.connected || !profile.steamId) return null;
  return {
    profile: {
      steamId: profile.steamId,
      personaName: profile.personaName ?? profile.steamId,
      avatarUrl: profile.avatarUrl ?? "",
      profileUrl: `https://steamcommunity.com/profiles/${profile.steamId}`,
      countryCode: "",
    },
    ownedGames: [],
    wishlistGameIds: [],
    syncedAt: new Date().toISOString(),
  };
}

function readViteEnv() {
  return (import.meta.env ?? {}) as {
    DEV?: boolean;
    PROD?: boolean;
    VITE_STEAM_MOCK?: string;
    VITE_SUPABASE_URL?: string;
    VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  };
}

/** Steam connection: mock in DEV, server-backed OpenID otherwise. */
export function SteamProvider({ children }: { children: ReactNode }) {
  const env = readViteEnv();
  const mock = allowMockSteam(env);
  const { session, user } = useAuth();
  const [status, setStatus] = useState<SteamStatus>("disconnected");
  const [snapshot, setSnapshot] = useState<SteamLibrarySnapshot | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const persistMock = (next: SteamLibrarySnapshot | null) => {
    try {
      if (next) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      else window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  };

  const loadServerLink = useCallback(async () => {
    if (!user) {
      setSnapshot(null);
      setStatus("disconnected");
      return;
    }
    const { data, error } = await supabase
      .from("steam_links")
      .select(STEAM_LINKS_PUBLIC_COLUMNS)
      .maybeSingle();
    if (error) {
      setSnapshot(null);
      setStatus("disconnected");
      return;
    }
    const profile = toPublicSteamProfile((data as Record<string, unknown> | null) ?? null);
    const next = snapshotFromPublic(profile);
    setSnapshot(next);
    setStatus(next ? "connected" : "disconnected");
  }, [user]);

  useEffect(() => {
    if (!mock) return;
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
  }, [mock]);

  useEffect(() => {
    if (mock) return;
    void loadServerLink();
  }, [mock, loadServerLink]);

  useEffect(() => {
    if (mock || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("steam") !== "connected") return;
    params.delete("steam");
    const search = params.toString();
    const next = `${window.location.pathname}${search ? `?${search}` : ""}${window.location.hash}`;
    window.history.replaceState(null, "", next);
    void loadServerLink();
  }, [mock, loadServerLink]);

  const connectMock = useCallback(async (handle: string) => {
    setStatus("connecting");
    setErrorCode(null);
    try {
      const { fetchSteamLibrary } = await import("./mock");
      const next = await fetchSteamLibrary(handle);
      setSnapshot(next);
      persistMock(next);
      setStatus("connected");
    } catch (err) {
      setErrorCode(err instanceof SteamConnectError ? err.message : "unknown");
      setStatus("error");
    }
  }, []);

  const connectServer = useCallback(async () => {
    if (!session?.access_token) {
      setErrorCode("sign-in-required");
      setStatus("error");
      return;
    }
    const supabaseUrl = env.VITE_SUPABASE_URL;
    const publishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY;
    if (!supabaseUrl || !publishableKey) {
      setErrorCode("start-failed");
      setStatus("error");
      return;
    }
    setStatus("connecting");
    setErrorCode(null);
    try {
      await startSteamConnect({
        accessToken: session.access_token,
        supabaseUrl,
        publishableKey,
      });
    } catch (err) {
      setErrorCode(err instanceof SteamConnectError ? err.message : "start-failed");
      setStatus("error");
    }
  }, [env.VITE_SUPABASE_PUBLISHABLE_KEY, env.VITE_SUPABASE_URL, session?.access_token]);

  const connect = useCallback(
    async (handle = "") => {
      if (mock) return connectMock(handle);
      return connectServer();
    },
    [mock, connectMock, connectServer],
  );

  const resync = useCallback(async () => {
    if (mock) {
      if (!snapshot) return;
      await connectMock(snapshot.profile.personaName);
      return;
    }
    setErrorCode("library-sync-stub");
  }, [mock, snapshot, connectMock]);

  const disconnect = useCallback(() => {
    if (mock) {
      setSnapshot(null);
      persistMock(null);
      setErrorCode(null);
      setStatus("disconnected");
      return;
    }
    void (async () => {
      if (user) {
        await supabase.from("steam_links").delete().eq("user_id", user.id);
      }
      setSnapshot(null);
      setErrorCode(null);
      setStatus("disconnected");
    })();
  }, [mock, user]);

  const value = useMemo<SteamValue>(() => {
    const ownedGameIds = snapshot?.ownedGames.map((g) => g.gameId) ?? [];
    return {
      status,
      snapshot,
      publicProfile: snapshot
        ? {
            connected: true,
            personaName: snapshot.profile.personaName,
            avatarUrl: snapshot.profile.avatarUrl,
            steamId: snapshot.profile.steamId,
          }
        : { connected: false, personaName: null, avatarUrl: null, steamId: null },
      errorCode,
      ownedGameIds,
      mock,
      owns: (id) => ownedGameIds.includes(id),
      connect,
      resync,
      disconnect,
    };
  }, [status, snapshot, errorCode, mock, connect, resync, disconnect]);

  return <SteamContext.Provider value={value}>{children}</SteamContext.Provider>;
}

export function useSteam() {
  const ctx = useContext(SteamContext);
  if (!ctx) throw new Error("useSteam must be used within SteamProvider");
  return ctx;
}
