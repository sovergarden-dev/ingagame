import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { freshnessMode } from "./online.ts";

describe("freshnessMode", () => {
  it("keeps the live badge only while online", () => {
    assert.equal(freshnessMode(true), "live");
    assert.equal(freshnessMode(false), "offline");
  });
});
