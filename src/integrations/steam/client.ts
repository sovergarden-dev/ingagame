export class SteamConnectError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SteamConnectError";
  }
}

export const STEAM_LINKS_PUBLIC_COLUMNS = "steam_id, persona_name, avatar_url";

export type SteamPublicProfile = {
  connected: boolean;
  personaName: string | null;
  avatarUrl: string | null;
  steamId: string | null;
};

export type SteamLinkPublicRow = {
  steam_id: string;
  persona_name: string | null;
  avatar_url: string | null;
};

export type ViteSteamEnv = {
  DEV?: boolean;
  PROD?: boolean;
  VITE_STEAM_MOCK?: string;
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_PUBLISHABLE_KEY?: string;
};

export function allowMockSteam(env: ViteSteamEnv = {}): boolean {
  if (env.DEV !== true) return false;
  if (env.VITE_STEAM_MOCK === "0") return false;
  return true;
}

export function toPublicSteamProfile(row: Record<string, unknown> | null): SteamPublicProfile {
  const parsed = parseSteamLinkRow(row);
  if (!parsed) {
    return { connected: false, personaName: null, avatarUrl: null, steamId: null };
  }
  return {
    connected: true,
    personaName: parsed.persona_name,
    avatarUrl: parsed.avatar_url,
    steamId: parsed.steam_id,
  };
}

export function parseSteamLinkRow(row: unknown): SteamLinkPublicRow | null {
  if (!row || typeof row !== "object") return null;
  const record = row as { steam_id?: unknown; persona_name?: unknown; avatar_url?: unknown };
  if (typeof record.steam_id !== "string" || record.steam_id.length === 0) return null;
  return {
    steam_id: record.steam_id,
    persona_name: typeof record.persona_name === "string" ? record.persona_name : null,
    avatar_url: typeof record.avatar_url === "string" ? record.avatar_url : null,
  };
}

export function steamConnectStartUrl(baseUrl: string): string {
  const root = baseUrl.replace(/\/$/, "");
  return `${root}/functions/v1/steam-connect/start`;
}

export function steamConnectSyncUrl(baseUrl: string): string {
  const root = baseUrl.replace(/\/$/, "");
  return `${root}/functions/v1/steam-connect/sync`;
}

export function steamConnectConfirmUrl(baseUrl: string): string {
  const root = baseUrl.replace(/\/$/, "");
  return `${root}/functions/v1/steam-connect/confirm`;
}

export function isSteamOpenIdRedirect(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname === "steamcommunity.com" &&
      url.pathname === "/openid/login"
    );
  } catch {
    return false;
  }
}

export type StartSteamConnectOptions = {
  accessToken: string;
  supabaseUrl: string;
  publishableKey: string;
  fetch?: typeof fetch;
  assign?: (url: string) => void;
};

export async function startSteamConnect(options: StartSteamConnectOptions): Promise<void> {
  const response = await (options.fetch ?? fetch)(steamConnectStartUrl(options.supabaseUrl), {
    method: "GET",
    redirect: "manual",
    headers: {
      Authorization: `Bearer ${options.accessToken}`,
      apikey: options.publishableKey,
    },
  });

  let redirectUrl = response.headers.get("Location");
  const json: unknown = await response.json().catch(() => null);
  if (
    json &&
    typeof json === "object" &&
    typeof (json as { redirectUrl?: unknown }).redirectUrl === "string"
  ) {
    redirectUrl = (json as { redirectUrl: string }).redirectUrl;
  }

  if (!redirectUrl || !isSteamOpenIdRedirect(redirectUrl)) {
    throw new SteamConnectError("start_failed");
  }

  const assign = options.assign ?? ((url: string) => window.location.assign(url));
  assign(redirectUrl);
}

export type ConfirmSteamConnectOptions = {
  ticket: string;
  accessToken: string;
  supabaseUrl: string;
  publishableKey: string;
  fetch?: typeof fetch;
};

export async function confirmSteamConnect(
  options: ConfirmSteamConnectOptions,
): Promise<SteamPublicProfile> {
  const response = await (options.fetch ?? fetch)(steamConnectConfirmUrl(options.supabaseUrl), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.accessToken}`,
      apikey: options.publishableKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ticket: options.ticket }),
  });
  const json: unknown = await response.json().catch(() => null);
  if (!response.ok || !json || typeof json !== "object") {
    throw new SteamConnectError("start_failed");
  }
  const profile = toPublicSteamProfile({
    steam_id: (json as { steamId?: unknown }).steamId,
    persona_name: (json as { personaName?: unknown }).personaName,
    avatar_url: (json as { avatarUrl?: unknown }).avatarUrl,
  });
  if (!profile.connected) throw new SteamConnectError("start_failed");
  return profile;
}

export type SteamLibrarySyncResult = {
  cached: boolean;
  status: "synced" | "unavailable" | "failed" | "unlinked";
  appIds: number[] | null;
  syncedAt?: string | null | undefined;
  cooldown?: boolean | undefined;
  retryAfterSeconds?: number | undefined;
  gameCount?: number | undefined;
  message?: string | undefined;
};

export type SyncSteamLibraryOptions = {
  accessToken: string;
  supabaseUrl: string;
  publishableKey: string;
  force?: boolean | undefined;
  fetch?: typeof fetch | undefined;
};

export async function syncSteamLibrary(
  options: SyncSteamLibraryOptions,
): Promise<SteamLibrarySyncResult> {
  const url = steamConnectSyncUrl(options.supabaseUrl);
  const response = await (options.fetch ?? fetch)(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.accessToken}`,
      apikey: options.publishableKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ force: Boolean(options.force) }),
  });

  const json: unknown = await response.json().catch(() => null);
  if (!json || typeof json !== "object") {
    throw new SteamConnectError("sync_failed");
  }

  const record = json as Record<string, unknown>;

  if (response.status === 404 && record["error"] === "steam_not_linked") {
    return {
      cached: false,
      status: "unlinked",
      appIds: null,
    };
  }

  if (response.status === 401) {
    throw new SteamConnectError("sign_in_required");
  }

  if (response.status === 502) {
    return {
      cached: false,
      status: "failed",
      appIds: Array.isArray(record["appIds"]) ? (record["appIds"] as unknown[]).map(Number) : null,
      syncedAt: typeof record["syncedAt"] === "string" ? record["syncedAt"] : null,
    };
  }

  if (!response.ok) {
    throw new SteamConnectError("sync_failed");
  }

  return {
    cached: Boolean(record["cached"]),
    status: (record["status"] as "synced" | "unavailable" | "failed") ?? "synced",
    appIds: Array.isArray(record["appIds"]) ? (record["appIds"] as unknown[]).map(Number) : null,
    syncedAt: typeof record["syncedAt"] === "string" ? record["syncedAt"] : null,
    cooldown: Boolean(record["cooldown"]),
    retryAfterSeconds:
      typeof record["retryAfterSeconds"] === "number" ? record["retryAfterSeconds"] : undefined,
    gameCount: typeof record["gameCount"] === "number" ? record["gameCount"] : undefined,
    message: typeof record["message"] === "string" ? record["message"] : undefined,
  };
}
