import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { LOCAL_DATA_KEYS, localDataExport } from "./local-data.ts";

describe("local data export", () => {
  it("copies present Inga keys and skips empty ones", () => {
    const store = new Map<string, string>([
      ["gamepulse.preferences", '{"theme":"dark"}'],
      ["sb-auth-token", "secret"],
    ]);
    const exported = localDataExport((key) => store.get(key) ?? null, "2026-09-25T00:00:00.000Z");
    assert.equal(exported.kind, "inga-local-data");
    assert.deepEqual(exported.data, { "gamepulse.preferences": '{"theme":"dark"}' });
    assert.equal("sb-auth-token" in exported.data, false);
  });

  it("lists the keys a local delete is allowed to remove", () => {
    assert.ok(LOCAL_DATA_KEYS.includes("gamepulse.library"));
    assert.ok(LOCAL_DATA_KEYS.includes("inga.watchControls"));
    assert.equal(
      LOCAL_DATA_KEYS.some((key) => key.includes("auth")),
      false,
    );
  });
});
