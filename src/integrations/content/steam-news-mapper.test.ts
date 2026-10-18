import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildSteamNewsExternalId,
  classifySteamNews,
  mapSteamNewsToArticle,
  sanitizeNewsExcerpt,
  type RawSteamNewsItem,
} from "./steam-news-mapper.ts";
import { isArticleItem } from "./feed.ts";

describe("sanitizeNewsExcerpt", () => {
  it("strips BBCode and HTML into clean text excerpt", () => {
    const raw =
      "[b]Major Update v1.2 is here![/b]<br>Check out our [url=https://example.com]roadmap[/url] for upcoming DLC!";
    const res = sanitizeNewsExcerpt(raw);
    assert.equal(res, "Major Update v1.2 is here! Check out our roadmap for upcoming DLC!");
  });

  it("truncates long descriptions with ellipsis", () => {
    const long = "A".repeat(300);
    const res = sanitizeNewsExcerpt(long, 50);
    assert.equal(res.length, 51); // 50 chars + ellipsis
    assert.ok(res.endsWith("…"));
  });
});

describe("classifySteamNews", () => {
  it("identifies minor patch notes and localization fixes", () => {
    assert.equal(
      classifySteamNews("Hotfix 1.0.3 - Japanese localization fix", "Fixed minor typos."),
      "minor_patch",
    );
    assert.equal(
      classifySteamNews("Crash fix on launch", "Resolved an issue on Windows 11."),
      "minor_patch",
    );
  });

  it("identifies major updates and expansions", () => {
    assert.equal(
      classifySteamNews("Major Update: The Olympic Expansion", "New gods and areas to explore."),
      "major_update",
    );
  });
});

describe("mapSteamNewsToArticle", () => {
  const validNews: RawSteamNewsItem = {
    gid: "456789012345",
    title: "Hades II - Olympic Update Launch Wave",
    url: "https://store.steampowered.com/news/app/1145350/view/456789012345",
    author: "Supergiant Games",
    contents: "We are thrilled to unveil our first major update including new weapons.",
    feedlabel: "Steam Community Announcements",
    date: 1792128000,
    feedname: "steam_community_announcements",
    appid: 1145350,
  };

  it("maps valid major update to Article satisfying schema validators", () => {
    const res = mapSteamNewsToArticle(validNews);
    assert.ok(res);
    assert.equal(res.externalId, "news:steam:app:1145350:456789012345");
    assert.equal(res.article.id, "news-steam-1145350-456789012345");
    assert.equal(res.article.title, "Hades II - Olympic Update Launch Wave");
    assert.equal(res.article.gameId, "steam-1145350");
    assert.ok(isArticleItem(res.article));
  });

  it("drops minor patch notes from main feed per Notion Sy06 hygiene rule", () => {
    const minorNews: RawSteamNewsItem = {
      ...validNews,
      title: "Hotfix 1.0.4 - Spanish typo fix",
      contents: "Fixed two typos in dialog lines.",
    };
    const res = mapSteamNewsToArticle(minorNews);
    assert.equal(res, null);
  });

  it("allows minor patch notes when explicitly requested", () => {
    const minorNews: RawSteamNewsItem = {
      ...validNews,
      title: "Hotfix 1.0.4 - Spanish typo fix",
      contents: "Fixed two typos in dialog lines.",
    };
    const res = mapSteamNewsToArticle(minorNews, { allowMinorPatches: true });
    assert.ok(res);
    assert.ok(isArticleItem(res.article));
  });

  it("rejects invalid items with missing fields or negative appid", () => {
    assert.equal(mapSteamNewsToArticle({ ...validNews, appid: -1 }), null);
    assert.equal(mapSteamNewsToArticle({ ...validNews, title: "" }), null);
    assert.equal(mapSteamNewsToArticle({ ...validNews, gid: "" }), null);
  });
});
