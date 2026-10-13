import { PLATFORMS } from "./platforms.ts";
import { searchHaystack } from "./title.ts";
import type { Game, PlatformFamily, PlatformId } from "./types";

export type DiscoverSort = "hype" | "critic" | "title" | "soonest";

export function sharesHiddenGenre(genres: string[], hiddenGenres: string[]) {
  const hidden = new Set(hiddenGenres.map((genre) => genre.toLowerCase()));
  return genres.some((genre) => hidden.has(genre.toLowerCase()));
}

function earliestRelease(game: Game) {
  const times = game.releaseEvents
    .map((event) => Date.parse(event.date))
    .filter((time) => !Number.isNaN(time));
  return times.length ? Math.min(...times) : Number.MAX_SAFE_INTEGER;
}

export function discoverGames(
  games: Game[],
  options: {
    query?: string;
    genres?: string[];
    families?: PlatformFamily[];
    sort?: DiscoverSort;
    hiddenIds?: string[];
    hiddenGenres?: string[];
    myPlatformIds?: PlatformId[];
  } = {},
): Game[] {
  const query = options.query?.trim().toLowerCase() ?? "";
  const genres = options.genres ?? [];
  const families = options.families ?? [];
  const hidden = new Set(options.hiddenIds ?? []);
  const hiddenGenres = options.hiddenGenres ?? [];
  const filtered = games.filter((game) => {
    if (hidden.has(game.id)) return false;
    if (sharesHiddenGenre(game.genres, hiddenGenres)) return false;
    if (query && !searchHaystack(game).includes(query)) return false;
    if (genres.length && !game.genres.some((genre) => genres.includes(genre))) return false;
    if (
      families.length &&
      !game.platforms.some((platform) => families.includes(PLATFORMS[platform].family))
    ) {
      return false;
    }
    if (
      options.myPlatformIds &&
      !game.platforms.some((platform) => options.myPlatformIds?.includes(platform))
    ) {
      return false;
    }
    return true;
  });
  const sort = options.sort ?? "hype";
  return [...filtered].sort((a, b) => {
    if (sort === "hype") return (b.hypeScore ?? 0) - (a.hypeScore ?? 0);
    if (sort === "critic") return (b.criticScore ?? 0) - (a.criticScore ?? 0);
    if (sort === "title") return a.title.localeCompare(b.title);
    return earliestRelease(a) - earliestRelease(b);
  });
}
