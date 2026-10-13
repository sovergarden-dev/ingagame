import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cacheDecision } from "./cache-policy.ts";

const origin = "https://inga.test";

describe("cacheDecision", () => {
  it("never caches the catalogue or another origin", () => {
    assert.equal(
      cacheDecision(
        new URL("https://proj.supabase.co/functions/v1/content-feed?kind=releases"),
        { method: "GET", mode: "cors" },
        origin,
      ),
      "network-only",
    );
    assert.equal(
      cacheDecision(
        new URL(`${origin}/functions/v1/content-feed`),
        { method: "GET", mode: "cors" },
        origin,
      ),
      "network-only",
    );
  });

  it("uses the network first for pages and cache-first only for hashed assets", () => {
    assert.equal(
      cacheDecision(new URL(`${origin}/`), { method: "GET", mode: "navigate" }, origin),
      "network-first",
    );
    assert.equal(
      cacheDecision(
        new URL(`${origin}/assets/index-abc123.js`),
        { method: "GET", mode: "no-cors" },
        origin,
      ),
      "cache-first",
    );
    assert.equal(
      cacheDecision(new URL(`${origin}/`), { method: "POST", mode: "navigate" }, origin),
      "network-only",
    );
  });
});
