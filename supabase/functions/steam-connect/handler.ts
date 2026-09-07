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
    ticket: string;
    returnOrigin: string;
    expiresAt: string;
  }) => Promise<void>;
  attachPendingSteam: (
    nonce: string,
    now: Date,
    pending: { steamId: string; personaName: string | null; avatarUrl: string | null },
  ) => Promise<{ ticket: string; returnOrigin: string } | null>;
  confirmSteamLink: (
    ticket: string,
    userId: string,
    now: Date,
  ) => Promise<{
    steamId: string;
    personaName: string | null;
    avatarUrl: string | null;
  } | null>;
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

export function steamConnectCallbackUrl(supabaseUrl: string): string {
  return `${supabaseUrl.replace(/\/$/, "")}/functions/v1/steam-connect/callback`;
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

export function signedFieldsInclude(signed: string | null, field: string): boolean {
  if (!signed) return false;
  return signed
    .split(",")
    .map((part) => part.trim())
    .includes(field);
}

export function returnToMatchesCallback(returnTo: string, expectedCallback: string): boolean {
  try {
    const got = new URL(returnTo);
    const expected = new URL(expectedCallback);
    return got.origin === expected.origin && got.pathname === expected.pathname;
  } catch {
    return false;
  }
}

/** Nonce lives only on signed openid.return_to — never the unsigned callback query. */
export function readNonceFromReturnTo(returnTo: string | null): string | null {
  if (!returnTo) return null;
  try {
    return new URL(returnTo).searchParams.get("nonce");
  } catch {
    return null;
  }
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
    redirect: "error",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok) return false;
  const text = await response.text();
  return /^is_valid:true$/m.test(text);
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
  const response = await fetchImpl(url, { redirect: "error" });
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

export function routeSteamConnect(url: URL): "start" | "callback" | "sync" | "confirm" | null {
  const path = url.pathname.replace(/\/+$/, "");
  if (path.endsWith("/start") || url.searchParams.get("step") === "start") return "start";
  if (path.endsWith("/callback") || url.searchParams.get("step") === "callback") return "callback";
  if (path.endsWith("/sync") || url.searchParams.get("step") === "sync") return "sync";
  if (path.endsWith("/confirm") || url.searchParams.get("step") === "confirm") return "confirm";
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

function appRedirect(returnOrigin: string, params: Record<string, string>): Response {
  const dest = new URL(SETTINGS_PATH, `${returnOrigin}/`);
  for (const [key, value] of Object.entries(params)) dest.searchParams.set(key, value);
  return new Response(null, {
    status: 302,
    headers: {
      ...corsHeaders(),
      Location: dest.toString(),
      "Cache-Control": "no-store",
    },
  });
}

function fallbackOrigin(deps: SteamConnectDeps): string {
  return originOf(deps.env.returnOrigin) ?? "https://invalid.local";
}

function openidCheckParams(url: URL): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of url.searchParams.entries()) {
    if (key.startsWith("openid.")) params.set(key, value);
  }
  params.set("openid.mode", "check_authentication");
  return params;
}

function assertionLooksSigned(url: URL): boolean {
  const signed = url.searchParams.get("openid.signed");
  if (!signed) return true;
  return (
    signedFieldsInclude(signed, "claimed_id") &&
    signedFieldsInclude(signed, "identity") &&
    signedFieldsInclude(signed, "return_to")
  );
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
  const ticket = deps.randomNonce();
  const expiresAt = new Date(deps.now().getTime() + NONCE_TTL_MS).toISOString();
  await deps.insertNonce({
    userId: user.id,
    nonce,
    ticket,
    returnOrigin,
    expiresAt,
  });

  const returnTo = new URL(steamConnectCallbackUrl(deps.env.supabaseUrl));
  returnTo.searchParams.set("nonce", nonce);
  const redirectUrl = buildSteamOpenIdRedirect({
    realm,
    returnTo: returnTo.toString(),
  });

  return jsonResponse({ redirectUrl }, 200, { Location: redirectUrl });
}

async function handleCallback(req: Request, deps: SteamConnectDeps): Promise<Response> {
  const fallback = fallbackOrigin(deps);
  if (req.method !== "GET") return appRedirect(fallback, { steam: "error" });

  const url = new URL(req.url);
  if (url.searchParams.get("openid.mode") !== "id_res") {
    return appRedirect(fallback, { steam: "error" });
  }

  const claimedId = url.searchParams.get("openid.claimed_id");
  const identity = url.searchParams.get("openid.identity");
  const steamId = extractSteamId(claimedId);
  const identityId = extractSteamId(identity);
  if (!steamId || !identityId || steamId !== identityId) {
    return appRedirect(fallback, { steam: "error" });
  }

  const returnTo = url.searchParams.get("openid.return_to");
  const expectedCallback = steamConnectCallbackUrl(deps.env.supabaseUrl);
  if (!returnTo || !returnToMatchesCallback(returnTo, expectedCallback)) {
    return appRedirect(fallback, { steam: "error" });
  }
  if (!assertionLooksSigned(url)) return appRedirect(fallback, { steam: "error" });

  const valid = await deps.verifyOpenId(openidCheckParams(url));
  if (!valid) return appRedirect(fallback, { steam: "error" });

  const nonce = readNonceFromReturnTo(returnTo);
  if (!nonce) return appRedirect(fallback, { steam: "error" });

  let personaName: string | null = null;
  let avatarUrl: string | null = null;
  try {
    const persona = await deps.fetchPersona(steamId);
    personaName = persona.personaName;
    avatarUrl = persona.avatarUrl;
  } catch {
    /* persona is optional in P0c; steam_id is enough */
  }

  const pending = await deps.attachPendingSteam(nonce, deps.now(), {
    steamId,
    personaName,
    avatarUrl,
  });
  if (!pending) return appRedirect(fallback, { steam: "error" });

  const allowed = originOf(deps.env.returnOrigin) ?? pending.returnOrigin;
  return appRedirect(allowed, { steam: "pending", ticket: pending.ticket });
}

async function handleConfirm(req: Request, deps: SteamConnectDeps): Promise<Response> {
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);
  const jwt = bearerToken(req);
  if (!jwt) return jsonResponse({ error: "sign_in_required" }, 401);
  const user = await deps.getUser(jwt);
  if (!user) return jsonResponse({ error: "sign_in_required" }, 401);

  let ticket = "";
  try {
    const json: unknown = await req.json();
    if (
      json &&
      typeof json === "object" &&
      typeof (json as { ticket?: unknown }).ticket === "string"
    ) {
      ticket = (json as { ticket: string }).ticket;
    }
  } catch {
    ticket = "";
  }
  if (!ticket) return jsonResponse({ error: "ticket_invalid" }, 401);

  const pending = await deps.confirmSteamLink(ticket, user.id, deps.now());
  if (!pending) return jsonResponse({ error: "ticket_invalid" }, 401);

  const result = await deps.upsertSteamLink({
    userId: user.id,
    steamId: pending.steamId,
    personaName: pending.personaName,
    avatarUrl: pending.avatarUrl,
  });
  if (result === "steam_taken") return jsonResponse({ error: "steam_taken" }, 409);

  return jsonResponse(
    publicSteamProfile({
      userId: user.id,
      steamId: pending.steamId,
      personaName: pending.personaName,
      avatarUrl: pending.avatarUrl,
    }),
    200,
  );
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
    if (route === "confirm") return await handleConfirm(req, deps);
    if (route === "sync") return await handleSync(req, deps);
    return jsonResponse({ error: "not_found" }, 404);
  } catch {
    return jsonResponse({ error: "steam_unavailable" }, 500);
  }
}
