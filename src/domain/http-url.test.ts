import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { httpUrl } from "./http-url.ts";

describe("httpUrl", () => {
  it("keeps http and https", () => {
    assert.equal(httpUrl("https://example.com/story"), "https://example.com/story");
  });

  it("rejects missing, relative, and non-http schemes", () => {
    assert.equal(httpUrl(undefined), null);
    assert.equal(httpUrl("/news"), null);
    assert.equal(httpUrl("javascript:alert(1)"), null);
  });
});
