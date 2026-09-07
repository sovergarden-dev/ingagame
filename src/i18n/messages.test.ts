import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CATALOGUES, en } from "./messages.ts";

describe("vi catalogue", () => {
  it("translates the short Free nav label instead of falling back to English", () => {
    assert.equal(en["nav.freeShort"], "Free");
    assert.equal(CATALOGUES.vi["nav.freeShort"], "Miễn phí");
  });
});
