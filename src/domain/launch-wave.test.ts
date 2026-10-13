import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { trustedLaunchWave } from "./launch-wave.ts";
import type { ReleaseEvent } from "./types.ts";

function event(overrides: Partial<ReleaseEvent>): ReleaseEvent {
  return {
    id: overrides.id ?? "evt",
    gameId: "game-1",
    date: "2026-09-10T02:00:00Z",
    precision: "exact",
    confidence: "confirmed",
    kind: "full",
    state: "upcoming",
    platforms: ["pc"],
    ...overrides,
  };
}

describe("trustedLaunchWave", () => {
  it("returns nothing for a single exact timestamp with no regional siblings", () => {
    const rows = trustedLaunchWave(
      [event({ timezone: "Asia/Ho_Chi_Minh", region: "Vietnam" })],
      "en-US",
    );
    assert.deepEqual(rows, []);
  });

  it("shows a wave only for two exact, trusted, regional timestamps", () => {
    const rows = trustedLaunchWave(
      [
        event({
          id: "vn",
          timezone: "Asia/Ho_Chi_Minh",
          region: "Vietnam",
          date: "2026-09-10T02:00:00Z",
        }),
        event({
          id: "jp",
          timezone: "Asia/Tokyo",
          region: "Japan",
          date: "2026-09-10T02:00:00Z",
        }),
        event({
          id: "rumor",
          timezone: "Europe/London",
          region: "United Kingdom",
          confidence: "unconfirmed",
        }),
        event({
          id: "month",
          precision: "month",
          timezone: "America/Los_Angeles",
          region: "United States",
        }),
      ],
      "en-US",
      "Asia/Tokyo",
    );
    assert.equal(rows.length, 2);
    assert.equal(rows[0]?.region, "Vietnam");
    assert.equal(rows[1]?.region, "Japan");
    assert.equal(rows[1]?.isUserRegion, true);
    assert.notEqual(rows[0]?.localTime, rows[1]?.localTime);
  });

  it("does not create a base-game launch wave from DLC or editions", () => {
    const rows = trustedLaunchWave(
      [
        event({
          id: "dlc-vn",
          kind: "dlc",
          timezone: "Asia/Ho_Chi_Minh",
          region: "Vietnam",
        }),
        event({
          id: "dlc-jp",
          kind: "expansion",
          timezone: "Asia/Tokyo",
          region: "Japan",
        }),
      ],
      "en-US",
    );
    assert.deepEqual(rows, []);
  });
});
