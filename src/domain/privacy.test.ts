import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { allowsCloudSync } from "./privacy.ts";

describe("allowsCloudSync", () => {
  it("uploads only when privacy is not local-first", () => {
    assert.equal(allowsCloudSync("balanced"), true);
    assert.equal(allowsCloudSync("personalized"), true);
    assert.equal(allowsCloudSync("local"), false);
  });
});
