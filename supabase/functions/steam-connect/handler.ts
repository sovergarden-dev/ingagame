export const STEAM_OPENID_PROVIDER = "https://steamcommunity.com/openid/login";
export const STEAM_OPENID_NS = "http://specs.openid.net/auth/2.0";
export const STEAM_IDENTIFIER_SELECT = "http://specs.openid.net/auth/2.0/identifier_select";
export const NONCE_TTL_MS = 10 * 60 * 1000;
export const SETTINGS_PATH = "/settings";

const STEAM_CLAIMED_ID = /^https?:\/\/steamcommunity\.com\/openid\/id\/(7656119\d{10})$/;

export type SteamPublicProfile = {
  connected: boolean;
  personaName: string | null;
  avatarUrl: string | null;
  steamId: string | null;
};

export type SteamLinkRecord = {
  userId: string;
  steamId: string;
  personaName: string | null;
  avatarUrl: string | null;
};

export type SteamConnectEnv = {
  supabaseUrl: string;
  steamApiKey: string | null;
  returnOrigin: string;
};

export type SteamConnectDeps = {
  now: () => Date;
  randomNonce: () => string;
  env: SteamConnectEnv;
  getUser: (jwt: string) => Promise<{ id: string } | null>;
  insertNonce: (row: {
    userId: string;
    nonce: string;
    returnOrigin: string;
    expiresAt: string;
  }) => Promise<void>;
  consumeNonce: (
    nonce: string,
    now: Date,
  ) => Promise<{ userId: string; returnOrigin: string } | null>;
  upsertSteamLink: (row: SteamLinkRecord) => Promise<"ok" | "steam_taken">;
  verifyOpenId: (params: URLSearchParams) => Promise<boolean>;
  fetchPersona: (
    steamId: string,
  ) => Promise<{ personaName: string | null; avatarUrl: string | null }>;
};

export function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Expose-Headers": "Location",
  };
}

export function extractSteamId(claimedId: string | null | undefined): string | null {
  if (!claimedId) return null;
  const match = claimedId.trim().match(STEAM_CLAIMED_ID);
  return match?.[1] ?? null;
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

export function publicSteamProfile(row: SteamLinkRecord | null): SteamPublicProfile {
  if (!row?.steamId) {
    return { connected: false, personaName: null, avatarUrl: null, steamId: null };
  }
  return {
    connected: true,
    personaName: row.personaName,
    avatarUrl: row.avatarUrl,
    steamId: row.steamId,
  };
}

export function buildSteamOpenIdRedirect(opts: { realm: string; returnTo: string }): string {
  const url = new URL(STEAM_OPENID_PROVIDER);
  url.searchParams.set("openid.ns", STEAM_OPENID_NS);
  url.searchParams.set("openid.mode", "checkid_setup");
  url.searchParams.set("openid.return_to", opts.returnTo);
  url.searchParams.set("openid.realm", opts.realm);
  url.searchParams.set("openid.identity", STEAM_IDENTIFIER_SELECT);
  url.searchParams.set("openid.claimed_id", STEAM_IDENTIFIER_SELECT);
  return url.toString();
}

export async function verifySteamOpenId(
  params: URLSearchParams,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  const body = new URLSearchParams();
  for (const [key, value] of params.entries()) {
    if (key.startsWith("openid.")) body.set(key, value);
  }
  body.set("openid.mode", "check_authentication");
  const response = await fetchImpl(STEAM_OPENID_PROVIDER, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok) return false;
  const text = await response.text();
  return /is_valid\s*:\s*true/.test(text);
}

export async function fetchSteamPersona(
  steamId: string,
  apiKey: string | null,
  fetchImpl: typeof fetch = fetch,
): Promise<{ personaName: string | null; avatarUrl: string | null }> {
  if (!apiKey) return { personaName: null, avatarUrl: null };
  const url = new URL("https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/");
  url.searchParams.set("key", apiKey);
  url.searchParams.set("steamids", steamId);
  const response = await fetchImpl(url);
  if (!response.ok) return { personaName: null, avatarUrl: null };
  const json: unknown = await response.json().catch(() => null);
  const player = readPlayer(json);
  return {
    personaName: typeof player?.personaname === "string" ? player.personaname : null,
    avatarUrl: typeof player?.avatarfull === "string" ? player.avatarfull : null,
  };
}

function readPlayer(json: unknown): { personaname?: unknown; avatarfull?: unknown } | null {
  if (!json || typeof json !== "object") return null;
  const response = (json as { response?: { players?: unknown } }).response;
  const players = response?.players;
  if (!Array.isArray(players) || !players[0] || typeof players[0] !== "object") return null;
  return players[0] as { personaname?: unknown; avatarfull?: unknown };
}

export function routeSteamConnect(url: URL): "start" | "callback" | "sync" | null {
  const path = url.pathname.replace(/\/+$/, "");
  if (path.endsWith("/start") || url.searchParams.get("step") === "start") return "start";
  if (path.endsWith("/callback") || url.searchParams.get("step") === "callback") return "callback";
  if (path.endsWith("/sync") || url.searchParams.get("step") === "sync") return "sync";
  if (url.searchParams.get("openid.mode") === "id_res") return "callback";
  if (path.endsWith("/steam-connect")) return "start";
  return null;
}

function bearerToken(req: Request): string | null {
  const raw = req.headers.get("Authorization");
  if (!raw) return null;
  const match = raw.match(/^Bearer\s+(\S+)/i);
  const token = match?.[1] ?? null;
  if (!token || token.startsWith("sb_publishable_") || token.startsWith("sb_secret_")) return null;
  return token;
}

function jsonResponse(body: unknown, status: number, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(),
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...extra,
    },
  });
}

function originOf(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function readNonce(url: URL): string | null {
  const direct = url.searchParams.get("nonce");
  if (direct) return direct;
  const returnTo = url.searchParams.get("openid.return_to");
  if (!returnTo) return null;
  try {
    return new URL(returnTo).searchParams.get("nonce");
  } catch {
    return null;
  }
}

function openidCheckParams(url: URL): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of url.searchParams.entries()) {
    if (key.startsWith("openid.")) params.set(key, value);
  }
  params.set("openid.mode", "check_authentication");
  return params;
}

async function handleStart(req: Request, deps: SteamConnectDeps): Promise<Response> {
  if (req.method !== "GET" && req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  const jwt = bearerToken(req);
  if (!jwt) return jsonResponse({ error: "sign_in_required" }, 401);

  const user = await deps.getUser(jwt);
  if (!user) return jsonResponse({ error: "sign_in_required" }, 401);

  const realm = originOf(deps.env.supabaseUrl);
  const returnOrigin = originOf(deps.env.returnOrigin);
  if (!realm || !returnOrigin) return jsonResponse({ error: "not_configured" }, 500);

  const nonce = deps.randomNonce();
  const expiresAt = new Date(deps.now().getTime() + NONCE_TTL_MS).toISOString();
  await deps.insertNonce({
    userId: user.id,
    nonce,
    returnOrigin,
    expiresAt,
  });

  const returnTo = new URL(
    `${deps.env.supabaseUrl.replace(/\/$/, "")}/functions/v1/steam-connect/callback`,
  );
  returnTo.searchParams.set("nonce", nonce);
  const redirectUrl = buildSteamOpenIdRedirect({
    realm,
    returnTo: returnTo.toString(),
  });

  return jsonResponse({ redirectUrl }, 200, { Location: redirectUrl });
}

async function handleCallback(req: Request, deps: SteamConnectDeps): Promise<Response> {
  if (req.method !== "GET") return jsonResponse({ error: "method_not_allowed" }, 405);

  const url = new URL(req.url);
  const claimedId =
    url.searchParams.get("openid.claimed_id") ?? url.searchParams.get("openid.identity");
  const steamId = extractSteamId(claimedId);
  if (!steamId) return jsonResponse({ error: "openid_invalid" }, 401);

  const valid = await deps.verifyOpenId(openidCheckParams(url));
  if (!valid) return jsonResponse({ error: "openid_invalid" }, 401);

  const nonce = readNonce(url);
  if (!nonce) return jsonResponse({ error: "nonce_invalid" }, 401);
  const bound = await deps.consumeNonce(nonce, deps.now());
  if (!bound) return jsonResponse({ error: "nonce_invalid" }, 401);

  let personaName: string | null = null;
  let avatarUrl: string | null = null;
  try {
    const persona = await deps.fetchPersona(steamId);
    personaName = persona.personaName;
    avatarUrl = persona.avatarUrl;
  } catch {
    /* persona is optional in P0c; steam_id is enough */
  }

  const result = await deps.upsertSteamLink({
    userId: bound.userId,
    steamId,
    personaName,
    avatarUrl,
  });
  if (result === "steam_taken") return jsonResponse({ error: "steam_taken" }, 409);

  const allowed = originOf(deps.env.returnOrigin) ?? bound.returnOrigin;
  const dest = new URL(SETTINGS_PATH, `${allowed}/`);
  dest.searchParams.set("steam", "connected");
  return new Response(null, {
    status: 302,
    headers: {
      ...corsHeaders(),
      Location: dest.toString(),
      "Cache-Control": "no-store",
    },
  });
}

async function handleSync(req: Request, deps: SteamConnectDeps): Promise<Response> {
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);
  const jwt = bearerToken(req);
  if (!jwt) return jsonResponse({ error: "sign_in_required" }, 401);
  const user = await deps.getUser(jwt);
  if (!user) return jsonResponse({ error: "sign_in_required" }, 401);
  return jsonResponse({ error: "library_sync_not_implemented" }, 501);
}

export async function handleSteamConnect(req: Request, deps: SteamConnectDeps): Promise<Response> {
  try {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders() });
    }

    const route = routeSteamConnect(new URL(req.url));
    if (route === "start") return await handleStart(req, deps);
    if (route === "callback") return await handleCallback(req, deps);
    if (route === "sync") return await handleSync(req, deps);
    return jsonResponse({ error: "not_found" }, 404);
  } catch {
    return jsonResponse({ error: "steam_unavailable" }, 500);
  }
}
