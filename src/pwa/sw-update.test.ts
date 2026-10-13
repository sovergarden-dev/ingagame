import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { shouldOfferSwUpdate } from "./sw-update.ts";

describe("shouldOfferSwUpdate", () => {
  it("stays quiet on the first install", () => {
    assert.equal(shouldOfferSwUpdate({ hasController: false, hasWaitingWorker: true }), false);
  });

  it("offers a reload when a newer worker is waiting", () => {
    assert.equal(shouldOfferSwUpdate({ hasController: true, hasWaitingWorker: true }), true);
    assert.equal(shouldOfferSwUpdate({ hasController: true, hasWaitingWorker: false }), false);
  });
});
