import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  STEAM_OPENID_PROVIDER,
  extractSteamId,
  handleSteamConnect,
  isSteamOpenIdRedirect,
  publicSteamProfile,
  readNonceFromReturnTo,
  returnToMatchesCallback,
  steamConnectCallbackUrl,
  verifySteamOpenId,
  type SteamConnectDeps,
  type SteamLinkRecord,
} from "../../../supabase/functions/steam-connect/handler.ts";

const USER_ID = "11111111-1111-1111-1111-111111111111";
const OTHER_USER = "22222222-2222-2222-2222-222222222222";
const STEAM_ID = "76561198000000000";
const RETURN_ORIGIN = "https://ingagame.lovable.app";
const SUPABASE_URL = "https://xtmejuuuqiuqawstptuy.supabase.co";
const API_KEY = "steam-web-api-key-not-for-browser";

type NonceRow = {
  userId: string;
  ticket: string;
  returnOrigin: string;
  expiresAt: Date;
  consumed: boolean;
  steamId: string | null;
  personaName: string | null;
  avatarUrl: string | null;
};

function baseDeps(overrides: Partial<SteamConnectDeps> = {}): SteamConnectDeps {
  const byNonce = new Map<string, NonceRow>();
  const links = new Map<string, SteamLinkRecord>();
  let nonceCalls = 0;

  const deps: SteamConnectDeps = {
    now: () => new Date("2026-09-07T12:00:00.000Z"),
    randomNonce: () => {
      nonceCalls += 1;
      return nonceCalls === 1 ? "nonce-fixed" : "ticket-fixed";
    },
    env: {
      supabaseUrl: SUPABASE_URL,
      steamApiKey: API_KEY,
      returnOrigin: RETURN_ORIGIN,
    },
    getUser: async (jwt) => {
      if (jwt === "user-jwt") return { id: USER_ID };
      if (jwt === "other-jwt") return { id: OTHER_USER };
      return null;
    },
    insertNonce: async (row) => {
      byNonce.set(row.nonce, {
        userId: row.userId,
        ticket: row.ticket,
        returnOrigin: row.returnOrigin,
        expiresAt: new Date(row.expiresAt),
        consumed: false,
        steamId: null,
        personaName: null,
        avatarUrl: null,
      });
    },
    attachPendingSteam: async (nonce, now, pending) => {
      const row = byNonce.get(nonce);
      if (!row || row.consumed || row.expiresAt <= now) return null;
      row.steamId = pending.steamId;
      row.personaName = pending.personaName;
      row.avatarUrl = pending.avatarUrl;
      return { ticket: row.ticket, returnOrigin: row.returnOrigin };
    },
    confirmSteamLink: async (ticket, userId, now) => {
      for (const row of byNonce.values()) {
        if (row.ticket !== ticket) continue;
        if (row.userId !== userId || row.consumed || row.expiresAt <= now || !row.steamId) {
          return null;
        }
        row.consumed = true;
        return {
          steamId: row.steamId,
          personaName: row.personaName,
          avatarUrl: row.avatarUrl,
        };
      }
      return null;
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

function startRequest(jwt = "user-jwt") {
  return new Request(`${SUPABASE_URL}/functions/v1/steam-connect/start`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${jwt}`,
      apikey: "sb_publishable_test",
    },
  });
}

function callbackUrl(openid: Record<string, string> = {}) {
  const returnTo = new URL(steamConnectCallbackUrl(SUPABASE_URL));
  returnTo.searchParams.set("nonce", "nonce-fixed");
  const url = new URL(steamConnectCallbackUrl(SUPABASE_URL));
  url.searchParams.set("nonce", "attacker-nonce");
  url.searchParams.set("openid.ns", "http://specs.openid.net/auth/2.0");
  url.searchParams.set("openid.mode", "id_res");
  url.searchParams.set("openid.claimed_id", `https://steamcommunity.com/openid/id/${STEAM_ID}`);
  url.searchParams.set("openid.identity", `https://steamcommunity.com/openid/id/${STEAM_ID}`);
  url.searchParams.set("openid.return_to", returnTo.toString());
  url.searchParams.set("openid.signed", "claimed_id,identity,return_to");
  for (const [key, value] of Object.entries(openid)) url.searchParams.set(key, value);
  return url;
}

function confirmRequest(ticket: string, jwt = "user-jwt") {
  return new Request(`${SUPABASE_URL}/functions/v1/steam-connect/confirm`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ticket }),
  });
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

describe("return_to / nonce binding", () => {
  it("reads the nonce only from openid.return_to", () => {
    const returnTo = `${steamConnectCallbackUrl(SUPABASE_URL)}?nonce=nonce-fixed`;
    assert.equal(readNonceFromReturnTo(returnTo), "nonce-fixed");
    assert.equal(returnToMatchesCallback(returnTo, steamConnectCallbackUrl(SUPABASE_URL)), true);
    assert.equal(
      returnToMatchesCallback(
        "https://evil.example/callback?nonce=nonce-fixed",
        steamConnectCallbackUrl(SUPABASE_URL),
      ),
      false,
    );
  });
});

describe("verifySteamOpenId", () => {
  it("requires a full is_valid:true line and does not follow redirects", async () => {
    const calls: RequestRedirect[] = [];
    const ok = await verifySteamOpenId(
      new URLSearchParams({ "openid.mode": "id_res" }),
      async (_url, init) => {
        calls.push(init?.redirect ?? "follow");
        return new Response("ns:http://specs.openid.net/auth/2.0\nis_valid:true\n", {
          status: 200,
        });
      },
    );
    assert.equal(ok, true);
    assert.deepEqual(calls, ["error"]);

    const bad = await verifySteamOpenId(new URLSearchParams(), async () => {
      return new Response("is_valid : true", { status: 200 });
    });
    assert.equal(bad, false);
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

describe("handleSteamConnect callback + confirm", () => {
  it("does not upsert until the signed-in user confirms the ticket", async () => {
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

    const callback = await handleSteamConnect(new Request(callbackUrl()), deps);
    assert.equal(callback.status, 302);
    assert.equal(
      callback.headers.get("Location"),
      `${RETURN_ORIGIN}/settings?steam=pending&ticket=ticket-fixed`,
    );
    assert.equal(verified.length, 1);
    assert.equal(stored.length, 0);
    assert.equal((await callback.text()).includes(API_KEY), false);

    const csrf = await handleSteamConnect(confirmRequest("ticket-fixed", "other-jwt"), deps);
    assert.equal(csrf.status, 401);
    assert.equal(stored.length, 0);

    const confirmed = await handleSteamConnect(confirmRequest("ticket-fixed"), deps);
    assert.equal(confirmed.status, 200);
    const profile = (await confirmed.json()) as Record<string, unknown>;
    assert.deepEqual(profile, {
      connected: true,
      personaName: "persona-0000",
      avatarUrl: `https://avatars.steamstatic.com/${STEAM_ID}.jpg`,
      steamId: STEAM_ID,
    });
    assert.equal(stored.length, 1);
    assert.equal(stored[0]?.userId, USER_ID);
    assert.equal(JSON.stringify(profile).includes(API_KEY), false);
  });

  it("ignores an unsigned nonce query param and rejects a mismatched return_to", async () => {
    const deps = baseDeps();
    await handleSteamConnect(startRequest(), deps);

    const swapped = callbackUrl();
    assert.equal(swapped.searchParams.get("nonce"), "attacker-nonce");
    const okPending = await handleSteamConnect(new Request(swapped), deps);
    assert.match(okPending.headers.get("Location") ?? "", /steam=pending/);

    const badReturn = callbackUrl({
      "openid.return_to": "https://evil.example/callback?nonce=nonce-fixed",
    });
    const rejected = await handleSteamConnect(new Request(badReturn), deps);
    assert.equal(rejected.status, 302);
    assert.equal(rejected.headers.get("Location"), `${RETURN_ORIGIN}/settings?steam=error`);
  });

  it("redirects an unverified OpenID assertion to the app error page", async () => {
    const deps = baseDeps({ verifyOpenId: async () => false });
    await handleSteamConnect(startRequest(), deps);
    const response = await handleSteamConnect(new Request(callbackUrl()), deps);
    assert.equal(response.status, 302);
    assert.equal(response.headers.get("Location"), `${RETURN_ORIGIN}/settings?steam=error`);
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
