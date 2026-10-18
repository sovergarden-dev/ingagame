import type { ClassificationStatus, Deal, GameSummary, OfferType } from "../../domain/types.ts";
import { isDealItem } from "./feed.ts";

export interface RawSteamSpecial {
  id: number;
  name: string;
  header_image?: string;
  discount_percent: number;
  original_price: number; // integer minor units (cents)
  final_price: number; // integer minor units (cents)
  currency?: string;
  discount_expiration?: number; // unix timestamp in seconds
  windows_available?: boolean;
  mac_available?: boolean;
  linux_available?: boolean;
}

export interface MappedSteamDeal {
  deal: Deal;
  externalId: string;
  expiresAt: string | null;
  sourceFreshUntil: string;
  offerState: "active" | "expired" | "withdrawn";
  offerType: OfferType;
  claimEndsAt: string | null;
  accessEndsAt: string | null;
  classificationStatus: ClassificationStatus;
}

export function buildSteamDealExternalId(appId: number, market = "us", currency = "USD"): string {
  return `steam:app:${appId}:market:${market.toLowerCase()}:currency:${currency.toUpperCase()}`;
}

/**
 * Maps a Steam special offer to an Inga Deal record with denormalized minimal game summary.
 * Adheres strictly to Notion Sy06 review:
 * - Proper minor units to decimal currency conversion
 * - Non-negative, finite price verification
 * - discount_expiration mapped to ISO endsAt without fabricating dates
 * - Typed projections for database query-time filtering and freshness TTL
 */
export function mapSteamSpecialToDeal(
  special: RawSteamSpecial,
  market = "us",
  now: Date = new Date(),
): MappedSteamDeal | null {
  if (
    !special ||
    typeof special.id !== "number" ||
    special.id <= 0 ||
    !special.name?.trim() ||
    typeof special.original_price !== "number" ||
    typeof special.final_price !== "number" ||
    typeof special.discount_percent !== "number"
  ) {
    return null;
  }

  // Price validation: non-negative, finite, current <= base
  if (
    special.original_price < 0 ||
    special.final_price < 0 ||
    special.final_price > special.original_price ||
    !Number.isFinite(special.original_price) ||
    !Number.isFinite(special.final_price)
  ) {
    return null;
  }

  // Discount percentage sanity check (0..100)
  if (special.discount_percent < 0 || special.discount_percent > 100) {
    return null;
  }

  const currency = (special.currency?.trim() || "USD").toUpperCase();
  const priceCurrent = Number((special.final_price / 100).toFixed(2));
  const priceBase = Number((special.original_price / 100).toFixed(2));

  let endsAt: string | undefined;
  if (typeof special.discount_expiration === "number" && special.discount_expiration > 0) {
    const expDate = new Date(special.discount_expiration * 1000);
    if (!Number.isNaN(expDate.getTime())) {
      endsAt = expDate.toISOString();
    }
  }

  const gameId = `steam-${special.id}`;
  const dealId = `deal-steam-${special.id}`;
  const externalId = buildSteamDealExternalId(special.id, market, currency);
  const coverUrl =
    special.header_image ||
    `https://cdn.akamai.steamstatic.com/steam/apps/${special.id}/header.jpg`;

  const gameSummary: GameSummary = {
    id: gameId,
    title: special.name.trim(),
    coverUrl,
    steamAppId: special.id,
    platformAvailability: {
      windows: special.windows_available ?? null,
      mac: special.mac_available ?? null,
      linux: special.linux_available ?? null,
    },
    source: "steam",
    observedAt: now.toISOString(),
  };

  // Semantic offer classification per Notion Sy06:
  // Do NOT automatically infer free_to_keep from priceCurrent=0 / discountPercent=100.
  // 100% discount with an explicit expiration is a candidate for free_to_keep;
  // without expiration, it could be permanently free or a pricing anomaly -> "unknown" / "unverified".
  let offerType: OfferType = "discount";
  let classificationStatus: ClassificationStatus = "verified";

  if (special.discount_percent === 100 || special.final_price === 0) {
    if (endsAt) {
      offerType = "free_to_keep";
      classificationStatus = "verified";
    } else {
      offerType = "unknown";
      classificationStatus = "unverified";
    }
  }

  const claimEndsAt = endsAt ?? null;
  const accessEndsAt = null;

  const deal: Deal = {
    id: dealId,
    gameId,
    store: "Steam",
    priceCurrent,
    priceBase,
    discountPercent: special.discount_percent,
    currency,
    url: `https://store.steampowered.com/app/${special.id}`,
    gameSummary,
    offerType,
    classificationStatus,
    ...(claimEndsAt ? { claimEndsAt } : {}),
    ...(endsAt ? { endsAt } : {}),
  };

  if (!isDealItem(deal)) {
    return null;
  }

  // Freshness TTL fallback: 24h when endsAt is unknown
  const fallbackTtlMs = 24 * 3600 * 1000;
  const sourceFreshUntil = endsAt ? endsAt : new Date(now.getTime() + fallbackTtlMs).toISOString();

  return {
    deal,
    externalId,
    expiresAt: endsAt ?? null,
    sourceFreshUntil,
    offerState: "active",
    offerType,
    claimEndsAt,
    accessEndsAt,
    classificationStatus,
  };
}
