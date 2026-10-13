import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dealsForGame, dealsForPlatforms, liveDeals } from "./deal.ts";

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
