import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  dealsForGame,
  dealsForPlatforms,
  filterOffersByQueryAndDiscount,
  filterOwnedDeals,
  filterOwnedGiveaways,
  liveDeals,
} from "./deal.ts";
import type { Game, GameSummary } from "./types.ts";

const now = Date.parse("2026-09-25T00:00:00Z");

describe("liveDeals", () => {
  it("drops deals whose end has passed and keeps open or undated ones", () => {
    const deals = [
      { id: "past", endsAt: "2026-09-09T00:00:00Z" },
      { id: "open", endsAt: "2026-10-01T00:00:00Z" },
      { id: "undated" },
    ];
    assert.deepEqual(
      liveDeals(deals, now).map((deal) => deal.id),
      ["open", "undated"],
    );
  });

  it("does not filter before the client clock exists", () => {
    const deals = [{ id: "past", endsAt: "2026-09-09T00:00:00Z" }];
    assert.equal(liveDeals(deals, null).length, 1);
  });
});

describe("dealsForPlatforms", () => {
  it("keeps a deal on a selected platform and drops a deal with no game", () => {
    const deals = [
      { id: "pc", game: { platforms: ["pc" as const] } },
      { id: "xbox", game: { platforms: ["xbox" as const] } },
      { id: "unknown" },
    ];
    assert.deepEqual(
      dealsForPlatforms(deals, ["pc"]).map((deal) => deal.id),
      ["pc"],
    );
  });
});

describe("dealsForGame", () => {
  const target = { id: "game-123", slug: "hollow-knight-silksong" };

  it("matches canonical IDs, then uses a slug only when the record has no ID", () => {
    const deals = [
      { id: "deal-direct", gameId: "game-123" },
      { id: "deal-embedded", gameId: "", game: { id: "game-123" } },
      { id: "deal-slug", gameId: "", game: { slug: "hollow-knight-silksong" } },
      { id: "deal-other", gameId: "other-id", game: { id: "other-id", slug: "other" } },
      {
        id: "deal-conflict",
        gameId: "other-id",
        game: { id: "game-123", slug: "hollow-knight-silksong" },
      },
      { id: "deal-ghost", gameId: "", game: {} },
    ];
    assert.deepEqual(
      dealsForGame(deals, target).map((d) => d.id),
      ["deal-direct", "deal-embedded", "deal-slug"],
    );
  });

  it("never matches when target or deal keys are missing or undefined", () => {
    const deals = [
      { id: "d-missing-slug", gameId: "x", game: {} },
      { id: "d-empty", gameId: "", game: {} },
    ];
    assert.deepEqual(dealsForGame(deals, { id: "" }), []);
  });
});

describe("filterOwnedDeals", () => {
  const ownedGame = { id: "g1", slug: "owned-game", steamAppId: 100 } as Game;
  const unownedGame = { id: "g2", slug: "unowned-game", steamAppId: 200 } as Game;
  const unmappedGame = { id: "g3", slug: "unmapped-game" } as Game;

  const mockOwns = (game: Game | GameSummary) => {
    if (game.steamAppId === 100) return "owned" as const;
    if (game.steamAppId === 200) return "not_owned" as const;
    return "unknown" as const;
  };

  it("filters out owned deals while keeping unowned, unmapped, and unhydrated deals", () => {
    const deals = [
      { id: "d-owned", game: ownedGame },
      { id: "d-unowned", game: unownedGame },
      { id: "d-unmapped", game: unmappedGame },
      { id: "d-no-game" },
    ];

    const result = filterOwnedDeals(deals, mockOwns);
    assert.deepEqual(
      result.map((d) => d.id),
      ["d-unowned", "d-unmapped", "d-no-game"],
    );
  });

  it("returns all deals intact when none are owned", () => {
    const deals = [
      { id: "d1", game: unownedGame },
      { id: "d2", game: unmappedGame },
    ];
    const result = filterOwnedDeals(deals, mockOwns);
    assert.equal(result.length, 2);
  });
});

describe("filterOwnedGiveaways", () => {
  const gamesMap = new Map<string, Game>([
    ["g-owned", { id: "g-owned", slug: "owned", steamAppId: 100 } as Game],
    ["g-free", { id: "g-free", slug: "free", steamAppId: 200 } as Game],
    ["g-unknown", { id: "g-unknown", slug: "unknown" } as Game],
  ]);

  const mockOwns = (game: Game | GameSummary) => {
    if (game.steamAppId === 100) return "owned" as const;
    if (game.steamAppId === 200) return "not_owned" as const;
    return "unknown" as const;
  };

  const getGameFn = (id: string) => gamesMap.get(id);

  it("hides giveaways for games owned on Steam, preserving unowned and unknown ones", () => {
    const giveaways = [
      { id: "gw1", gameId: "g-owned" },
      { id: "gw2", gameId: "g-free" },
      { id: "gw3", gameId: "g-unknown" },
      { id: "gw4", gameId: "g-missing" },
    ];

    const result = filterOwnedGiveaways(giveaways, getGameFn, mockOwns);
    assert.deepEqual(
      result.map((g) => g.id),
      ["gw2", "gw3", "gw4"],
    );
  });

  it("checks gameSummary directly on giveaway when present", () => {
    const giveaways = [
      {
        id: "gw-sum-owned",
        gameId: "none",
        gameSummary: { id: "s-1", title: "Game", steamAppId: 100 },
      },
      {
        id: "gw-sum-free",
        gameId: "none",
        gameSummary: { id: "s-2", title: "Game 2", steamAppId: 200 },
      },
    ];

    const result = filterOwnedGiveaways(giveaways, () => undefined, mockOwns);
    assert.deepEqual(
      result.map((g) => g.id),
      ["gw-sum-free"],
    );
  });
});

describe("filterOffersByQueryAndDiscount", () => {
  const items = [
    {
      id: "1",
      discountPercent: 80,
      gameSummary: { title: "Hades II" },
      store: "Steam",
    },
    {
      id: "2",
      discountPercent: 50,
      gameSummary: { title: "Hollow Knight" },
      store: "GOG",
    },
    {
      id: "3",
      discountPercent: 100,
      gameSummary: { title: "Death Stranding" },
      store: "Epic Games Store",
    },
  ];

  it("filters by case-insensitive title search query", () => {
    const result = filterOffersByQueryAndDiscount(items, "hades");
    assert.equal(result.length, 1);
    assert.equal(result[0]?.id, "1");
  });

  it("filters by store name", () => {
    const result = filterOffersByQueryAndDiscount(items, "epic");
    assert.equal(result.length, 1);
    assert.equal(result[0]?.id, "3");
  });

  it("filters by minimum discount threshold", () => {
    const over75 = filterOffersByQueryAndDiscount(items, "", 75);
    assert.deepEqual(
      over75.map((i) => i.id),
      ["1", "3"],
    );

    const full100 = filterOffersByQueryAndDiscount(items, "", 100);
    assert.deepEqual(
      full100.map((i) => i.id),
      ["3"],
    );
  });
});
