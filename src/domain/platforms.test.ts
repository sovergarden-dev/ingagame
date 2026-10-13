import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isPlatformFilterId, matchesPlatformFilter } from "./platforms.ts";

describe("platform filters", () => {
  it("accepts the rail filters and rejects an unknown id", () => {
    assert.equal(isPlatformFilterId("mine"), true);
    assert.equal(isPlatformFilterId("sega"), false);
    assert.equal(isPlatformFilterId(null), false);
  });

  it("keeps a release on My Platforms only when one of its platforms is selected", () => {
    assert.equal(matchesPlatformFilter(["xbox"], "mine", ["pc", "steam"]), false);
    assert.equal(matchesPlatformFilter(["pc", "xbox"], "mine", ["pc"]), true);
  });
});
