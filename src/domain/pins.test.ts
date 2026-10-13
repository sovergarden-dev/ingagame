import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pinnedGames, togglePin } from "./pins.ts";

describe("pins", () => {
  it("pins and unpins without duplicating an id", () => {
    assert.deepEqual(togglePin([], "game-6"), ["game-6"]);
    assert.deepEqual(togglePin(["game-6"], "game-6"), []);
  });

  it("keeps pin order and drops ids that are not in the catalogue", () => {
    const games = [{ id: "b" }, { id: "a" }];
    assert.deepEqual(
      pinnedGames(["missing", "a", "b"], games).map((game) => game.id),
      ["a", "b"],
    );
  });
});
