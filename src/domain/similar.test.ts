import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sharedGenres, similarGames } from "./similar.ts";
import type { Game } from "./types.ts";

function game(id: string, title: string, genres: string[]): Game {
  return {
    id,
    slug: id,
    title,
    developer: "Studio",
    publisher: "Studio",
    summary: "",
    genres,
    coverUrl: "/cover.jpg",
    platforms: ["pc"],
    releaseEvents: [],
  };
}

describe("similarGames", () => {
  const base = game("base", "Aetherfall", ["Action RPG", "Open World"]);

  it("returns nothing when no other game shares a genre", () => {
    const result = similarGames(base, [base, game("other", "Harborlight", ["Life Sim"])]);
    assert.deepEqual(result, []);
  });

  it("ranks a closer genre match ahead of a single shared genre", () => {
    const result = similarGames(base, [
      game("one", "Zed", ["Open World"]),
      game("two", "Alpha", ["Action RPG", "Open World"]),
    ]);
    assert.deepEqual(
      result.map((item) => item.id),
      ["two", "one"],
    );
  });

  it("leaves out a hidden game even when genres overlap", () => {
    const result = similarGames(base, [game("two", "Alpha", ["Action RPG", "Open World"])], 6, [
      "two",
    ]);
    assert.deepEqual(result, []);
  });

  it("names only the genres both games actually share", () => {
    assert.deepEqual(sharedGenres(base, game("two", "Alpha", ["action rpg", "Horror"])), [
      "Action RPG",
    ]);
  });
});
