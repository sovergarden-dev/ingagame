import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  allowMockContentFeed,
  contentFeedUrl,
  fetchContentKind,
  findGameBySlug,
  freshnessFromFeed,
  parseContentFeedResponse,
  radarReferenceIso,
  requireFeedSuccess,
  showFixtureShelves,
  selectArticleItems,
  selectDealItems,
  selectReleaseItems,
  devMockIfUnrenderable,
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

describe("showFixtureShelves", () => {
  it("shows hardcoded shelves only while the catalogue source is mock", () => {
    assert.equal(showFixtureShelves("mock"), true);
    assert.equal(showFixtureShelves("server"), false);
    assert.equal(showFixtureShelves("empty"), false);
    assert.equal(showFixtureShelves(undefined), false);
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

describe("devMockIfUnrenderable", () => {
  it("keeps a renderable server catalogue", () => {
    const kept = devMockIfUnrenderable(
      { items: ["live"], fetchedAt: "2026-09-07T00:00:00.000Z", source: "server", status: "ok" },
      ["mock"],
      { DEV: true },
    );
    assert.deepEqual(kept.items, ["live"]);
  });

  it("uses DEV mock when the server rows are not renderable", () => {
    const kept = devMockIfUnrenderable(
      { items: [], fetchedAt: "2026-09-07T00:00:00.000Z", source: "server", status: "empty" },
      ["mock"],
      { DEV: true },
    );
    assert.equal(kept.source, "mock");
    assert.deepEqual(kept.items, ["mock"]);
  });

  it("stays empty in production", () => {
    const kept = devMockIfUnrenderable(
      { items: [], fetchedAt: "2026-09-07T00:00:00.000Z", source: "server", status: "empty" },
      ["mock"],
      { DEV: false, PROD: true },
    );
    assert.equal(kept.source, "server");
    assert.deepEqual(kept.items, []);
  });
});

describe("selectReleaseItems", () => {
  it("drops rows that are not renderable { game, event } catalogue entries", () => {
    const event = {
      id: "e1",
      gameId: "g1",
      date: "2026-09-10T00:00:00.000Z",
      precision: "date",
      confidence: "confirmed",
      kind: "full",
      state: "upcoming",
      platforms: ["pc"],
    };
    const game = {
      id: "g1",
      slug: "harborlight",
      title: "Harborlight",
      developer: "Studio",
      publisher: "Pub",
      summary: "A game",
      genres: ["Adventure"],
      coverUrl: "https://example.test/cover.jpg",
      platforms: ["pc"],
      releaseEvents: [event],
    };
    const kept = selectReleaseItems([
      {},
      {
        game: { id: "g1", slug: "harborlight", title: "Harborlight" },
        event: { id: "e1", state: "upcoming", platforms: ["pc"] },
      },
      { game, event },
      { game, event: { ...event, id: "e-mismatch", gameId: "g-other" } },
      { game: "nope", event: { id: "e2" } },
    ]);
    assert.equal(kept.length, 1);
    assert.equal(kept[0]?.event.id, "e1");
    assert.equal(kept[0]?.event.date.slice(0, 10), "2026-09-10");
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
        {
          id: "d-bad-game",
          gameId: "g1",
          store: "Steam",
          priceCurrent: 1,
          priceBase: 2,
          discountPercent: 50,
          currency: "USD",
          game: { slug: "incomplete" },
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

  it("drops embedded game snapshots that contradict the item game ID", () => {
    const event = {
      id: "event-g1",
      gameId: "g1",
      date: "2026-09-10T00:00:00.000Z",
      precision: "date",
      confidence: "confirmed",
      kind: "full",
      state: "upcoming",
      platforms: ["pc"],
    };
    const game = {
      id: "g1",
      slug: "game-one",
      title: "Game One",
      developer: "Studio",
      publisher: "Publisher",
      summary: "Summary",
      genres: ["Adventure"],
      coverUrl: "https://example.test/game-one.jpg",
      platforms: ["pc"],
      releaseEvents: [event],
    };
    assert.deepEqual(
      selectDealItems([
        {
          id: "deal-conflict",
          gameId: "g2",
          store: "Steam",
          priceCurrent: 1,
          priceBase: 2,
          discountPercent: 50,
          currency: "USD",
          game,
        },
      ]),
      [],
    );
    assert.deepEqual(
      selectArticleItems([
        {
          id: "article-conflict",
          gameId: "g2",
          title: "Mismatch",
          source: "Wire",
          publishedAt: "2026-09-01T00:00:00.000Z",
          game,
        },
      ]),
      [],
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

describe("requireFeedSuccess", () => {
  it("throws on empty error so React Query can keep the last good payload", () => {
    assert.throws(
      () =>
        requireFeedSuccess({
          items: [],
          fetchedAt: null,
          source: "empty",
          status: "error",
        }),
      { name: "FeedUnavailableError" },
    );
  });

  it("keeps DEV mock / last items even when status is error", () => {
    const result = requireFeedSuccess({
      items: [{ id: "kept" }],
      fetchedAt: null,
      source: "mock",
      status: "error",
    });
    assert.equal(result.items[0]?.id, "kept");
  });
});

describe("freshnessFromFeed", () => {
  const fetchedAt = "2026-09-07T00:00:00.000Z";
  const nowMs = Date.parse("2026-09-07T00:02:00.000Z");

  it("marks query errors and mock fallbacks as stale", () => {
    assert.equal(
      freshnessFromFeed(
        { items: [{ id: "1" }], fetchedAt, source: "server", status: "ok" },
        false,
        nowMs,
        true,
      ).state,
      "stale",
    );
    assert.equal(
      freshnessFromFeed(
        { items: [{ id: "1" }], fetchedAt, source: "mock", status: "error" },
        false,
        nowMs,
      ).state,
      "stale",
    );
  });

  it("is fresh when the server payload is recent", () => {
    assert.equal(
      freshnessFromFeed(
        { items: [{ id: "1" }], fetchedAt, source: "server", status: "ok" },
        false,
        nowMs,
      ).state,
      "fresh",
    );
  });
});

describe("findGameBySlug", () => {
  it("prefers release snapshots then deals then news", () => {
    const event = {
      id: "e1",
      gameId: "g1",
      date: "2026-09-10T00:00:00.000Z",
      precision: "date" as const,
      confidence: "confirmed" as const,
      kind: "full" as const,
      state: "upcoming" as const,
      platforms: ["pc" as const],
    };
    const game = {
      id: "g1",
      slug: "harborlight",
      title: "Harborlight",
      developer: "Studio",
      publisher: "Pub",
      summary: "A game",
      genres: ["Adventure"],
      coverUrl: "https://example.test/cover.jpg",
      platforms: ["pc" as const],
      releaseEvents: [event],
    };
    assert.equal(findGameBySlug("harborlight", { releases: [{ game, event }] })?.id, "g1");
    assert.equal(findGameBySlug("missing", { releases: [{ game, event }] }), undefined);
  });
});

describe("radarReferenceIso", () => {
  it("uses epoch until the client clock hydrates", () => {
    assert.equal(radarReferenceIso(null), "1970-01-01T00:00:00.000Z");
    assert.equal(
      radarReferenceIso(Date.parse("2026-09-07T12:00:00.000Z")),
      "2026-09-07T12:00:00.000Z",
    );
  });
});
