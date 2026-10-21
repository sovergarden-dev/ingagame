import type { Game, GameSummary, PlatformAvailability, PlatformId } from "./types.ts";
import { shouldHideOwnedGame, type OwnershipStatus } from "./ownership.ts";

/** Milliseconds of `endsAt`, or null when the deal has no usable expiry. */
export function parseDealEndMs(endsAt: string | undefined): number | null {
  if (!endsAt) return null;
  const ms = Date.parse(endsAt);
  return Number.isNaN(ms) ? null : ms;
}

/**
 * Shared expiry clock for toasts, deal cards, and free-game lists.
 * Unknown clock (`now === null`) and missing/invalid `endsAt` are not expired.
 */
export function hasEnded(endsAt: string | undefined, now: number | null): boolean {
  if (now === null) return false;
  const ms = parseDealEndMs(endsAt);
  if (ms === null) return false;
  return ms <= now;
}

export const isDealExpired = hasEnded;

/** Deals still on sale. A missing clock keeps the list unchanged so SSR matches. */
export function liveDeals<T extends { endsAt?: string }>(deals: T[], now: number | null): T[] {
  if (now === null) return deals;
  return deals.filter((deal) => !isDealExpired(deal.endsAt, now));
}

/** Keeps a deal when its game is on one of the selected platforms. A deal with no game or summary is left out. */
export function dealsForPlatforms<
  T extends {
    game?: { platforms: PlatformId[] };
    gameSummary?: { platformAvailability?: PlatformAvailability };
  },
>(deals: T[], platformIds: PlatformId[]): T[] {
  const selected = new Set(platformIds);
  return deals.filter((deal) => {
    if (deal.game?.platforms) {
      return deal.game.platforms.some((platform) => selected.has(platform));
    }
    const avail = deal.gameSummary?.platformAvailability;
    if (avail) {
      if (
        (selected.has("pc") || selected.has("steam")) &&
        (avail.windows === true || avail.linux === true || avail.mac === true)
      ) {
        return true;
      }
    }
    return false;
  });
}

export const ENDING_SOON_MS = 72 * 3_600_000;

/** Still active and within the ending-soon window. Expired items never qualify. */
export function isEndingSoon(
  endsAt: string | undefined,
  now: number | null,
  windowMs = ENDING_SOON_MS,
): boolean {
  if (now === null || hasEnded(endsAt, now)) return false;
  const ms = parseDealEndMs(endsAt);
  if (ms === null) return false;
  return ms - now < windowMs;
}

function nonBlank(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}

/**
 * Matches canonical IDs first. Slug is only a fallback when the record carries no ID,
 * so a stale or conflicting ID cannot leak an item into another game's detail page.
 */
export function dealsForGame<T extends { gameId: string; game?: { id?: string; slug?: string } }>(
  deals: T[],
  game: { id?: string; slug?: string },
): T[] {
  const targetId = nonBlank(game.id);
  const targetSlug = nonBlank(game.slug);
  if (!targetId && !targetSlug) return [];
  return deals.filter((deal) => {
    const recordId = nonBlank(deal.gameId) ?? nonBlank(deal.game?.id);
    if (recordId) return targetId === recordId;
    return targetSlug !== undefined && nonBlank(deal.game?.slug) === targetSlug;
  });
}

/**
 * Filters out deals whose associated game is owned on Steam.
 * Fail-open contract: if deal.game and deal.gameSummary are missing or ownership cannot be determined,
 * the deal is preserved.
 */
export function filterOwnedDeals<T extends { game?: Game; gameSummary?: GameSummary }>(
  deals: T[],
  owns: (game: Game | GameSummary) => OwnershipStatus,
): T[] {
  return deals.filter((deal) => {
    const target = deal.game ?? deal.gameSummary;
    return target ? !shouldHideOwnedGame(target, true, owns) : true;
  });
}

/**
 * Filters out giveaways whose associated game is owned on Steam.
 * Fail-open contract: if game cannot be found or ownership is unknown,
 * the giveaway is preserved.
 */
export function filterOwnedGiveaways<
  T extends { gameId: string; game?: Game; gameSummary?: GameSummary },
>(
  giveaways: T[],
  getGameFn: (id: string) => Game | undefined,
  owns: (game: Game | GameSummary) => OwnershipStatus,
): T[] {
  return giveaways.filter((g) => {
    const target = g.game ?? g.gameSummary ?? getGameFn(g.gameId);
    return target ? !shouldHideOwnedGame(target, true, owns) : true;
  });
}

/**
 * Filters deals or giveaways by minimum discount percentage and case-insensitive title search query.
 */
export function filterOffersByQueryAndDiscount<
  T extends {
    discountPercent?: number;
    game?: { title?: string; originalTitle?: string };
    gameSummary?: { title?: string };
    store?: string;
  },
>(items: T[], query = "", minDiscount = 0): T[] {
  const normalizedQuery = query.trim().toLowerCase();
  return items.filter((item) => {
    if (minDiscount > 0 && (item.discountPercent ?? 100) < minDiscount) {
      return false;
    }
    if (!normalizedQuery) return true;
    const title = (item.game?.title ?? item.gameSummary?.title ?? "").toLowerCase();
    const orig = (item.game?.originalTitle ?? "").toLowerCase();
    const store = (item.store ?? "").toLowerCase();
    return (
      title.includes(normalizedQuery) ||
      orig.includes(normalizedQuery) ||
      store.includes(normalizedQuery)
    );
  });
}
