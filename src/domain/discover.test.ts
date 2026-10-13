import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { discoverGames } from "./discover.ts";
import type { Game } from "./types.ts";

function game(partial: Partial<Game> & Pick<Game, "id" | "title">): Game {
  return {
    slug: partial.id,
    developer: "Studio",
    publisher: "Studio",
    summary: "",
    genres: [],
    coverUrl: "/cover.jpg",
    platforms: ["pc"],
    releaseEvents: [],
    ...partial,
  };
}

describe("discoverGames", () => {
  const catalogue = [
    game({ id: "a", title: "Aetherfall", genres: ["RPG"], hypeScore: 10, platforms: ["pc"] }),
    game({ id: "b", title: "Harborlight", genres: ["Cozy"], hypeScore: 40, platforms: ["switch"] }),
  ];

  it("searches only the catalogue it was given", () => {
    const result = discoverGames(catalogue, { query: "harbor" });
    assert.deepEqual(
      result.map((item) => item.id),
      ["b"],
    );
  });

  it("sorts by hype within the same catalogue", () => {
    const result = discoverGames(catalogue, { sort: "hype" });
    assert.deepEqual(
      result.map((item) => item.id),
      ["b", "a"],
    );
  });

  it("drops games the user hid", () => {
    const result = discoverGames(catalogue, { hiddenIds: ["b"] });
    assert.deepEqual(
      result.map((item) => item.id),
      ["a"],
    );
  });

  it("drops every game that shares a hidden genre", () => {
    const result = discoverGames(catalogue, { hiddenGenres: ["cozy"] });
    assert.deepEqual(
      result.map((item) => item.id),
      ["a"],
    );
  });

  it("keeps only games on the selected platforms", () => {
    const result = discoverGames(catalogue, { myPlatformIds: ["pc"] });
    assert.deepEqual(
      result.map((item) => item.id),
      ["a"],
    );
  });
});
