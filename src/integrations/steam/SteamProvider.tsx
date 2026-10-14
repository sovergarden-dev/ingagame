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
  confirmSteamConnect,
  startSteamConnect,
  syncSteamLibrary,
  toPublicSteamProfile,
  type SteamPublicProfile,
} from "./client";
import type { SteamLibrarySnapshot } from "./mock";

export type SteamStatus = "disconnected" | "connecting" | "connected" | "error";
export type SteamSyncStatus = "idle" | "syncing" | "synced" | "unavailable" | "failed";

export interface SteamValue {
  status: SteamStatus;
  snapshot: SteamLibrarySnapshot | null;
  publicProfile: SteamPublicProfile;
  errorCode: string | null;
  ownedGameIds: string[];
  ownedAppIds: number[] | null;
  syncStatus: SteamSyncStatus;
  lastSyncedAt: string | null;
  mock: boolean;
  owns: (gameId: string) => boolean;
  connect: (handle?: string) => Promise<void>;
  resync: () => Promise<void>;
  disconnect: () => void;
}

const SteamContext = createContext<SteamValue | null>(null);
const STORAGE_KEY = "gamepulse.steam";

function snapshotFromPublic(
  profile: SteamPublicProfile,
  appIds?: number[] | null,
  syncedAt?: string | null,
): SteamLibrarySnapshot | null {
  if (!profile.connected || !profile.steamId) return null;
  const ownedGames = (appIds ?? []).map((appId) => ({
    gameId: String(appId),
    playtimeMinutes: 0,
  }));
  return {
    profile: {
      steamId: profile.steamId,
      personaName: profile.personaName ?? profile.steamId,
      avatarUrl: profile.avatarUrl ?? "",
      profileUrl: `https://steamcommunity.com/profiles/${profile.steamId}`,
      countryCode: "",
    },
    ownedGames,
    wishlistGameIds: [],
    syncedAt: syncedAt ?? new Date().toISOString(),
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
  const [syncStatus, setSyncStatus] = useState<SteamSyncStatus>("idle");
  const [ownedAppIds, setOwnedAppIds] = useState<number[] | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

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
      setOwnedAppIds(null);
      setSyncStatus("idle");
      setLastSyncedAt(null);
      setStatus("disconnected");
      return;
    }
    const { data, error } = await supabase
      .from("steam_links")
      .select(STEAM_LINKS_PUBLIC_COLUMNS)
      .maybeSingle();
    if (error) {
      setSnapshot(null);
      setOwnedAppIds(null);
      setSyncStatus("idle");
      setLastSyncedAt(null);
      setStatus("disconnected");
      return;
    }
    const profile = toPublicSteamProfile((data as Record<string, unknown> | null) ?? null);
    let appIds: number[] | null = null;
    let syncState: SteamSyncStatus = "idle";
    let syncedAtIso: string | null = null;

    if (profile.connected) {
      const { data: cacheRow } = await supabase
        .from("steam_library_cache")
        .select("owned_app_ids, sync_status, synced_at")
        .maybeSingle();
      if (cacheRow) {
        const record = cacheRow as Record<string, unknown>;
        if (Array.isArray(record["owned_app_ids"])) {
          appIds = (record["owned_app_ids"] as unknown[]).map(Number);
        }
        if (typeof record["sync_status"] === "string") {
          syncState = record["sync_status"] as SteamSyncStatus;
        }
        if (typeof record["synced_at"] === "string") {
          syncedAtIso = record["synced_at"] as string;
        }
      }
    }

    setOwnedAppIds(appIds);
    setSyncStatus(syncState);
    setLastSyncedAt(syncedAtIso);
    const next = snapshotFromPublic(profile, appIds, syncedAtIso);
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
    const steam = params.get("steam");
    const ticket = params.get("ticket");
    if (steam !== "connected" && steam !== "pending" && steam !== "error") return;

    const strip = () => {
      params.delete("steam");
      params.delete("ticket");
      const search = params.toString();
      const next = `${window.location.pathname}${search ? `?${search}` : ""}${window.location.hash}`;
      window.history.replaceState(null, "", next);
    };

    if (steam === "error") {
      setErrorCode("start-failed");
      setStatus("error");
      strip();
      return;
    }

    if (steam === "pending") {
      const supabaseUrl = env.VITE_SUPABASE_URL;
      const publishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY;
      if (!ticket || !session?.access_token || !supabaseUrl || !publishableKey) {
        setErrorCode(session?.access_token ? "start-failed" : "sign-in-required");
        setStatus("error");
        return;
      }
      void (async () => {
        try {
          const profile = await confirmSteamConnect({
            ticket,
            accessToken: session.access_token,
            supabaseUrl,
            publishableKey,
          });
          const next = snapshotFromPublic(profile);
          setSnapshot(next);
          setStatus(next ? "connected" : "disconnected");
          setErrorCode(null);
          strip();
        } catch {
          setErrorCode("start-failed");
          setStatus("error");
        }
      })();
      return;
    }

    strip();
    void loadServerLink();
  }, [
    mock,
    loadServerLink,
    session?.access_token,
    env.VITE_SUPABASE_URL,
    env.VITE_SUPABASE_PUBLISHABLE_KEY,
  ]);

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
    const supabaseUrl = env.VITE_SUPABASE_URL;
    const publishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY;
    if (!session?.access_token || !supabaseUrl || !publishableKey) {
      setErrorCode("sign-in-required");
      return;
    }
    setSyncStatus("syncing");
    try {
      const result = await syncSteamLibrary({
        accessToken: session.access_token,
        supabaseUrl,
        publishableKey,
        force: true,
      });
      const nextStatus: SteamSyncStatus = result.status === "unlinked" ? "failed" : result.status;
      setSyncStatus(nextStatus);
      if (result.appIds) {
        setOwnedAppIds(result.appIds);
      }
      if (result.syncedAt) {
        setLastSyncedAt(result.syncedAt);
      }
      if (snapshot) {
        const updated = snapshotFromPublic(
          {
            connected: true,
            personaName: snapshot.profile.personaName,
            avatarUrl: snapshot.profile.avatarUrl,
            steamId: snapshot.profile.steamId,
          },
          result.appIds ?? ownedAppIds,
          result.syncedAt ?? lastSyncedAt,
        );
        if (updated) setSnapshot(updated);
      }
    } catch {
      setSyncStatus("failed");
      setErrorCode("sync-failed");
    }
  }, [
    mock,
    snapshot,
    connectMock,
    session?.access_token,
    env.VITE_SUPABASE_URL,
    env.VITE_SUPABASE_PUBLISHABLE_KEY,
    ownedAppIds,
    lastSyncedAt,
  ]);

  const disconnect = useCallback(() => {
    if (mock) {
      setSnapshot(null);
      setOwnedAppIds(null);
      setSyncStatus("idle");
      setLastSyncedAt(null);
      persistMock(null);
      setErrorCode(null);
      setStatus("disconnected");
      return;
    }
    void (async () => {
      if (user) {
        await supabase.from("steam_links").delete().eq("user_id", user.id);
        await supabase.from("steam_library_cache").delete().eq("user_id", user.id);
      }
      setSnapshot(null);
      setOwnedAppIds(null);
      setSyncStatus("idle");
      setLastSyncedAt(null);
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
      ownedAppIds,
      syncStatus,
      lastSyncedAt,
      mock,
      owns: (id) => {
        if (ownedGameIds.includes(id)) return true;
        if (ownedAppIds && ownedAppIds.length > 0) {
          const num = Number(id);
          if (Number.isSafeInteger(num) && num > 0) {
            return ownedAppIds.includes(num);
          }
        }
        return false;
      },
      connect,
      resync,
      disconnect,
    };
  }, [
    status,
    snapshot,
    errorCode,
    ownedAppIds,
    syncStatus,
    lastSyncedAt,
    mock,
    connect,
    resync,
    disconnect,
  ]);

  return <SteamContext.Provider value={value}>{children}</SteamContext.Provider>;
}

export function useSteam() {
  const ctx = useContext(SteamContext);
  if (!ctx) throw new Error("useSteam must be used within SteamProvider");
  return ctx;
}
