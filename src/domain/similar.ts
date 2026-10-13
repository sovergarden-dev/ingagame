import type { Game } from "./types";

export function sharedGenres(game: Pick<Game, "genres">, other: Pick<Game, "genres">): string[] {
  const theirs = new Set(other.genres.map((genre) => genre.toLowerCase()));
  return game.genres.filter((genre) => theirs.has(genre.toLowerCase()));
}

/** Games that share at least one genre. No overlap means no similar row. */
export function similarGames(
  game: Pick<Game, "id" | "genres">,
  others: Game[],
  limit = 6,
  hiddenIds: string[] = [],
): Game[] {
  const genres = new Set(game.genres.map((genre) => genre.toLowerCase()));
  const hidden = new Set(hiddenIds);
  return others
    .filter((other) => other.id !== game.id && !hidden.has(other.id))
    .map((other) => ({
      other,
      score: other.genres.filter((genre) => genres.has(genre.toLowerCase())).length,
    }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || a.other.title.localeCompare(b.other.title))
    .slice(0, limit)
    .map((row) => row.other);
}
