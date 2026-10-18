import type { Game, GameSummary } from "./types.ts";

export function toGameSummary(game: Game | undefined): GameSummary | undefined {
  if (!game) return undefined;
  return {
    id: game.id,
    title: game.title,
    coverUrl: game.coverUrl,
    source: "catalogue",
    observedAt: new Date().toISOString(),
    ...(game.steamAppId !== undefined ? { steamAppId: game.steamAppId } : {}),
  };
}

/** News tied to a followed game. An article with no game is left out. */
export function articlesForFollowed<
  T extends {
    gameId?: string;
    game?: { id?: string };
    gameSummary?: { id?: string };
  },
>(articles: T[], following: string[]): T[] {
  const ids = new Set(following);
  return articles.filter((article) => {
    const id = article.gameId ?? article.game?.id ?? article.gameSummary?.id;
    return id !== undefined && ids.has(id);
  });
}

function nonBlank(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}

/**
 * Matches canonical IDs first. Slug is only a fallback when the record carries no ID,
 * so a stale or conflicting ID cannot leak an article into another game's detail page.
 */
export function articlesForGame<
  T extends {
    gameId?: string;
    game?: { id?: string; slug?: string };
    gameSummary?: { id?: string };
  },
>(articles: T[], game: { id?: string; slug?: string }): T[] {
  const targetId = nonBlank(game.id);
  const targetSlug = nonBlank(game.slug);
  if (!targetId && !targetSlug) return [];
  return articles.filter((article) => {
    const recordId =
      nonBlank(article.gameId) ?? nonBlank(article.game?.id) ?? nonBlank(article.gameSummary?.id);
    if (recordId) return targetId === recordId;
    return targetSlug !== undefined && nonBlank(article.game?.slug) === targetSlug;
  });
}
