import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  HOME_SNAPSHOT_VERSION,
  chooseHomeSnapshot,
  gameFromHomeSnapshot,
  parseHomeSnapshot,
  serializeHomeSnapshot,
  type HomeSnapshot,
} from "./home-snapshot.ts";

const snapshot: HomeSnapshot = {
  version: HOME_SNAPSHOT_VERSION,
  savedAt: "2026-09-25T00:00:00.000Z",
  slug: "quiet-provinces",
  title: "Quiet Provinces",
  summary: "A valley.",
  coverUrl: "/cover.jpg",
  developer: "Longtable",
  publisher: "Longtable",
  platforms: ["pc"],
  event: {
    id: "evt",
    gameId: "game",
    date: "2026-10-01T00:00:00Z",
    precision: "quarter",
    confidence: "expected",
    kind: "full",
    state: "upcoming",
    platforms: ["pc"],
  },
};

describe("parseHomeSnapshot", () => {
  it("round-trips a versioned public hero and drops a different version", () => {
    assert.equal(parseHomeSnapshot(serializeHomeSnapshot(snapshot))?.slug, "quiet-provinces");
    const stale = serializeHomeSnapshot({ ...snapshot, version: 1 });
    const parsed = JSON.parse(stale) as HomeSnapshot;
    parsed.version = 0 as HomeSnapshot["version"];
    assert.equal(parseHomeSnapshot(JSON.stringify(parsed)), null);
  });

  it("rejects malformed JSON", () => {
    assert.equal(parseHomeSnapshot("{"), null);
    assert.equal(parseHomeSnapshot(null), null);
  });

  it("keeps an original title on the restored hero and drops a bad one", () => {
    const withOriginal = serializeHomeSnapshot({ ...snapshot, originalTitle: "潮織り" });
    assert.equal(gameFromHomeSnapshot(parseHomeSnapshot(withOriginal)!).originalTitle, "潮織り");
    const bad = JSON.parse(serializeHomeSnapshot(snapshot)) as HomeSnapshot;
    (bad as { originalTitle: unknown }).originalTitle = 12;
    assert.equal(parseHomeSnapshot(JSON.stringify(bad)), null);
  });

  it("keeps the indexed snapshot and otherwise uses the older local copy", () => {
    assert.equal(chooseHomeSnapshot(snapshot, null)?.slug, "quiet-provinces");
    assert.equal(chooseHomeSnapshot(null, snapshot)?.slug, "quiet-provinces");
    assert.equal(chooseHomeSnapshot(null, null), null);
  });
});
