import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isLocaleCode } from "./locales.ts";

describe("isLocaleCode", () => {
  it("accepts the seven UI locales and rejects anything else", () => {
    assert.equal(isLocaleCode("vi"), true);
    assert.equal(isLocaleCode("pt-BR"), true);
    assert.equal(isLocaleCode("en-US"), false);
    assert.equal(isLocaleCode(null), false);
  });
});
