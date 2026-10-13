import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { privateDataOnAccountChange, type PrivateBag, type PrivateStore } from "./private-data.ts";

const device: PrivateBag = { "inga.hiddenGames": '["game-1"]' };
const accountA: PrivateBag = { "inga.watchControls": '{"paused":true,"mutedGameIds":["game-5"]}' };
const empty: PrivateStore = { device, accounts: {} };

describe("privateDataOnAccountChange", () => {
  it("restores the device bag on logout", () => {
    const result = privateDataOnAccountChange({
      previousUserId: "user-a",
      nextUserId: null,
      store: { device, accounts: { "user-a": accountA } },
      active: accountA,
    });
    assert.deepEqual(result.active, device);
    assert.deepEqual(result.store.accounts["user-a"], accountA);
  });

  it("does not give account B the bag from account A", () => {
    const result = privateDataOnAccountChange({
      previousUserId: "user-a",
      nextUserId: "user-b",
      store: { device, accounts: { "user-a": accountA } },
      active: accountA,
    });
    assert.deepEqual(result.active, {});
    assert.deepEqual(result.store.accounts["user-a"], accountA);
  });

  it("keeps the device bag when the same signed-out session continues", () => {
    const active: PrivateBag = { "inga.hiddenGames": "[]" };
    const result = privateDataOnAccountChange({
      previousUserId: null,
      nextUserId: null,
      store: empty,
      active,
    });
    assert.equal(result.active, active);
  });
});
