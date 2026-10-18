import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { articlesForFollowed, articlesForGame, toGameSummary } from "./news.ts";
import type { Game, GameSummary } from "./types.ts";

describe("toGameSummary", () => {
  it("converts Game entity to minimal compliant GameSummary", () => {
    const game = {
      id: "steam-1145350",
      slug: "hades-ii",
      title: "Hades II",
      developer: "Supergiant Games",
      publisher: "Supergiant Games",
      summary: "Action rogue-like.",
      genres: ["Action", "Roguelike"],
      coverUrl: "https://example.test/cover.jpg",
      platforms: ["pc"],
      releaseEvents: [],
      steamAppId: 1145350,
    } as unknown as Game;

    const summary = toGameSummary(game);
    assert.ok(summary);
    assert.equal(summary.id, "steam-1145350");
    assert.equal(summary.title, "Hades II");
    assert.equal(summary.coverUrl, "https://example.test/cover.jpg");
    assert.equal(summary.steamAppId, 1145350);
    assert.equal(summary.source, "catalogue");
    assert.ok(summary.observedAt);
  });

  it("returns undefined when game is undefined", () => {
    assert.equal(toGameSummary(undefined), undefined);
  });
});

describe("articlesForFollowed", () => {
  it("keeps articles for followed games and drops the rest", () => {
    const articles = [{ id: "a", gameId: "game-1" }, { id: "b", gameId: "game-2" }, { id: "c" }];
    assert.deepEqual(
      articlesForFollowed(articles, ["game-1"]).map((article) => article.id),
      ["a"],
    );
  });
});

describe("articlesForGame", () => {
  const target = { id: "game-10", slug: "elden-ring-dlc" };

  it("matches canonical IDs, then uses a slug only when the article has no ID", () => {
    const articles = [
      { id: "art-direct", gameId: "game-10" },
      { id: "art-embedded", game: { id: "game-10" } },
      { id: "art-slug", game: { slug: "elden-ring-dlc" } },
      { id: "art-other", gameId: "other", game: { id: "other", slug: "other" } },
      { id: "art-conflict", gameId: "other", game: { id: "game-10", slug: "elden-ring-dlc" } },
      { id: "art-ghost", game: {} },
    ];
    assert.deepEqual(
      articlesForGame(articles, target).map((a) => a.id),
      ["art-direct", "art-embedded", "art-slug"],
    );
  });

  it("never matches when target or article keys are missing or undefined", () => {
    const articles = [
      { id: "a-missing-slug", gameId: "x", game: {} },
      { id: "a-empty", game: {} },
    ];
    assert.deepEqual(articlesForGame(articles, { id: "" }), []);
  });
});
