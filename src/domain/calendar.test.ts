import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canExportCalendar,
  primaryRelease,
  releaseEventIcs,
  watchlistCalendarIcs,
} from "./calendar.ts";
import type { ReleaseEvent } from "./types.ts";

function event(overrides: Partial<ReleaseEvent> = {}): ReleaseEvent {
  return {
    id: "evt-1",
    gameId: "game-1",
    date: "2026-09-10T02:00:00Z",
    precision: "exact",
    confidence: "confirmed",
    kind: "full",
    state: "upcoming",
    platforms: ["pc"],
    ...overrides,
  };
}

describe("releaseEventIcs", () => {
  it("exports an exact release as a UTC timestamp, not a made-up local clock", () => {
    const ics = releaseEventIcs(event(), "Aetherfall", new Date("2026-09-01T00:00:00Z"));
    assert.ok(ics);
    assert.match(ics, /DTSTART:20260910T020000Z/);
    assert.doesNotMatch(ics, /VALUE=DATE/);
  });

  it("exports a date-only release as an all-day event", () => {
    const ics = releaseEventIcs(
      event({
        precision: "date",
        date: "2026-09-04T00:00:00Z",
        timezone: "UTC",
      }),
      "Harborlight",
      new Date("2026-09-01T00:00:00Z"),
    );
    assert.ok(ics);
    assert.match(ics, /DTSTART;VALUE=DATE:20260904/);
    assert.match(ics, /DTEND;VALUE=DATE:20260905/);
    assert.doesNotMatch(ics, /DTSTART:\d{8}T/);
  });

  it("refuses month, quarter, year, and TBA so no clock is invented", () => {
    for (const precision of ["month", "quarter", "year", "tba"] as const) {
      assert.equal(canExportCalendar(event({ precision })), false);
      assert.equal(releaseEventIcs(event({ precision }), "Game"), null);
    }
  });
});

describe("watchlistCalendarIcs", () => {
  it("keeps a stable UID, skips month precision, and does not repeat an event", () => {
    const exact = event({ id: "exact-1", precision: "exact", date: "2026-09-10T02:00:00Z" });
    const month = event({ id: "month-1", precision: "month" });
    const ics = watchlistCalendarIcs(
      [
        { event: exact, title: "Aetherfall" },
        { event: exact, title: "Aetherfall" },
        { event: month, title: "Later" },
      ],
      new Date("2026-09-01T00:00:00Z"),
    );
    assert.equal(ics.split("BEGIN:VEVENT").length - 1, 1);
    assert.match(ics, /UID:exact-1@inga/);
    assert.match(ics, /DTSTART:20260910T020000Z/);
    assert.doesNotMatch(ics, /Later/);
  });
});

describe("primaryRelease", () => {
  it("picks the next upcoming full release rather than an earlier one", () => {
    const past = event({ id: "past", date: "2026-01-01T00:00:00Z" });
    const next = event({ id: "next", date: "2026-12-01T00:00:00Z" });
    assert.equal(primaryRelease([past, next], Date.parse("2026-06-01T00:00:00Z"))?.id, "next");
  });

  it("keeps a shipped full release ahead of a later DLC", () => {
    const full = event({ id: "full", kind: "full", date: "2026-01-01T00:00:00Z" });
    const dlc = event({ id: "dlc", kind: "dlc", date: "2026-12-01T00:00:00Z" });
    assert.equal(primaryRelease([dlc, full], Date.parse("2026-06-01T00:00:00Z"))?.id, "full");
  });

  it("does not let an earlier DLC replace the base-game primary release", () => {
    const full = event({ id: "full", kind: "full", date: "2026-12-01T00:00:00Z" });
    const dlc = event({ id: "dlc", kind: "dlc", date: "2026-06-01T00:00:00Z" });
    assert.equal(primaryRelease([dlc, full], Date.parse("2026-01-01T00:00:00Z"))?.id, "full");
  });
});
