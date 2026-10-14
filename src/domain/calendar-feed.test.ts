import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calendarEventUid, calendarFeedEvents, isRevocableFeedToken } from "./calendar-feed.ts";
import type { ReleaseEvent } from "./types.ts";

function event(
  partial: Partial<ReleaseEvent> & Pick<ReleaseEvent, "id" | "kind" | "precision">,
): ReleaseEvent {
  return {
    gameId: "game",
    date: "2026-09-10",
    confidence: "confirmed",
    state: "upcoming",
    platforms: ["pc"],
    ...partial,
  };
}

describe("calendar feed contract", () => {
  it("keeps the same UID when the date would change", () => {
    assert.equal(calendarEventUid("exact-1"), "exact-1@inga");
  });

  it("accepts a long token and rejects a short or empty one", () => {
    assert.equal(isRevocableFeedToken("a".repeat(32)), true);
    assert.equal(isRevocableFeedToken("user-123"), false);
    assert.equal(isRevocableFeedToken(""), false);
  });

  it("keeps full releases and drops DLC when that scope is on", () => {
    const rows = [
      { event: event({ id: "full", kind: "full", precision: "date" }) },
      { event: event({ id: "dlc", kind: "dlc", precision: "date" }) },
      { event: event({ id: "month", kind: "full", precision: "month" }) },
      { event: event({ id: "full", kind: "full", precision: "date" }) },
    ];
    assert.deepEqual(
      calendarFeedEvents(rows, { fullOnly: true }).map((row) => row.event.id),
      ["full"],
    );
  });

  it("keeps DLC when the full-only scope is off", () => {
    const rows = [
      { event: event({ id: "full", kind: "full", precision: "exact" }) },
      { event: event({ id: "dlc", kind: "dlc", precision: "date" }) },
    ];
    assert.deepEqual(
      calendarFeedEvents(rows, { fullOnly: false }).map((row) => row.event.id),
      ["full", "dlc"],
    );
  });
});
