import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  handleContentIngest,
  type IngestDeps,
} from "../../../supabase/functions/content-ingest/handler.ts";
import { mapSteamAppToRadarEntry, type RawSteamApp } from "./steam-release-mapper.ts";
import { mapSteamSpecialToDeal, type RawSteamSpecial } from "./steam-deals-mapper.ts";
import { mapSteamNewsToArticle, type RawSteamNewsItem } from "./steam-news-mapper.ts";
import { mapEpicFreeGameToDeal, type RawEpicFreeGameElement } from "./epic-free-games-mapper.ts";

const SERVICE_KEY = "test-service-role-key-12345";

function mockDeps(overrides: Partial<IngestDeps> = {}): IngestDeps & {
  upserted: {
    runId: string;
    kind: string;
    externalId: string;
    publishedAt: string;
    payload: unknown;
    expiresAt?: string | null;
    offerState?: string;
    sourceFreshUntil?: string | null;
    offerType?: string;
    claimEndsAt?: string | null;
    accessEndsAt?: string | null;
    classificationStatus?: string;
  }[];
  dispatchesLinked: {
    dispatchId: string;
    runId?: string | undefined;
    httpStatus?: number | undefined;
    outcome?: string | undefined;
  }[];
} {
  const upserted: {
    runId: string;
    kind: string;
    externalId: string;
    publishedAt: string;
    payload: unknown;
    expiresAt?: string | null;
    offerState?: string;
    sourceFreshUntil?: string | null;
    offerType?: string;
    claimEndsAt?: string | null;
    accessEndsAt?: string | null;
    classificationStatus?: string;
  }[] = [];
  const dispatchesLinked: {
    dispatchId: string;
    runId?: string | undefined;
    httpStatus?: number | undefined;
    outcome?: string | undefined;
  }[] = [];
  return {
    serviceRoleKey: SERVICE_KEY,
    now: () => new Date("2026-10-17T10:00:00.000Z"),
    upsertItem: async (
      runId,
      kind,
      externalId,
      publishedAt,
      payload,
      expiresAt,
      offerState,
      sourceFreshUntil,
      offerType,
      claimEndsAt,
      accessEndsAt,
      classificationStatus,
    ) => {
      upserted.push({
        runId,
        kind,
        externalId,
        publishedAt,
        payload,
        ...(expiresAt !== undefined ? { expiresAt } : {}),
        ...(offerState !== undefined ? { offerState } : {}),
        ...(sourceFreshUntil !== undefined ? { sourceFreshUntil } : {}),
        ...(offerType !== undefined ? { offerType } : {}),
        ...(claimEndsAt !== undefined ? { claimEndsAt } : {}),
        ...(accessEndsAt !== undefined ? { accessEndsAt } : {}),
        ...(classificationStatus !== undefined ? { classificationStatus } : {}),
      });
      return `id-${upserted.length}`;
    },
    mapSteamApp: mapSteamAppToRadarEntry,
    mapSteamDeal: (item, now) => mapSteamSpecialToDeal(item as RawSteamSpecial, "us", now),
    mapSteamNews: (item) => mapSteamNewsToArticle(item as RawSteamNewsItem),
    mapEpicDeal: (item, now) => mapEpicFreeGameToDeal(item as RawEpicFreeGameElement, "us", now),
    upserted,
    dispatchesLinked,
    linkDispatch: async (dispatchId, runId, httpStatus, outcome) => {
      dispatchesLinked.push({ dispatchId, runId, httpStatus, outcome });
      return true;
    },
    ...overrides,
  };
}

function req(options: { method?: string; auth?: string; body?: unknown }): Request {
  const headers = new Headers();
  if (options.auth) headers.set("authorization", options.auth);
  if (options.body !== undefined) headers.set("content-type", "application/json");

  const init: RequestInit = {
    method: options.method ?? "POST",
    headers,
  };
  if (options.body !== undefined) {
    init.body = JSON.stringify(options.body);
  }

  return new Request("https://localhost/functions/v1/content-ingest", init);
}

describe("handleContentIngest - Security & Guards", () => {
  it("responds to OPTIONS with cors headers", async () => {
    const deps = mockDeps();
    const res = await handleContentIngest(req({ method: "OPTIONS" }), deps);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("access-control-allow-origin"), "*");
  });

  it("rejects non-POST methods with 405", async () => {
    const deps = mockDeps();
    const res = await handleContentIngest(req({ method: "GET" }), deps);
    assert.equal(res.status, 405);
  });

  it("rejects unauthenticated requests with 401", async () => {
    const deps = mockDeps();
    const noAuth = await handleContentIngest(req({ body: {} }), deps);
    assert.equal(noAuth.status, 401);

    const badAuth = await handleContentIngest(req({ auth: "Bearer wrong-key", body: {} }), deps);
    assert.equal(badAuth.status, 401);
  });
});

describe("handleContentIngest - sync_steam_releases", () => {
  const sampleApps: RawSteamApp[] = [
    {
      id: 1145350,
      name: "Hades II",
      header_image: "https://example.com/hades2.jpg",
      developer: "Supergiant Games",
      publisher: "Supergiant Games",
      short_description: "Battle beyond the underworld.",
      release_date: "2026-11-20",
    },
    {
      id: 1030300,
      name: "Hollow Knight: Silksong",
      header_image: "https://example.com/silksong.jpg",
      developer: "Team Cherry",
      publisher: "Team Cherry",
      short_description: "Play as Hornet in a haunted kingdom.",
      release_date: "Q1 2027",
    },
    {
      id: 9999999,
      name: "Unannounced Mystery Game",
      release_date: "Coming Soon", // Pure TBA -> Dropped per Notion Sy06 integrity rules
    },
  ];

  it("ingests upcoming Steam releases, upserting with namespaced external_id", async () => {
    const deps = mockDeps({
      fetchSteamFeatured: async () => sampleApps,
    });

    const res = await handleContentIngest(
      req({
        auth: `Bearer ${SERVICE_KEY}`,
        body: { action: "sync_steam_releases" },
      }),
      deps,
    );

    assert.equal(res.status, 200);
    const json = (await res.json()) as {
      ok: boolean;
      synced: number;
      dropped: number;
      total: number;
    };
    assert.equal(json.ok, true);
    assert.equal(json.synced, 2);
    assert.equal(json.dropped, 1); // Coming Soon dropped cleanly
    assert.equal(json.total, 3);

    // Verify upserted rows
    assert.equal(deps.upserted.length, 2);
    assert.equal(deps.upserted[0]?.externalId, "steam:app:1145350");
    assert.equal(deps.upserted[0]?.kind, "releases");
    assert.equal(deps.upserted[1]?.externalId, "steam:app:1030300");
  });

  it("handles upstream Steam failure with 502", async () => {
    const deps = mockDeps({
      fetchSteamFeatured: async () => {
        throw new Error("connection reset");
      },
    });

    const res = await handleContentIngest(
      req({
        auth: `Bearer ${SERVICE_KEY}`,
        body: { action: "sync_steam_releases" },
      }),
      deps,
    );

    assert.equal(res.status, 502);
    const json = (await res.json()) as { error: string };
    assert.equal(json.error, "steam_fetch_error");
  });
});

describe("handleContentIngest - ingest_batch", () => {
  it("ingests verified items in batch", async () => {
    const deps = mockDeps();
    const items = [
      {
        kind: "releases" as const,
        externalId: "custom:1",
        payload: { test: true },
      },
      {
        kind: "deals" as const,
        externalId: "custom:deal:1",
        payload: { discount: 50 },
      },
    ];

    const res = await handleContentIngest(
      req({
        auth: `Bearer ${SERVICE_KEY}`,
        body: { action: "ingest_batch", items },
      }),
      deps,
    );

    assert.equal(res.status, 200);
    const json = (await res.json()) as { ok: boolean; synced: number; dropped: number };
    assert.equal(json.ok, true);
    assert.equal(json.synced, 2);
    assert.equal(json.dropped, 0);
    assert.equal(deps.upserted.length, 2);
  });
});

describe("handleContentIngest - sync_steam_deals", () => {
  const sampleSpecials: RawSteamSpecial[] = [
    {
      id: 1145350,
      name: "Hades II",
      header_image: "https://example.com/hades2.jpg",
      discount_percent: 40,
      original_price: 2999,
      final_price: 1799,
      currency: "USD",
      discount_expiration: 1792128000,
    },
    {
      id: 9999999,
      name: "Invalid Broken Deal",
      discount_percent: 120, // Invalid discount -> dropped
      original_price: 1000,
      final_price: 2000, // Invalid current > base
    },
  ];

  it("ingests Steam specials, creating Deals with external_id namespace", async () => {
    const deps = mockDeps({
      fetchSteamSpecials: async () => sampleSpecials,
    });

    const res = await handleContentIngest(
      req({
        auth: `Bearer ${SERVICE_KEY}`,
        body: { action: "sync_steam_deals" },
      }),
      deps,
    );

    assert.equal(res.status, 200);
    const json = (await res.json()) as {
      ok: boolean;
      synced: number;
      dropped: number;
      total: number;
    };
    assert.equal(json.ok, true);
    assert.equal(json.synced, 1);
    assert.equal(json.dropped, 1);
    assert.equal(json.total, 2);

    assert.equal(deps.upserted.length, 1);
    assert.equal(deps.upserted[0]?.kind, "deals");
    assert.equal(deps.upserted[0]?.externalId, "steam:app:1145350:market:us:currency:USD");
    assert.equal(deps.upserted[0]?.offerType, "discount");
    assert.equal(deps.upserted[0]?.classificationStatus, "verified");
  });
});

describe("handleContentIngest - sync_steam_news", () => {
  const sampleNews: RawSteamNewsItem[] = [
    {
      gid: "998877665544",
      title: "Major Update - The Olympic Trials",
      url: "https://store.steampowered.com/news/app/1145350/view/998877665544",
      author: "Supergiant Games",
      contents: "Detailed notes for the big major update with new areas.",
      feedlabel: "Steam Announcements",
      date: 1792128000,
      feedname: "steam_announcements",
      appid: 1145350,
    },
    {
      gid: "112233445566",
      title: "Hotfix 1.0.1 - Typo fixes in Russian",
      url: "https://store.steampowered.com/news/app/1145350/view/112233445566",
      author: "Supergiant Games",
      contents: "Fixed small typos.",
      date: 1792128000,
      appid: 1145350, // Dropped per Notion Sy06 hygiene rules
    },
  ];

  it("ingests Steam news, keeping major announcements and filtering minor patches", async () => {
    const deps = mockDeps({
      fetchSteamNews: async () => sampleNews,
    });

    const res = await handleContentIngest(
      req({
        auth: `Bearer ${SERVICE_KEY}`,
        body: { action: "sync_steam_news", appId: 1145350 },
      }),
      deps,
    );

    assert.equal(res.status, 200);
    const json = (await res.json()) as {
      ok: boolean;
      synced: number;
      dropped: number;
      total: number;
    };
    assert.equal(json.ok, true);
    assert.equal(json.synced, 1);
    assert.equal(json.dropped, 1); // Minor patch dropped cleanly
    assert.equal(json.total, 2);

    assert.equal(deps.upserted.length, 1);
    assert.equal(deps.upserted[0]?.kind, "news");
    assert.equal(deps.upserted[0]?.externalId, "news:steam:app:1145350:998877665544");
  });
});

describe("handleContentIngest - sync_epic_free_games", () => {
  const sampleEpicElements: RawEpicFreeGameElement[] = [
    {
      id: "epic-offer-1",
      namespace: "epic-ns-1",
      title: "Ghostwire: Tokyo",
      offerType: "BASE_GAME",
      productSlug: "ghostwire-tokyo/home",
      price: {
        totalPrice: { discountPrice: 0, originalPrice: 5999, currencyCode: "USD" },
      },
      promotions: {
        promotionalOffers: [
          {
            promotionalOffers: [
              {
                startDate: "2026-10-15T00:00:00.000Z",
                endDate: "2026-10-25T00:00:00.000Z",
                discountSetting: { discountPercentage: 0 },
              },
            ],
          },
        ],
      },
    },
    {
      id: "epic-offer-2",
      namespace: "epic-ns-2",
      title: "Upcoming Mystery Game",
      offerType: "BASE_GAME",
      promotions: {
        promotionalOffers: [
          {
            promotionalOffers: [
              {
                startDate: "2026-11-01T00:00:00.000Z",
                endDate: "2026-11-08T00:00:00.000Z",
                discountSetting: { discountPercentage: 0 },
              },
            ],
          },
        ],
      },
    },
  ];

  it("ingests active free Epic promotions into deals with storeRefs and free_to_keep", async () => {
    const deps = mockDeps({
      fetchEpicFreeGames: async () => sampleEpicElements,
      claimRun: async () => ({ claimed: true, runId: "epic-run-1" }),
    });

    const res = await handleContentIngest(
      req({
        auth: `Bearer ${SERVICE_KEY}`,
        body: { action: "sync_epic_free_games" },
      }),
      deps,
    );

    assert.equal(res.status, 200);
    const json = (await res.json()) as {
      ok: boolean;
      synced: number;
      dropped: number;
      total: number;
    };
    assert.equal(json.ok, true);
    assert.equal(json.synced, 1);
    assert.equal(json.dropped, 1);
    assert.equal(json.total, 2);

    assert.equal(deps.upserted.length, 1);
    assert.equal(deps.upserted[0]?.kind, "deals");
    assert.equal(deps.upserted[0]?.runId, "epic-run-1");
    assert.equal(deps.upserted[0]?.offerType, "free_to_keep");
  });

  it("handles upstream Epic fetch failure with 502", async () => {
    const deps = mockDeps({
      fetchEpicFreeGames: async () => {
        throw new Error("epic_network_timeout");
      },
    });

    const res = await handleContentIngest(
      req({
        auth: `Bearer ${SERVICE_KEY}`,
        body: { action: "sync_epic_free_games" },
      }),
      deps,
    );

    assert.equal(res.status, 502);
  });
});

describe("handleContentIngest - Concurrency Leases & Audit", () => {
  it("rejects concurrent execution with 409 when lease is held", async () => {
    let claimedAction: string | undefined;
    const deps = mockDeps({
      claimRun: async (action) => {
        claimedAction = action;
        return { claimed: false };
      },
    });

    const res = await handleContentIngest(
      req({
        auth: `Bearer ${SERVICE_KEY}`,
        body: { action: "sync_steam_deals" },
      }),
      deps,
    );

    assert.equal(res.status, 409);
    const json = (await res.json()) as { error: string; action: string };
    assert.equal(json.error, "lease_held");
    assert.equal(json.action, "sync_steam_deals");
    assert.equal(claimedAction, "sync_steam_deals");
    assert.equal(deps.upserted.length, 0);
  });

  it("finalizes run with stats on completed execution", async () => {
    let finalizedStatus: string | undefined;
    let finalizedStats: { synced: number; dropped: number; total: number } | undefined;

    const sample = [
      {
        id: 100,
        name: "Game 1",
        discount_percent: 20,
        original_price: 2000,
        final_price: 1600,
      },
    ];

    const deps = mockDeps({
      fetchSteamSpecials: async () => sample,
      claimRun: async () => ({ claimed: true, runId: "run-123" }),
      finalizeRun: async (_runId, status, stats) => {
        finalizedStatus = status;
        finalizedStats = stats;
        return true;
      },
    });

    const res = await handleContentIngest(
      req({
        auth: `Bearer ${SERVICE_KEY}`,
        body: { action: "sync_steam_deals" },
      }),
      deps,
    );

    assert.equal(res.status, 200);
    assert.equal(finalizedStatus, "completed");
    assert.deepEqual(finalizedStats, { synced: 1, dropped: 0, total: 1 });
  });

  it("finalizes run with failed status when upstream fetch throws", async () => {
    let finalizedStatus: string | undefined;
    let finalizedError: string | undefined;

    const deps = mockDeps({
      fetchSteamSpecials: async () => {
        throw new Error("steam_down_503");
      },
      claimRun: async () => ({ claimed: true, runId: "run-456" }),
      finalizeRun: async (_runId, status, stats) => {
        finalizedStatus = status;
        finalizedError = stats.error;
        return true;
      },
    });

    const res = await handleContentIngest(
      req({
        auth: `Bearer ${SERVICE_KEY}`,
        body: { action: "sync_steam_deals" },
      }),
      deps,
    );

    assert.equal(res.status, 502);
    assert.equal(finalizedStatus, "failed");
    assert.ok(finalizedError?.includes("http_status_502"));
  });

  it("rejects execution with 409 when action is disabled via kill-switch", async () => {
    const deps = mockDeps({
      claimRun: async () => ({ claimed: false, reason: "action_disabled" }),
    });

    const res = await handleContentIngest(
      req({
        auth: `Bearer ${SERVICE_KEY}`,
        body: { action: "sync_steam_deals" },
      }),
      deps,
    );

    assert.equal(res.status, 409);
    const json = (await res.json()) as { error: string; action: string; reason: string };
    assert.equal(json.error, "action_disabled");
    assert.equal(json.action, "sync_steam_deals");
    assert.equal(json.reason, "action_disabled");
    assert.equal(deps.upserted.length, 0);
  });

  it("rejects execution with 429 when action is within cooldown", async () => {
    const deps = mockDeps({
      claimRun: async () => ({ claimed: false, reason: "cooldown_active" }),
    });

    const res = await handleContentIngest(
      req({
        auth: `Bearer ${SERVICE_KEY}`,
        body: { action: "sync_steam_deals" },
      }),
      deps,
    );

    assert.equal(res.status, 429);
    const json = (await res.json()) as { error: string; action: string; reason: string };
    assert.equal(json.error, "cooldown_active");
    assert.equal(json.action, "sync_steam_deals");
    assert.equal(json.reason, "cooldown_active");
    assert.equal(deps.upserted.length, 0);
  });

  it("passes active runId to upsertItem for each synced item", async () => {
    const sample = [
      {
        id: 100,
        name: "Game 1",
        discount_percent: 20,
        original_price: 2000,
        final_price: 1600,
      },
    ];

    const deps = mockDeps({
      fetchSteamSpecials: async () => sample,
      claimRun: async () => ({ claimed: true, runId: "run-fenced-999" }),
    });

    const res = await handleContentIngest(
      req({
        auth: `Bearer ${SERVICE_KEY}`,
        body: { action: "sync_steam_deals" },
      }),
      deps,
    );

    assert.equal(res.status, 200);
    assert.equal(deps.upserted.length, 1);
    assert.equal(deps.upserted[0]?.runId, "run-fenced-999");
  });

  it("aborts sync loop and returns 409 when upsertItem throws lease_lost", async () => {
    const sample = [
      { id: 100, name: "Game 1", discount_percent: 20, original_price: 2000, final_price: 1600 },
      { id: 101, name: "Game 2", discount_percent: 30, original_price: 3000, final_price: 2100 },
    ];
    let calls = 0;
    const deps = mockDeps({
      fetchSteamSpecials: async () => sample,
      claimRun: async () => ({ claimed: true, runId: "run-stale" }),
      upsertItem: async () => {
        calls++;
        throw new Error("lease_expired: lease for run run-stale expired");
      },
    });

    const res = await handleContentIngest(
      req({
        auth: `Bearer ${SERVICE_KEY}`,
        body: { action: "sync_steam_deals" },
      }),
      deps,
    );

    assert.equal(res.status, 409);
    const json = (await res.json()) as { error: string; details: string };
    assert.equal(json.error, "lease_lost");
    assert.equal(calls, 1);
  });

  it("ingest_batch passes active runId to upsertItem", async () => {
    const deps = mockDeps({
      claimRun: async () => ({ claimed: true, runId: "batch-run-777" }),
    });
    const items = [{ kind: "releases" as const, externalId: "custom:1", payload: { test: true } }];
    const res = await handleContentIngest(
      req({
        auth: `Bearer ${SERVICE_KEY}`,
        body: { action: "ingest_batch", items },
      }),
      deps,
    );
    assert.equal(res.status, 200);
    assert.equal(deps.upserted[0]?.runId, "batch-run-777");
  });

  it("correlates dispatchId with runId on running and completed execution", async () => {
    const sample = [
      {
        id: 100,
        name: "Game 1",
        discount_percent: 20,
        original_price: 2000,
        final_price: 1600,
      },
    ];

    const deps = mockDeps({
      fetchSteamSpecials: async () => sample,
      claimRun: async () => ({ claimed: true, runId: "run-dispatch-1" }),
    });

    const res = await handleContentIngest(
      req({
        auth: `Bearer ${SERVICE_KEY}`,
        body: { action: "sync_steam_deals", dispatchId: "disp-101" },
      }),
      deps,
    );

    assert.equal(res.status, 200);
    assert.equal(deps.dispatchesLinked.length, 2);
    assert.equal(deps.dispatchesLinked[0]?.dispatchId, "disp-101");
    assert.equal(deps.dispatchesLinked[0]?.runId, "run-dispatch-1");
    assert.equal(deps.dispatchesLinked[0]?.outcome, "running");

    assert.equal(deps.dispatchesLinked[1]?.dispatchId, "disp-101");
    assert.equal(deps.dispatchesLinked[1]?.runId, "run-dispatch-1");
    assert.equal(deps.dispatchesLinked[1]?.httpStatus, 200);
    assert.equal(deps.dispatchesLinked[1]?.outcome, "completed");
  });

  it("correlates dispatchId with rejection status on lease conflict", async () => {
    const deps = mockDeps({
      claimRun: async () => ({ claimed: false, reason: "lease_held" }),
    });

    const res = await handleContentIngest(
      req({
        auth: `Bearer ${SERVICE_KEY}`,
        body: { action: "sync_steam_deals", dispatchId: "disp-conflict" },
      }),
      deps,
    );

    assert.equal(res.status, 409);
    assert.equal(deps.dispatchesLinked.length, 1);
    assert.equal(deps.dispatchesLinked[0]?.dispatchId, "disp-conflict");
    assert.equal(deps.dispatchesLinked[0]?.httpStatus, 409);
    assert.equal(deps.dispatchesLinked[0]?.outcome, "lease_held");
  });
});
