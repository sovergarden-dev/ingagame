import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { radarWinners, releaseConflicts } from "./conflicts.ts";
import type { ReleaseEvent } from "./types.ts";

function entry(
  id: string,
  confidence: ReleaseEvent["confidence"],
  platform: ReleaseEvent["platforms"][number] = "pc",
): {
  event: ReleaseEvent;
} {
  return {
    event: {
      id,
      gameId: "game-1",
      date: "2026-09-10T00:00:00Z",
      precision: "date",
      confidence,
      kind: "full",
      state: "upcoming",
      platforms: [platform],
    },
  };
}

describe("radarWinners", () => {
  it("keeps the higher-confidence date when two sources disagree", () => {
    const winners = radarWinners([entry("rumor", "unconfirmed"), entry("official", "confirmed")]);
    assert.deepEqual(
      winners.map((item) => item.event.id),
      ["official"],
    );
  });

  it("does not merge different platforms", () => {
    const winners = radarWinners([
      entry("pc", "confirmed", "pc"),
      entry("console", "confirmed", "playstation"),
    ]);
    assert.equal(winners.length, 2);
  });

  it("records the lower-confidence date as a conflict", () => {
    const rumor = entry("rumor", "unconfirmed").event;
    rumor.date = "2026-11-01T00:00:00Z";
    const official = entry("official", "confirmed").event;
    const conflicts = releaseConflicts([rumor, official]);
    assert.equal(conflicts.length, 1);
    assert.equal(conflicts[0]?.event.id, "rumor");
    assert.equal(conflicts[0]?.winnerId, "official");
  });
});
