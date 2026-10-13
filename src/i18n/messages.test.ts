import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { LOCALES } from "./locales.ts";
import { CATALOGUES, en, type MessageKey } from "./messages.ts";

const tokens = (value: string) =>
  [...value.matchAll(/\{[a-zA-Z]+\}/g)].map((match) => match[0]).sort();

describe("locale catalogues", () => {
  it("translates the short Free nav label in Vietnamese", () => {
    assert.equal(en["nav.freeShort"], "Free");
    assert.equal(CATALOGUES.vi["nav.freeShort"], "Miễn phí");
  });

  it("covers every English key and keeps placeholders and the motto", () => {
    const keys = Object.keys(en) as MessageKey[];
    for (const locale of LOCALES) {
      for (const key of keys) {
        const value = CATALOGUES[locale.code][key];
        assert.equal(typeof value, "string", `${locale.code} ${key}`);
        assert.deepEqual(tokens(value ?? ""), tokens(en[key]), `${locale.code} ${key}`);
      }
      assert.equal(CATALOGUES[locale.code]["app.motto"], en["app.motto"]);
      assert.equal(CATALOGUES[locale.code]["app.name"], "Inga");
    }
  });
});
