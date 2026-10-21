import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getOwnershipStatus,
  isValidSteamAppId,
  resolveGameSteamAppId,
  shouldHideOwnedGame,
} from "./ownership.ts";
import type { Game } from "./types.ts";

function createMockGame(overrides: Partial<Game> = {}): Game {
  return {
    id: "game-test-1",
    slug: "game-test-1",
    title: "Test Game",
    developer: "Dev",
    publisher: "Pub",
    summary: "Summary",
    genres: ["Action"],
    coverUrl: "/cover.jpg",
    platforms: ["pc", "steam"],
    releaseEvents: [],
    ...overrides,
  };
}

describe("isValidSteamAppId", () => {
  it("accepts valid uint32 positive integers", () => {
    assert.equal(isValidSteamAppId(730), true);
    assert.equal(isValidSteamAppId(1), true);
    assert.equal(isValidSteamAppId(0xffffffff), true);
  });

  it("rejects 0, negative, floating point, NaN, and non-numeric types", () => {
    assert.equal(isValidSteamAppId(0), false);
    assert.equal(isValidSteamAppId(-1), false);
    assert.equal(isValidSteamAppId(730.5), false);
    assert.equal(isValidSteamAppId(NaN), false);
    assert.equal(isValidSteamAppId("730"), false);
    assert.equal(isValidSteamAppId(null), false);
    assert.equal(isValidSteamAppId(undefined), false);
    assert.equal(isValidSteamAppId(0x100000000), false);
  });
});

describe("resolveGameSteamAppId", () => {
  it("resolves steamAppId directly from a Game object", () => {
    const game = createMockGame({ steamAppId: 730 });
    assert.equal(resolveGameSteamAppId(game), 730);
  });

  it("returns undefined for a Game object without steamAppId or with invalid AppID", () => {
    const game = createMockGame();
    assert.equal(resolveGameSteamAppId(game), undefined);

    const invalidGame = createMockGame({ steamAppId: 0 });
    assert.equal(resolveGameSteamAppId(invalidGame), undefined);
  });

  it("resolves through catalogue resolver when given a canonical string ID", () => {
    const game = createMockGame({ id: "game-real", steamAppId: 1145360 });
    const resolver = (id: string) => (id === "game-real" ? game : undefined);
    assert.equal(resolveGameSteamAppId("game-real", resolver), 1145360);
  });

  it("never casts string numbers directly to AppIDs (avoids ID space collision)", () => {
    // "730" should not be magically treated as AppID 730 without catalogue match
    assert.equal(resolveGameSteamAppId("730"), undefined);
    const resolver = () => undefined;
    assert.equal(resolveGameSteamAppId("730", resolver), undefined);
  });

  it("resolves steamAppId from storeRefs when top-level steamAppId is absent", () => {
    const summary = {
      id: "game-summary-1",
      title: "Store Ref Game",
      storeRefs: [{ store: "steam" as const, appId: 1091500 }],
    };
    assert.equal(resolveGameSteamAppId(summary), 1091500);
  });

  it("returns undefined when storeRefs contains non-Steam stores", () => {
    const epicSummary = {
      id: "epic-game-1",
      title: "Epic Only Game",
      storeRefs: [
        { store: "epic" as const, namespace: "ns", offerId: "off-1" },
        { store: "gog" as const, productId: "gog-1" },
      ],
    };
    assert.equal(resolveGameSteamAppId(epicSummary), undefined);
  });

  it("prioritizes direct steamAppId over storeRefs", () => {
    const dual = {
      id: "dual-id",
      title: "Dual Game",
      steamAppId: 730,
      storeRefs: [{ store: "steam" as const, appId: 570 }],
    };
    assert.equal(resolveGameSteamAppId(dual), 730);
  });
});

describe("getOwnershipStatus", () => {
  const ownedSet = new Set([730, 570]);

  it("returns unknown when disconnected from Steam", () => {
    const status = getOwnershipStatus({
      connected: false,
      syncStatus: "idle",
      ownedAppIdsSet: null,
      steamAppId: 730,
    });
    assert.equal(status, "unknown");
  });

  it("returns owned when game is matched in mock list", () => {
    const status = getOwnershipStatus({
      connected: true,
      syncStatus: "idle",
      ownedAppIdsSet: null,
      gameId: "mock-game-1",
      mockOwnedGameIds: ["mock-game-1", "mock-game-2"],
    });
    assert.equal(status, "owned");
  });

  it("returns unknown when game has no valid steamAppId", () => {
    const status = getOwnershipStatus({
      connected: true,
      syncStatus: "synced",
      ownedAppIdsSet: ownedSet,
      steamAppId: undefined,
    });
    assert.equal(status, "unknown");
  });

  it("returns unknown when syncStatus is unavailable or failed", () => {
    const unavailable = getOwnershipStatus({
      connected: true,
      syncStatus: "unavailable",
      ownedAppIdsSet: ownedSet,
      steamAppId: 730,
    });
    assert.equal(unavailable, "unknown");

    const failed = getOwnershipStatus({
      connected: true,
      syncStatus: "failed",
      ownedAppIdsSet: ownedSet,
      steamAppId: 730,
    });
    assert.equal(failed, "unknown");
  });

  it("preserves ownership during background syncing when previous snapshot verified it", () => {
    const status = getOwnershipStatus({
      connected: true,
      syncStatus: "syncing",
      ownedAppIdsSet: ownedSet,
      steamAppId: 730,
    });
    assert.equal(status, "owned");
  });

  it("returns owned when steamAppId is in ownedAppIdsSet and syncStatus is synced", () => {
    const status = getOwnershipStatus({
      connected: true,
      syncStatus: "synced",
      ownedAppIdsSet: ownedSet,
      steamAppId: 730,
    });
    assert.equal(status, "owned");
  });

  it("returns not_owned only when syncStatus is synced and steamAppId is not in set", () => {
    const status = getOwnershipStatus({
      connected: true,
      syncStatus: "synced",
      ownedAppIdsSet: ownedSet,
      steamAppId: 1091500, // Cyberpunk not in set
    });
    assert.equal(status, "not_owned");
  });

  it("returns unknown when syncStatus is idle without prior snapshot", () => {
    const status = getOwnershipStatus({
      connected: true,
      syncStatus: "idle",
      ownedAppIdsSet: null,
      steamAppId: 730,
    });
    assert.equal(status, "unknown");
  });
});

describe("shouldHideOwnedGame", () => {
  const game = createMockGame({ steamAppId: 730 });

  it("returns false when hideOwned is false", () => {
    const hidden = shouldHideOwnedGame(game, false, () => "owned");
    assert.equal(hidden, false);
  });

  it("returns true only when hideOwned is true and ownership is confirmed owned", () => {
    const hidden = shouldHideOwnedGame(game, true, () => "owned");
    assert.equal(hidden, true);
  });

  it("returns false when ownership is unknown (never false-positive hides unknown games)", () => {
    const hidden = shouldHideOwnedGame(game, true, () => "unknown");
    assert.equal(hidden, false);
  });

  it("returns false when ownership is not_owned", () => {
    const hidden = shouldHideOwnedGame(game, true, () => "not_owned");
    assert.equal(hidden, false);
  });
});
