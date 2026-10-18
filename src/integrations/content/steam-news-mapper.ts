import type { Article } from "../../domain/types.ts";
import { isArticleItem } from "./feed.ts";

export interface RawSteamNewsItem {
  gid: string;
  title: string;
  url: string;
  author?: string;
  contents: string;
  feedlabel?: string;
  date: number; // unix timestamp in seconds
  feedname?: string;
  appid: number;
}

export type NewsCategory =
  "announcement" | "major_update" | "patch_notes" | "minor_patch" | "community";

/**
 * Sanitizes Steam news content (strips BBCode and HTML tags) into plain text excerpt.
 */
export function sanitizeNewsExcerpt(rawText: string, maxLength = 240): string {
  if (!rawText) return "";
  const cleaned = rawText
    // Remove BBCode tags e.g. [b], [/b], [url=...], [img]
    .replace(/\[\/?(?:b|i|u|h[1-3]|url|img|list|olist|\*|quote|code|table|tr|th|td)[^\]]*\]/gi, " ")
    // Remove HTML tags
    .replace(/<[^>]+>/g, " ")
    // Normalize whitespace
    .replace(/\s+/g, " ")
    .trim();

  if (cleaned.length <= maxLength) return cleaned;
  return `${cleaned.slice(0, maxLength).trim()}…`;
}

/**
 * Categorizes Steam news content per Notion Sy06 hygiene rules.
 * Distinguishes major content drops/announcements from minor localization/typo hotfixes.
 */
export function classifySteamNews(title: string, contents: string): NewsCategory {
  const combined = `${title} ${contents.slice(0, 500)}`.toLowerCase();

  // Minor hotfix / localization / typo fixes
  if (
    /\b(hotfix|minor fix|localization update|translation fix|typo|crash fix on launch)\b/i.test(
      title,
    )
  ) {
    return "minor_patch";
  }

  // Major updates & expansions
  if (
    /\b(major update|expansion|season|dlc|launch wave|roadmap|dev diary|announcement)\b/i.test(
      combined,
    )
  ) {
    return "major_update";
  }

  if (/\b(patch notes|update|changelog|v\d+\.\d+)\b/i.test(title)) {
    return "patch_notes";
  }

  return "announcement";
}

export function buildSteamNewsExternalId(appId: number, gid: string): string {
  return `news:steam:app:${appId}:${gid}`;
}

/**
 * Maps a Steam news item to an Inga Article.
 * Rejects minor patches (to keep main feed high-signal) and validates against isArticleItem.
 */
export function mapSteamNewsToArticle(
  item: RawSteamNewsItem,
  options: { allowMinorPatches?: boolean } = {},
): { article: Article; externalId: string } | null {
  if (
    !item ||
    !item.gid?.trim() ||
    !item.title?.trim() ||
    !item.url?.trim() ||
    typeof item.date !== "number" ||
    item.date <= 0 ||
    typeof item.appid !== "number" ||
    item.appid <= 0
  ) {
    return null;
  }

  const category = classifySteamNews(item.title, item.contents || "");
  if (category === "minor_patch" && !options.allowMinorPatches) {
    // Drop minor localization and typo fixes from the main feed per Notion Sy06 hygiene rule
    return null;
  }

  const publishedDate = new Date(item.date * 1000);
  if (Number.isNaN(publishedDate.getTime())) {
    return null;
  }

  const externalId = buildSteamNewsExternalId(item.appid, item.gid);
  const articleId = `news-steam-${item.appid}-${item.gid}`;
  const source = item.feedlabel?.trim() || "Steam Community";

  const article: Article = {
    id: articleId,
    title: item.title.trim(),
    source,
    publishedAt: publishedDate.toISOString(),
    url: item.url.trim(),
    gameId: `steam-${item.appid}`,
  };

  if (!isArticleItem(article)) {
    return null;
  }

  return { article, externalId };
}
