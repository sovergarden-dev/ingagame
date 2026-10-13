import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { trackedReleaseChanges } from "./release-changes.ts";

describe("trackedReleaseChanges", () => {
  const moved = { game: { id: "g1" }, event: { id: "e1", previousDate: "2026-08-01" } };
  const steady = { game: { id: "g1" }, event: { id: "e2" } };
  const other = { game: { id: "g2" }, event: { id: "e3", previousDate: "2026-08-02" } };

  it("returns only tracked games whose date actually changed", () => {
    const result = trackedReleaseChanges([moved, steady, other, moved], new Set(["g1"]));
    assert.deepEqual(
      result.map((item) => item.event.id),
      ["e1"],
    );
  });
});
