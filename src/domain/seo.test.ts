import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PUBLIC_PATHS,
  canonicalUrl,
  gameCanonicalPath,
  sitemapXml,
  videoGameJsonLd,
} from "./seo.ts";

describe("public SEO urls", () => {
  it("builds a canonical url without a query string", () => {
    assert.equal(canonicalUrl("/releases"), "https://ingagame.lovable.app/releases");
    assert.equal(canonicalUrl("/releases/"), "https://ingagame.lovable.app/releases");
    assert.equal(canonicalUrl("/releases?sort=hype"), null);
  });

  it("lists stable routes and leaves game pages out of the sitemap", () => {
    const xml = sitemapXml();
    assert.match(xml, /https:\/\/ingagame\.lovable\.app\/releases/);
    assert.equal(xml.includes("/game/"), false);
    assert.equal(PUBLIC_PATHS.includes("/"), true);
  });

  it("accepts a plain game slug and rejects a query-like slug", () => {
    assert.equal(gameCanonicalPath("iron-vigil"), "/game/iron-vigil");
    assert.equal(gameCanonicalPath("iron vigil"), null);
    assert.equal(gameCanonicalPath("../secret"), null);
  });

  it("omits a release date unless the precision is exact or a calendar date", () => {
    const dated = videoGameJsonLd({
      name: "Iron Vigil",
      url: "https://ingagame.lovable.app/game/iron-vigil",
      date: "2026-09-12T00:00:00Z",
      precision: "date",
    });
    assert.equal(dated?.datePublished, "2026-09-12");
    const coarse = videoGameJsonLd({
      name: "Quiet Provinces",
      url: "https://ingagame.lovable.app/game/quiet-provinces",
      date: "2026-10-01T00:00:00Z",
      precision: "quarter",
    });
    assert.equal(coarse?.datePublished, undefined);
    assert.equal(videoGameJsonLd({ name: " ", url: "https://ingagame.lovable.app/game/x" }), null);
  });
});
