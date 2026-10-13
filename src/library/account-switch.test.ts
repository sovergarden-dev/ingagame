import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { libraryOnAccountChange } from "./account-switch.ts";

const device = { wishlist: ["local"], following: [] };
const accountA = { wishlist: ["a"], following: ["a2"] };
const accountB = { wishlist: ["b"], following: [] };

describe("libraryOnAccountChange", () => {
  it("restores the device list on logout and does not keep the account list", () => {
    const next = libraryOnAccountChange({
      previousUserId: "user-a",
      nextUserId: null,
      current: accountA,
      anonymous: device,
      account: null,
    });
    assert.deepEqual(next.current, device);
  });

  it("does not upload user A into user B", () => {
    const next = libraryOnAccountChange({
      previousUserId: "user-a",
      nextUserId: "user-b",
      current: accountA,
      anonymous: device,
      account: accountB,
    });
    assert.deepEqual(next.current, accountB);
    assert.deepEqual(next.anonymous, device);
  });

  it("keeps a device list on first sign-in when the account is empty", () => {
    const next = libraryOnAccountChange({
      previousUserId: null,
      nextUserId: "user-a",
      current: device,
      anonymous: { wishlist: [], following: [] },
      account: { wishlist: [], following: [] },
    });
    assert.deepEqual(next.current, device);
  });
});
