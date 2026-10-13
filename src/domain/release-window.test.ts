import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isReleaseStillAhead } from "./release.ts";
import type { ReleaseEvent } from "./types.ts";

function event(overrides: Partial<ReleaseEvent> = {}): ReleaseEvent {
  return {
    id: "evt",
    gameId: "game",
    date: "2026-09-10T02:00:00Z",
    precision: "exact",
    confidence: "confirmed",
    kind: "full",
    state: "upcoming",
    platforms: ["pc"],
    timezone: "UTC",
    ...overrides,
  };
}

const before = Date.parse("2026-09-10T01:00:00Z");
const after = Date.parse("2026-09-10T03:00:00Z");

describe("isReleaseStillAhead", () => {
  it("keeps an exact release until that instant", () => {
    assert.equal(isReleaseStillAhead(event(), before), true);
    assert.equal(isReleaseStillAhead(event(), after), false);
  });

  it("keeps a date-only release through that UTC day", () => {
    const dated = event({ precision: "date", date: "2026-09-10T00:00:00Z" });
    assert.equal(isReleaseStillAhead(dated, Date.parse("2026-09-10T23:00:00Z")), true);
    assert.equal(isReleaseStillAhead(dated, Date.parse("2026-09-11T00:00:00Z")), false);
  });

  it("keeps a month until the next month and never drops TBA", () => {
    const month = event({ precision: "month", date: "2026-09-01T00:00:00Z" });
    assert.equal(isReleaseStillAhead(month, Date.parse("2026-09-25T00:00:00Z")), true);
    assert.equal(isReleaseStillAhead(month, Date.parse("2026-10-01T00:00:00Z")), false);
    assert.equal(isReleaseStillAhead(event({ precision: "tba" }), after), true);
  });

  it("does not treat an available release as still ahead", () => {
    assert.equal(isReleaseStillAhead(event({ state: "available" }), before), false);
  });
});
