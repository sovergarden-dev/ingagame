import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { EMPTY_WATCH_CONTROLS, shouldDeliverAlert, toggleMutedGame } from "./watch-controls.ts";

describe("watch controls", () => {
  it("delivers when alerts are on and the game is not muted", () => {
    assert.equal(shouldDeliverAlert(EMPTY_WATCH_CONTROLS, "game-1"), true);
  });

  it("holds every alert while paused", () => {
    assert.equal(shouldDeliverAlert({ paused: true, mutedGameIds: [] }, "game-1"), false);
    assert.equal(shouldDeliverAlert({ paused: true, mutedGameIds: [] }, undefined), false);
  });

  it("holds only the muted game", () => {
    const controls = { paused: false, mutedGameIds: ["game-5"] };
    assert.equal(shouldDeliverAlert(controls, "game-5"), false);
    assert.equal(shouldDeliverAlert(controls, "game-1"), true);
  });

  it("mutes and unmutes without dropping the pause flag", () => {
    const muted = toggleMutedGame({ paused: true, mutedGameIds: [] }, "game-5");
    assert.deepEqual(muted, { paused: true, mutedGameIds: ["game-5"] });
    assert.deepEqual(toggleMutedGame(muted, "game-5"), { paused: true, mutedGameIds: [] });
  });
});
