import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CACHE_CONTROL,
  handleContentFeed,
  parseFeedSearchParams,
  toPublicItem,
  type FeedRow,
} from "../../../supabase/functions/content-feed/handler.ts";

function feedUrl(query: string) {
  return new URL(`https://xtmejuuuqiuqawstptuy.supabase.co/functions/v1/content-feed${query}`);
}

function rows(payloads: unknown[]): FeedRow[] {
  return payloads.map((payload, i) => ({
    payload,
    published_at: `2026-09-0${i + 1}T00:00:00.000Z`,
  }));
}

describe("parseFeedSearchParams", () => {
  it("requires kind=releases|deals|news", () => {
    const missing = parseFeedSearchParams(feedUrl(""));
    assert.equal(missing.ok, false);
    if (!missing.ok) assert.equal(missing.status, 400);

    const bad = parseFeedSearchParams(feedUrl("?kind=steam"));
    assert.equal(bad.ok, false);

    const ok = parseFeedSearchParams(feedUrl("?kind=deals"));
    assert.deepEqual(ok, { ok: true, kind: "deals", since: null, limit: 50 });
  });

  it("parses since ISO and clamps limit to 1..100", () => {
    const parsed = parseFeedSearchParams(
      feedUrl("?kind=news&since=2026-08-01T00:00:00.000Z&limit=10"),
    );
    assert.deepEqual(parsed, {
      ok: true,
      kind: "news",
      since: "2026-08-01T00:00:00.000Z",
      limit: 10,
    });

    const clamped = parseFeedSearchParams(feedUrl("?kind=releases&limit=999"));
    assert.equal(clamped.ok, true);
    if (clamped.ok) assert.equal(clamped.limit, 100);

    const invalidSince = parseFeedSearchParams(feedUrl("?kind=releases&since=not-a-date"));
    assert.equal(invalidSince.ok, false);
    if (!invalidSince.ok) assert.equal(invalidSince.status, 400);
  });
});

describe("toPublicItem", () => {
  it("drops secret-like keys and keeps catalogue fields", () => {
    const item = toPublicItem({
      id: "deal-1",
      store: "Steam",
      service_role: "super-secret",
      apiKey: "steam-provider-key",
      steamApiKey: "leak-2",
      clientSecret: "leak-3",
      privateKey: "leak-4",
      token: "abc",
      game: { title: "Harborlight", password: "nope" },
    });
    assert.deepEqual(item, {
      id: "deal-1",
      store: "Steam",
      game: { title: "Harborlight" },
    });
  });

  it("returns null for non-object payloads", () => {
    assert.equal(toPublicItem("secret-string"), null);
    assert.equal(toPublicItem(null), null);
  });
});

describe("handleContentFeed", () => {
  it("answers OPTIONS with CORS and GET-only methods", async () => {
    const preflight = await handleContentFeed(
      new Request("https://example.test/functions/v1/content-feed", { method: "OPTIONS" }),
      async () => [],
    );
    assert.equal(preflight.status, 200);
    assert.equal(preflight.headers.get("Access-Control-Allow-Origin"), "*");
    assert.match(preflight.headers.get("Access-Control-Allow-Methods") ?? "", /GET/);

    const posted = await handleContentFeed(
      new Request("https://example.test/functions/v1/content-feed?kind=news", { method: "POST" }),
      async () => [],
    );
    assert.equal(posted.status, 405);
  });

  it("returns DTO { items, fetchedAt } with short Cache-Control and no secrets", async () => {
    const fetchedAt = "2026-09-07T00:00:00.000Z";
    const response = await handleContentFeed(
      new Request("https://example.test/functions/v1/content-feed?kind=releases&limit=2"),
      async (query) => {
        assert.equal(query.kind, "releases");
        assert.equal(query.limit, 2);
        return rows([{ event: { id: "r1" }, service_role: "leak" }, { event: { id: "r2" } }]);
      },
      { now: () => new Date(fetchedAt) },
    );

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Cache-Control"), CACHE_CONTROL);
    assert.equal(response.headers.get("Content-Type"), "application/json");
    const body = (await response.json()) as { items: unknown[]; fetchedAt: string };
    assert.deepEqual(Object.keys(body).sort(), ["fetchedAt", "items"]);
    assert.equal(body.fetchedAt, fetchedAt);
    assert.deepEqual(body.items, [{ event: { id: "r1" } }, { event: { id: "r2" } }]);
    assert.equal(JSON.stringify(body).includes("service_role"), false);
    assert.equal(JSON.stringify(body).includes("leak"), false);
  });

  it("passes since to the store and maps query failures to a generic 500", async () => {
    const since = "2026-09-01T00:00:00.000Z";
    await handleContentFeed(
      new Request(`https://example.test/functions/v1/content-feed?kind=deals&since=${since}`),
      async (query) => {
        assert.equal(query.since, since);
        return [];
      },
    );

    const failed = await handleContentFeed(
      new Request("https://example.test/functions/v1/content-feed?kind=news"),
      async () => {
        throw new Error("password=super-secret connection failed");
      },
    );
    assert.equal(failed.status, 500);
    const body = await failed.text();
    assert.equal(body.includes("super-secret"), false);
    assert.equal(body.includes("password="), false);
    assert.match(body, /feed_unavailable/);
  });
});
