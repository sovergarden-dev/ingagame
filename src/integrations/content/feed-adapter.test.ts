import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  allowMockContentFeed,
  contentFeedUrl,
  fetchContentKind,
  parseContentFeedResponse,
  selectArticleItems,
  selectDealItems,
  selectReleaseItems,
} from "./feed.ts";

describe("contentFeedUrl", () => {
  it("builds GET /functions/v1/content-feed with kind, since, limit", () => {
    assert.equal(
      contentFeedUrl("https://proj.supabase.co", "releases"),
      "https://proj.supabase.co/functions/v1/content-feed?kind=releases",
    );
    assert.equal(
      contentFeedUrl("https://proj.supabase.co/", "deals", {
        since: "2026-08-01T00:00:00.000Z",
        limit: 10,
      }),
      "https://proj.supabase.co/functions/v1/content-feed?kind=deals&since=2026-08-01T00%3A00%3A00.000Z&limit=10",
    );
  });
});

describe("allowMockContentFeed", () => {
  it("is off in production even with an explicit mock flag", () => {
    assert.equal(allowMockContentFeed({ DEV: false, PROD: true }), false);
    assert.equal(
      allowMockContentFeed({ DEV: false, PROD: true, VITE_CONTENT_FEED_MOCK: "1" }),
      false,
    );
  });

  it("is on in DEV unless VITE_CONTENT_FEED_MOCK=0", () => {
    assert.equal(allowMockContentFeed({ DEV: true }), true);
    assert.equal(allowMockContentFeed({ DEV: true, VITE_CONTENT_FEED_MOCK: "0" }), false);
    assert.equal(allowMockContentFeed({ DEV: true, VITE_CONTENT_FEED_MOCK: "1" }), true);
  });
});

describe("parseContentFeedResponse", () => {
  it("reads items and fetchedAt and ignores unknown keys", () => {
    const parsed = parseContentFeedResponse({
      items: [{ id: "n1" }],
      fetchedAt: "2026-09-07T00:00:00.000Z",
      service_role: "nope",
    });
    assert.deepEqual(parsed, {
      items: [{ id: "n1" }],
      fetchedAt: "2026-09-07T00:00:00.000Z",
    });
  });
});

describe("selectReleaseItems", () => {
  it("drops rows that are not { game, event } catalogue entries", () => {
    const kept = selectReleaseItems([
      {},
      {
        game: { id: "g1", slug: "harborlight", title: "Harborlight" },
        event: { id: "e1", state: "upcoming", platforms: ["pc"] },
      },
      { game: "nope", event: { id: "e2" } },
    ]);
    assert.equal(kept.length, 1);
    assert.equal(kept[0]?.event.id, "e1");
  });
});

describe("selectDealItems / selectArticleItems", () => {
  it("requires id plus deal or article fields", () => {
    assert.deepEqual(
      selectDealItems([
        {},
        {
          id: "d1",
          gameId: "g1",
          store: "Steam",
          priceCurrent: 1,
          priceBase: 2,
          discountPercent: 50,
          currency: "USD",
        },
      ]).map((d) => d.id),
      ["d1"],
    );
    assert.deepEqual(
      selectArticleItems([
        {},
        { id: "a1", title: "Hello", source: "Wire", publishedAt: "2026-09-01T00:00:00.000Z" },
      ]).map((a) => a.id),
      ["a1"],
    );
  });
});

describe("fetchContentKind", () => {
  it("calls the public Edge URL with the publishable apikey only", async () => {
    const calls: { url: string; headers: Record<string, string> }[] = [];
    const result = await fetchContentKind("news", {
      env: {
        DEV: false,
        VITE_SUPABASE_URL: "https://proj.supabase.co",
        VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
      },
      fetch: async (input, init) => {
        const headers = new Headers(init?.headers);
        calls.push({
          url: String(input),
          headers: Object.fromEntries(headers.entries()),
        });
        return new Response(
          JSON.stringify({ items: [{ id: "art-1" }], fetchedAt: "2026-09-07T01:00:00.000Z" }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
    });

    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.url, "https://proj.supabase.co/functions/v1/content-feed?kind=news");
    assert.equal(calls[0]?.headers["apikey"], "sb_publishable_test");
    assert.equal(JSON.stringify(calls[0]?.headers).includes("service_role"), false);
    assert.equal(JSON.stringify(calls[0]?.headers).includes("sb_secret"), false);
    assert.deepEqual(result, {
      items: [{ id: "art-1" }],
      fetchedAt: "2026-09-07T01:00:00.000Z",
      source: "server",
      status: "ok",
    });
  });

  it("uses DEV mock fallback on error and stays empty in production", async () => {
    const mockItems = [{ id: "mock-1" }];
    const failing = async () => {
      throw new Error("network down");
    };

    const dev = await fetchContentKind("deals", {
      env: {
        DEV: true,
        VITE_SUPABASE_URL: "https://proj.supabase.co",
        VITE_SUPABASE_PUBLISHABLE_KEY: "pk",
      },
      fetch: failing,
      mockItems,
    });
    assert.equal(dev.source, "mock");
    assert.equal(dev.status, "error");
    assert.deepEqual(dev.items, mockItems);

    const prod = await fetchContentKind("deals", {
      env: {
        DEV: false,
        PROD: true,
        VITE_SUPABASE_URL: "https://proj.supabase.co",
        VITE_SUPABASE_PUBLISHABLE_KEY: "pk",
      },
      fetch: failing,
      mockItems,
    });
    assert.deepEqual(prod, {
      items: [],
      fetchedAt: null,
      source: "empty",
      status: "error",
    });
  });

  it("treats a server 200 with no items as documented empty, not mock", async () => {
    const result = await fetchContentKind("releases", {
      env: {
        DEV: true,
        VITE_SUPABASE_URL: "https://proj.supabase.co",
        VITE_SUPABASE_PUBLISHABLE_KEY: "pk",
      },
      fetch: async () =>
        new Response(JSON.stringify({ items: [], fetchedAt: "2026-09-07T02:00:00.000Z" }), {
          status: 200,
        }),
      mockItems: [{ id: "should-not-use" }],
    });
    assert.deepEqual(result, {
      items: [],
      fetchedAt: "2026-09-07T02:00:00.000Z",
      source: "server",
      status: "empty",
    });
  });
});
