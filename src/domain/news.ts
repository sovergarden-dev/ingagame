/** News tied to a followed game. An article with no game is left out. */
export function articlesForFollowed<T extends { gameId?: string }>(
  articles: T[],
  following: string[],
): T[] {
  const ids = new Set(following);
  return articles.filter((article) => article.gameId !== undefined && ids.has(article.gameId));
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
  T extends { gameId?: string; game?: { id?: string; slug?: string } },
>(articles: T[], game: { id?: string; slug?: string }): T[] {
  const targetId = nonBlank(game.id);
  const targetSlug = nonBlank(game.slug);
  if (!targetId && !targetSlug) return [];
  return articles.filter((article) => {
    const recordId = nonBlank(article.gameId) ?? nonBlank(article.game?.id);
    if (recordId) return targetId === recordId;
    return targetSlug !== undefined && nonBlank(article.game?.slug) === targetSlug;
  });
}
