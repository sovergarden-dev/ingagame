import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  mapSteamAppToRadarEntry,
  parseSteamReleaseDate,
  slugify,
  type RawSteamApp,
} from "./steam-release-mapper.ts";
import { isGameSnapshot, isReleaseEvent } from "./feed.ts";

describe("parseSteamReleaseDate", () => {
  it("parses exact ISO date format", () => {
    const res = parseSteamReleaseDate("2026-11-15");
    assert.ok(res);
    assert.equal(res.date, "2026-11-15T00:00:00.000Z");
    assert.equal(res.precision, "date");
    assert.equal(res.confidence, "confirmed");
  });

  it("parses Day Month Year format (e.g. 24 Oct, 2026)", () => {
    const res = parseSteamReleaseDate("24 Oct, 2026");
    assert.ok(res);
    assert.equal(res.date, "2026-10-24T00:00:00.000Z");
    assert.equal(res.precision, "date");
    assert.equal(res.confidence, "confirmed");
  });

  it("parses Month Day Year format (e.g. October 24, 2026)", () => {
    const res = parseSteamReleaseDate("October 24, 2026");
    assert.ok(res);
    assert.equal(res.date, "2026-10-24T00:00:00.000Z");
    assert.equal(res.precision, "date");
    assert.equal(res.confidence, "confirmed");
  });

  it("parses Month Year format (e.g. October 2026)", () => {
    const res = parseSteamReleaseDate("October 2026");
    assert.ok(res);
    assert.equal(res.date, "2026-10-01T00:00:00.000Z");
    assert.equal(res.precision, "month");
    assert.equal(res.confidence, "high");
  });

  it("parses Quarter Year format (e.g. Q4 2026)", () => {
    const res = parseSteamReleaseDate("Q4 2026");
    assert.ok(res);
    assert.equal(res.date, "2026-10-01T00:00:00.000Z");
    assert.equal(res.precision, "quarter");
    assert.equal(res.confidence, "expected");
  });

  it("parses Year Only format (e.g. 2027)", () => {
    const res = parseSteamReleaseDate("2027");
    assert.ok(res);
    assert.equal(res.date, "2027-01-01T00:00:00.000Z");
    assert.equal(res.precision, "year");
    assert.equal(res.confidence, "expected");
  });

  it("returns null for Coming Soon / TBA without announced window (no fake timestamps per Notion Sy06)", () => {
    assert.equal(parseSteamReleaseDate("Coming Soon"), null);
    assert.equal(parseSteamReleaseDate("TBA"), null);
    assert.equal(parseSteamReleaseDate("To be announced"), null);
  });

  it("returns null for empty, undefined, or unparseable gibberish", () => {
    assert.equal(parseSteamReleaseDate(undefined), null);
    assert.equal(parseSteamReleaseDate(""), null);
    assert.equal(parseSteamReleaseDate("   "), null);
    assert.equal(parseSteamReleaseDate("someday in the future maybe"), null);
  });
});

describe("slugify", () => {
  it("converts strings to safe lowercase URL slugs", () => {
    assert.equal(slugify("Clair Obscur: Expedition 33"), "clair-obscur-expedition-33");
    assert.equal(slugify("Hades II (Early Access!)"), "hades-ii-early-access");
    assert.equal(slugify("   Spaces & Symbols --- "), "spaces-symbols");
    assert.equal(slugify(""), "game");
  });
});

describe("mapSteamAppToRadarEntry", () => {
  const validApp: RawSteamApp = {
    id: 1145350,
    name: "Hades II",
    header_image: "https://cdn.akamai.steamstatic.com/steam/apps/1145350/header.jpg",
    developer: "Supergiant Games",
    publisher: "Supergiant Games",
    short_description:
      "Battle beyond the Underworld using dark sorcery to take on the Titan of Time.",
    genres: ["Action", "Roguelike"],
    release_date: {
      coming_soon: true,
      date: "2026-11-20",
    },
  };

  it("maps valid Steam app to RadarEntry satisfying all schema validators", () => {
    const entry = mapSteamAppToRadarEntry(validApp);
    assert.ok(entry);
    assert.equal(entry.game.id, "steam-1145350");
    assert.equal(entry.game.steamAppId, 1145350);
    assert.equal(entry.game.title, "Hades II");
    assert.equal(entry.game.slug, "hades-ii-1145350");
    assert.equal(entry.event.id, "rel-steam-1145350");
    assert.equal(entry.event.gameId, "steam-1145350");
    assert.equal(entry.event.date, "2026-11-20T00:00:00.000Z");
    assert.equal(entry.event.precision, "date");

    // Strictly verify against the feed schema validator
    assert.ok(isGameSnapshot(entry.game), "game snapshot must pass isGameSnapshot");
    assert.ok(isReleaseEvent(entry.event), "event must pass isReleaseEvent");
  });

  it("maps Quarter-based date release correctly", () => {
    const quarterApp: RawSteamApp = {
      ...validApp,
      id: 2868840,
      name: "Slay the Spire 2",
      release_date: "Q1 2027",
    };
    const entry = mapSteamAppToRadarEntry(quarterApp);
    assert.ok(entry);
    assert.equal(entry.event.precision, "quarter");
    assert.equal(entry.event.date, "2027-01-01T00:00:00.000Z");
    assert.ok(isGameSnapshot(entry.game));
    assert.ok(isReleaseEvent(entry.event));
  });

  it("rejects apps with invalid ID or missing titles", () => {
    assert.equal(mapSteamAppToRadarEntry({ ...validApp, id: -1 }), null);
    assert.equal(mapSteamAppToRadarEntry({ ...validApp, id: 0 }), null);
    assert.equal(mapSteamAppToRadarEntry({ ...validApp, name: "" }), null);
    assert.equal(mapSteamAppToRadarEntry({ ...validApp, name: "   " }), null);
  });

  it("rejects apps with unparseable release date", () => {
    assert.equal(mapSteamAppToRadarEntry({ ...validApp, release_date: "invalid-date" }), null);
  });
});
