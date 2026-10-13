import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatReleaseDate, safeTimeZone } from "./release.ts";

describe("safeTimeZone", () => {
  it("keeps a real zone and falls back when the name is invalid", () => {
    assert.equal(safeTimeZone("Asia/Ho_Chi_Minh"), "Asia/Ho_Chi_Minh");
    assert.equal(safeTimeZone("not-a-zone"), "UTC");
  });
});

describe("formatReleaseDate exact zone", () => {
  it("shows an exact instant in the requested zone", () => {
    const label = formatReleaseDate("2026-09-10T02:00:00Z", "exact", "en-US", "Asia/Ho_Chi_Minh");
    assert.match(label, /9:00/);
  });
});
