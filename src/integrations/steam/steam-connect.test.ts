import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  STEAM_OPENID_PROVIDER,
  extractSteamId,
  handleSteamConnect,
  isSteamOpenIdRedirect,
  publicSteamProfile,
  type SteamConnectDeps,
  type SteamLinkRecord,
} from "../../../supabase/functions/steam-connect/handler.ts";

const USER_ID = "11111111-1111-1111-1111-111111111111";
const STEAM_ID = "76561198000000000";
const RETURN_ORIGIN = "https://ingagame.lovable.app";
const SUPABASE_URL = "https://xtmejuuuqiuqawstptuy.supabase.co";
const API_KEY = "steam-web-api-key-not-for-browser";

function baseDeps(overrides: Partial<SteamConnectDeps> = {}): SteamConnectDeps {
  const nonces = new Map<
    string,
    { userId: string; returnOrigin: string; expiresAt: Date; consumed: boolean }
  >();
  const links = new Map<string, SteamLinkRecord>();

  const deps: SteamConnectDeps = {
    now: () => new Date("2026-09-07T12:00:00.000Z"),
    randomNonce: () => "nonce-fixed",
    env: {
      supabaseUrl: SUPABASE_URL,
      steamApiKey: API_KEY,
      returnOrigin: RETURN_ORIGIN,
    },
    getUser: async (jwt) => (jwt === "user-jwt" ? { id: USER_ID } : null),
    insertNonce: async (row) => {
      nonces.set(row.nonce, {
        userId: row.userId,
        returnOrigin: row.returnOrigin,
        expiresAt: new Date(row.expiresAt),
        consumed: false,
      });
    },
    consumeNonce: async (nonce, now) => {
      const row = nonces.get(nonce);
      if (!row || row.consumed || row.expiresAt <= now) return null;
      row.consumed = true;
      return { userId: row.userId, returnOrigin: row.returnOrigin };
    },
    upsertSteamLink: async (row) => {
      for (const existing of links.values()) {
        if (existing.steamId === row.steamId && existing.userId !== row.userId)
          return "steam_taken";
      }
      links.set(row.userId, row);
      return "ok";
    },
    verifyOpenId: async () => true,
    fetchPersona: async (steamId) => ({
      personaName: `persona-${steamId.slice(-4)}`,
      avatarUrl: `https://avatars.steamstatic.com/${steamId}.jpg`,
    }),
    ...overrides,
  };
  return deps;
}

function startRequest(init: RequestInit = {}) {
  return new Request(`${SUPABASE_URL}/functions/v1/steam-connect/start`, {
    method: "GET",
    headers: {
      Authorization: "Bearer user-jwt",
      apikey: "sb_publishable_test",
    },
    ...init,
  });
}

function callbackUrl(openid: Record<string, string> = {}) {
  const url = new URL(`${SUPABASE_URL}/functions/v1/steam-connect/callback`);
  url.searchParams.set("nonce", "nonce-fixed");
  url.searchParams.set("openid.ns", "http://specs.openid.net/auth/2.0");
  url.searchParams.set("openid.mode", "id_res");
  url.searchParams.set("openid.claimed_id", `https://steamcommunity.com/openid/id/${STEAM_ID}`);
  url.searchParams.set("openid.identity", `https://steamcommunity.com/openid/id/${STEAM_ID}`);
  url.searchParams.set("openid.return_to", url.toString());
  for (const [key, value] of Object.entries(openid)) url.searchParams.set(key, value);
  return url;
}

describe("extractSteamId / isSteamOpenIdRedirect", () => {
  it("reads SteamID64 from the Steam OpenID claimed_id", () => {
    assert.equal(extractSteamId(`https://steamcommunity.com/openid/id/${STEAM_ID}`), STEAM_ID);
    assert.equal(extractSteamId("https://evil.example/openid/id/76561198000000000"), null);
    assert.equal(extractSteamId("not-a-url"), null);
  });

  it("accepts only Steam OpenID login redirects", () => {
    assert.equal(isSteamOpenIdRedirect(`${STEAM_OPENID_PROVIDER}?openid.mode=checkid_setup`), true);
    assert.equal(isSteamOpenIdRedirect("https://evil.example/openid/login"), false);
    assert.equal(isSteamOpenIdRedirect(`${STEAM_OPENID_PROVIDER}?next=https://evil.example`), true);
  });
});

describe("publicSteamProfile", () => {
  it("exposes only connected + public fields", () => {
    assert.deepEqual(
      publicSteamProfile({
        userId: USER_ID,
        steamId: STEAM_ID,
        personaName: "Ada",
        avatarUrl: "https://a",
      }),
      { connected: true, personaName: "Ada", avatarUrl: "https://a", steamId: STEAM_ID },
    );
  });
});

describe("handleSteamConnect start", () => {
  it("answers OPTIONS with CORS and rejects unauthenticated start", async () => {
    const preflight = await handleSteamConnect(
      new Request(`${SUPABASE_URL}/functions/v1/steam-connect/start`, { method: "OPTIONS" }),
      baseDeps(),
    );
    assert.equal(preflight.status, 200);
    assert.equal(preflight.headers.get("Access-Control-Allow-Origin"), "*");
    assert.match(preflight.headers.get("Access-Control-Allow-Headers") ?? "", /authorization/i);

    const anon = await handleSteamConnect(
      new Request(`${SUPABASE_URL}/functions/v1/steam-connect/start`, { method: "GET" }),
      baseDeps(),
    );
    assert.equal(anon.status, 401);
    const body = await anon.text();
    assert.equal(body.includes(API_KEY), false);
    assert.match(body, /sign_in_required/);
  });

  it("redirects to Steam OpenID without leaking the API key", async () => {
    const response = await handleSteamConnect(startRequest(), baseDeps());
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    const location = response.headers.get("Location");
    assert.ok(location);
    assert.equal(isSteamOpenIdRedirect(location), true);
    const steamUrl = new URL(location);
    assert.equal(steamUrl.searchParams.get("openid.mode"), "checkid_setup");
    const returnTo = steamUrl.searchParams.get("openid.return_to") ?? "";
    assert.match(returnTo, /\/functions\/v1\/steam-connect\/callback/);
    assert.match(returnTo, /nonce=nonce-fixed/);
    assert.equal(location.includes(API_KEY), false);

    const body = (await response.json()) as { redirectUrl: string };
    assert.equal(body.redirectUrl, location);
    assert.equal(JSON.stringify(body).includes(API_KEY), false);
    assert.equal(JSON.stringify(body).includes("user-jwt"), false);
  });
});

describe("handleSteamConnect callback", () => {
  it("verifies OpenID, stores the link, and redirects to the app origin", async () => {
    const stored: SteamLinkRecord[] = [];
    const verified: URLSearchParams[] = [];
    const deps = baseDeps({
      upsertSteamLink: async (row) => {
        stored.push(row);
        return "ok";
      },
      verifyOpenId: async (params) => {
        verified.push(params);
        return params.get("openid.mode") === "check_authentication";
      },
    });
    await handleSteamConnect(startRequest(), deps);

    const response = await handleSteamConnect(new Request(callbackUrl()), deps);
    assert.equal(response.status, 302);
    assert.equal(response.headers.get("Location"), `${RETURN_ORIGIN}/settings?steam=connected`);
    assert.equal(verified.length, 1);
    assert.equal(stored.length, 1);
    assert.equal(stored[0]?.userId, USER_ID);
    assert.equal(stored[0]?.steamId, STEAM_ID);
    assert.equal(stored[0]?.personaName, "persona-0000");
    const body = await response.text();
    assert.equal(body.includes(API_KEY), false);
  });

  it("rejects an unverified OpenID assertion", async () => {
    const deps = baseDeps({ verifyOpenId: async () => false });
    await handleSteamConnect(startRequest(), deps);
    const response = await handleSteamConnect(new Request(callbackUrl()), deps);
    assert.equal(response.status, 401);
    const payload = (await response.json()) as { error: string };
    assert.equal(payload.error, "openid_invalid");
  });
});

describe("handleSteamConnect sync stub", () => {
  it("does not call the Steam Web API for library sync", async () => {
    let personaCalls = 0;
    const deps = baseDeps({
      fetchPersona: async () => {
        personaCalls += 1;
        return { personaName: null, avatarUrl: null };
      },
    });
    const response = await handleSteamConnect(
      new Request(`${SUPABASE_URL}/functions/v1/steam-connect/sync`, {
        method: "POST",
        headers: { Authorization: "Bearer user-jwt" },
      }),
      deps,
    );
    assert.equal(response.status, 501);
    const payload = (await response.json()) as { error: string };
    assert.equal(payload.error, "library_sync_not_implemented");
    assert.equal(personaCalls, 0);
  });
});
