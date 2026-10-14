import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  STEAM_LINKS_PUBLIC_COLUMNS,
  allowMockSteam,
  confirmSteamConnect,
  parseSteamLinkRow,
  steamConnectStartUrl,
  startSteamConnect,
  toPublicSteamProfile,
} from "./client.ts";

describe("allowMockSteam", () => {
  it("is off in production even with an explicit mock flag", () => {
    assert.equal(allowMockSteam({ DEV: false, PROD: true }), false);
    assert.equal(allowMockSteam({ DEV: false, PROD: true, VITE_STEAM_MOCK: "1" }), false);
  });

  it("is on in DEV unless VITE_STEAM_MOCK=0", () => {
    assert.equal(allowMockSteam({ DEV: true }), true);
    assert.equal(allowMockSteam({ DEV: true, VITE_STEAM_MOCK: "0" }), false);
    assert.equal(allowMockSteam({ DEV: true, VITE_STEAM_MOCK: "1" }), true);
  });
});

describe("toPublicSteamProfile", () => {
  it("returns disconnected when there is no link", () => {
    assert.deepEqual(toPublicSteamProfile(null), {
      connected: false,
      personaName: null,
      avatarUrl: null,
      steamId: null,
    });
  });

  it("maps only public profile fields and drops token-like keys", () => {
    const dto = toPublicSteamProfile({
      steam_id: "76561198000000000",
      persona_name: "Ada",
      avatar_url: "https://avatars.steamstatic.com/a.jpg",
      refresh_token: "leak-refresh",
      api_key: "leak-key",
      access_token: "leak-access",
      extra: "nope",
    });
    assert.deepEqual(dto, {
      connected: true,
      personaName: "Ada",
      avatarUrl: "https://avatars.steamstatic.com/a.jpg",
      steamId: "76561198000000000",
    });
    assert.equal(JSON.stringify(dto).includes("leak"), false);
  });
});

describe("parseSteamLinkRow / public columns", () => {
  it("selects only public steam_links columns", () => {
    assert.equal(STEAM_LINKS_PUBLIC_COLUMNS, "steam_id, persona_name, avatar_url");
  });

  it("ignores unknown keys from a row payload", () => {
    const row = parseSteamLinkRow({
      steam_id: "76561198000000001",
      persona_name: "Lee",
      avatar_url: null,
      refresh_token: "nope",
    });
    assert.deepEqual(row, {
      steam_id: "76561198000000001",
      persona_name: "Lee",
      avatar_url: null,
    });
  });
});

describe("steamConnectStartUrl", () => {
  it("points at the Edge /steam-connect/start path", () => {
    assert.equal(
      steamConnectStartUrl("https://proj.supabase.co"),
      "https://proj.supabase.co/functions/v1/steam-connect/start",
    );
    assert.equal(
      steamConnectStartUrl("https://proj.supabase.co/"),
      "https://proj.supabase.co/functions/v1/steam-connect/start",
    );
  });
});

describe("startSteamConnect", () => {
  it("calls Edge start with the user JWT and publishable apikey only", async () => {
    const calls: {
      url: string;
      headers: Record<string, string>;
      redirect?: RequestRedirect | undefined;
    }[] = [];
    const assigned: string[] = [];
    await startSteamConnect({
      accessToken: "user-jwt",
      supabaseUrl: "https://proj.supabase.co",
      publishableKey: "sb_publishable_test",
      fetch: async (input, init) => {
        const headers = new Headers(init?.headers);
        calls.push({
          url: String(input),
          headers: Object.fromEntries(headers.entries()),
          redirect: init?.redirect,
        });
        return new Response(
          JSON.stringify({
            redirectUrl: "https://steamcommunity.com/openid/login?openid.mode=checkid_setup",
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              Location: "https://steamcommunity.com/openid/login?openid.mode=checkid_setup",
            },
          },
        );
      },
      assign: (url) => assigned.push(url),
    });

    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.url, "https://proj.supabase.co/functions/v1/steam-connect/start");
    assert.equal(calls[0]?.headers["authorization"], "Bearer user-jwt");
    assert.equal(calls[0]?.headers["apikey"], "sb_publishable_test");
    assert.equal(calls[0]?.redirect, "manual");
    assert.equal(JSON.stringify(calls[0]?.headers).includes("STEAM_API"), false);
    assert.equal(JSON.stringify(calls[0]?.headers).includes("service_role"), false);
    assert.deepEqual(assigned, [
      "https://steamcommunity.com/openid/login?openid.mode=checkid_setup",
    ]);
  });

  it("rejects a non-Steam redirect URL", async () => {
    await assert.rejects(
      () =>
        startSteamConnect({
          accessToken: "user-jwt",
          supabaseUrl: "https://proj.supabase.co",
          publishableKey: "pk",
          fetch: async () =>
            new Response(JSON.stringify({ redirectUrl: "https://evil.example/phish" }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }),
          assign: () => {
            throw new Error("should not navigate");
          },
        }),
      { name: "SteamConnectError" },
    );
  });
});

describe("confirmSteamConnect", () => {
  it("posts the ticket with the user JWT and maps only public fields", async () => {
    const calls: { url: string; headers: Record<string, string>; body: string }[] = [];
    const profile = await confirmSteamConnect({
      ticket: "ticket-fixed",
      accessToken: "user-jwt",
      supabaseUrl: "https://proj.supabase.co",
      publishableKey: "sb_publishable_test",
      fetch: async (input, init) => {
        const headers = new Headers(init?.headers);
        calls.push({
          url: String(input),
          headers: Object.fromEntries(headers.entries()),
          body: String(init?.body ?? ""),
        });
        return new Response(
          JSON.stringify({
            connected: true,
            personaName: "Ada",
            avatarUrl: "https://a",
            steamId: "76561198000000000",
            refresh_token: "leak",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
    });
    assert.equal(calls[0]?.url, "https://proj.supabase.co/functions/v1/steam-connect/confirm");
    assert.equal(calls[0]?.headers["authorization"], "Bearer user-jwt");
    assert.equal(calls[0]?.headers["apikey"], "sb_publishable_test");
    assert.equal(calls[0]?.body, JSON.stringify({ ticket: "ticket-fixed" }));
    assert.deepEqual(profile, {
      connected: true,
      personaName: "Ada",
      avatarUrl: "https://a",
      steamId: "76561198000000000",
    });
    assert.equal(JSON.stringify(profile).includes("leak"), false);
  });
});
