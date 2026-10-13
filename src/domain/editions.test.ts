import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isDefaultRadarEvent, mergeGameReleaseEvents, relatedContent } from "./editions.ts";
import type { ReleaseEvent } from "./types.ts";

function event(overrides: Partial<ReleaseEvent>): ReleaseEvent {
  return {
    id: overrides.id ?? "evt",
    gameId: "game-1",
    date: "2026-09-10T00:00:00Z",
    precision: "date",
    confidence: "confirmed",
    kind: "full",
    state: "upcoming",
    platforms: ["pc"],
    ...overrides,
  };
}

describe("edition graph boundaries", () => {
  it("keeps full and early access on the default radar", () => {
    assert.equal(isDefaultRadarEvent(event({ kind: "full" })), true);
    assert.equal(isDefaultRadarEvent(event({ kind: "early-access" })), true);
  });

  it("keeps DLC, demo, and beta off the default radar", () => {
    for (const kind of ["dlc", "expansion", "demo", "beta"] as const) {
      assert.equal(isDefaultRadarEvent(event({ kind })), false);
    }
  });

  it("groups later DLC under the base game instead of as a second game", () => {
    const related = relatedContent([
      event({ id: "base", kind: "full", date: "2026-01-01T00:00:00Z" }),
      event({ id: "dlc", kind: "dlc", date: "2028-03-01T00:00:00Z" }),
      event({ id: "demo", kind: "demo", date: "2025-11-01T00:00:00Z" }),
    ]);
    assert.deepEqual(
      related.map((item) => item.id),
      ["demo", "dlc"],
    );
  });

  it("merges only catalogue events whose snapshot and event IDs match the game", () => {
    const base = [event({ id: "base", kind: "full", date: "2026-01-01T00:00:00Z" })];
    const feedEntries = [
      {
        game: { id: "game-1", slug: "game-one" },
        event: event({ id: "dlc-1", kind: "dlc", date: "2026-06-01T00:00:00Z" }),
      },
      {
        game: { id: "game-1", slug: "game-one" },
        event: event({ id: "dlc-2", kind: "dlc", date: "2026-12-01T00:00:00Z" }),
      },
      {
        game: { id: "game-other", slug: "game-one" },
        event: event({ id: "conflict-snapshot", kind: "dlc", date: "2026-07-01T00:00:00Z" }),
      },
      {
        game: { id: "game-1", slug: "game-one" },
        event: event({
          id: "conflict-event",
          gameId: "game-other",
          kind: "dlc",
          date: "2026-08-01T00:00:00Z",
        }),
      },
      {
        game: { id: "game-1", slug: "game-one" },
        event: event({ id: "base", kind: "full", date: "2026-01-01T00:00:00Z" }), // duplicate
      },
    ];

    const merged = mergeGameReleaseEvents(base, feedEntries, { id: "game-1" });
    assert.deepEqual(
      merged.map((e) => e.id),
      ["base", "dlc-1", "dlc-2"],
    );
    const related = relatedContent(merged);
    assert.deepEqual(
      related.map((e) => e.id),
      ["dlc-1", "dlc-2"],
    );
  });

  it("never matches when target or entry keys are missing or undefined", () => {
    const base = [event({ id: "base", kind: "full" })];
    const feedEntries = [
      {
        game: {},
        event: event({ id: "ghost", kind: "dlc" }),
      },
      {
        game: {},
        event: event({ id: "ghost2", kind: "dlc" }),
      },
    ];
    const merged = mergeGameReleaseEvents(base, feedEntries, { id: "" });
    assert.deepEqual(
      merged.map((e) => e.id),
      ["base"],
    );
  });
});
