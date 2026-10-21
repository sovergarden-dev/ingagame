import type { ClassificationStatus, Deal, GameSummary, OfferType } from "../../domain/types.ts";
import { isDealItem } from "./feed.ts";

export interface RawEpicKeyImage {
  type?: string;
  url?: string;
}

export interface RawEpicPromotionalOfferItem {
  startDate?: string;
  endDate?: string;
  discountSetting?: {
    discountType?: string;
    discountPercentage?: number;
  };
}

export interface RawEpicPromotionalOfferGroup {
  promotionalOffers?: RawEpicPromotionalOfferItem[];
}

export interface RawEpicFreeGameElement {
  id: string;
  namespace: string;
  title: string;
  description?: string;
  offerType?: string;
  productSlug?: string | null;
  urlSlug?: string | null;
  catalogNs?: {
    mappings?: {
      pageSlug?: string;
      pageType?: string;
    }[];
  };
  keyImages?: RawEpicKeyImage[];
  price?: {
    totalPrice?: {
      discountPrice?: number;
      originalPrice?: number;
      currencyCode?: string;
    };
  };
  promotions?: {
    promotionalOffers?: RawEpicPromotionalOfferGroup[];
    upcomingPromotionalOffers?: RawEpicPromotionalOfferGroup[];
  } | null;
}

export interface MappedEpicOffer {
  deal: Deal;
  externalId: string;
  expiresAt: string;
  sourceFreshUntil: string;
  offerState: "active" | "expired" | "withdrawn";
  offerType: OfferType;
  claimEndsAt: string;
  accessEndsAt: null;
  classificationStatus: ClassificationStatus;
}

export function buildEpicPromotionExternalId(
  namespace: string,
  offerId: string,
  endDateIso: string,
  market = "us",
): string {
  return `epic:namespace:${namespace.trim()}:offer:${offerId.trim()}:market:${market.toLowerCase()}:end:${endDateIso}`;
}

function resolveEpicCoverUrl(images?: RawEpicKeyImage[]): string | undefined {
  if (!Array.isArray(images) || images.length === 0) return undefined;
  const preferredTypes = ["OfferImageWide", "DieselStoreFrontWide", "Thumbnail", "OfferImageTall"];
  for (const t of preferredTypes) {
    const match = images.find((img) => img.type === t && img.url?.trim());
    if (match?.url) return match.url.trim();
  }
  const firstValid = images.find((img) => img.url?.trim());
  return firstValid?.url?.trim();
}

function resolveEpicStoreSlug(el: RawEpicFreeGameElement): string | undefined {
  const mappedSlug = el.catalogNs?.mappings?.find((m) => m.pageSlug?.trim())?.pageSlug?.trim();
  if (mappedSlug) return mappedSlug;
  if (el.productSlug?.trim()) {
    return el.productSlug.trim().replace(/\/home$/, "");
  }
  if (el.urlSlug?.trim() && !/^[0-9a-f]{32}$/i.test(el.urlSlug.trim())) {
    return el.urlSlug.trim();
  }
  return undefined;
}

/**
 * Maps a raw Epic Games Store freeGamesPromotions element to a verified Inga Deal record.
 * Adheres strictly to Notion Sy06 multi-provider contract:
 * - Only accepts active promotional offers where discountPercentage === 0 (Epic's convention for 0% of original price = Free)
 *   OR totalPrice.discountPrice === 0 with an active promotional window.
 * - Requires explicit startDate <= now < endDate.
 * - Excludes DLC/Add-ons unless base game or unspecified standard game offer.
 * - Populates storeRefs with `{ store: "epic", namespace, offerId }` and leaves steamAppId undefined.
 */
export function mapEpicFreeGameToDeal(
  element: RawEpicFreeGameElement,
  market = "us",
  now: Date = new Date(),
): MappedEpicOffer | null {
  if (
    !element ||
    typeof element.id !== "string" ||
    !element.id.trim() ||
    typeof element.namespace !== "string" ||
    !element.namespace.trim() ||
    typeof element.title !== "string" ||
    !element.title.trim()
  ) {
    return null;
  }

  // Filter out pure add-ons or non-game items if explicitly marked as ADD_ON
  if (element.offerType === "ADD_ON" || element.offerType === "IN_GAME_PURCHASE") {
    return null;
  }

  const promoGroups = element.promotions?.promotionalOffers;
  if (!Array.isArray(promoGroups) || promoGroups.length === 0) {
    return null;
  }

  const nowMs = now.getTime();
  let activeWindow: { startIso: string; endIso: string } | null = null;

  for (const group of promoGroups) {
    const offers = group.promotionalOffers;
    if (!Array.isArray(offers)) continue;
    for (const offer of offers) {
      if (!offer.startDate || !offer.endDate) continue;
      const startMs = Date.parse(offer.startDate);
      const endMs = Date.parse(offer.endDate);
      if (Number.isNaN(startMs) || Number.isNaN(endMs)) continue;
      if (startMs <= nowMs && nowMs < endMs) {
        // In Epic's API, discountPercentage: 0 inside promotionalOffers means customer pays 0% of original price (100% off)
        const discountPct = offer.discountSetting?.discountPercentage;
        const isFreePromo = discountPct === 0 || element.price?.totalPrice?.discountPrice === 0;
        if (isFreePromo) {
          activeWindow = {
            startIso: new Date(startMs).toISOString(),
            endIso: new Date(endMs).toISOString(),
          };
          break;
        }
      }
    }
    if (activeWindow) break;
  }

  if (!activeWindow) {
    return null;
  }

  const totalPrice = element.price?.totalPrice;
  const origCents =
    typeof totalPrice?.originalPrice === "number" && totalPrice.originalPrice >= 0
      ? totalPrice.originalPrice
      : 0;
  const currency = (totalPrice?.currencyCode?.trim() || "USD").toUpperCase();
  const priceBase = Number((origCents / 100).toFixed(2));
  const priceCurrent = 0;

  const slug = resolveEpicStoreSlug(element);
  const storeUrl = slug
    ? `https://store.epicgames.com/en-US/p/${slug}`
    : "https://store.epicgames.com/en-US/free-games";

  const coverUrl = resolveEpicCoverUrl(element.keyImages);
  const gameId = `epic-${element.namespace.trim()}-${element.id.trim()}`;
  const dealId = `deal-epic-${element.id.trim()}`;
  const externalId = buildEpicPromotionExternalId(
    element.namespace,
    element.id,
    activeWindow.endIso,
    market,
  );

  const gameSummary: GameSummary = {
    id: gameId,
    title: element.title.trim(),
    ...(coverUrl ? { coverUrl } : {}),
    storeRefs: [
      {
        store: "epic",
        namespace: element.namespace.trim(),
        offerId: element.id.trim(),
        ...(slug ? { slug } : {}),
      },
    ],
    platformAvailability: {
      windows: true,
      mac: null,
      linux: null,
    },
    source: "epic",
    observedAt: now.toISOString(),
  };

  const offerType: OfferType = "free_to_keep";
  const classificationStatus: ClassificationStatus = "verified";

  const deal: Deal = {
    id: dealId,
    gameId,
    store: "Epic Games Store",
    priceCurrent,
    priceBase,
    discountPercent: 100,
    currency,
    endsAt: activeWindow.endIso,
    claimEndsAt: activeWindow.endIso,
    url: storeUrl,
    gameSummary,
    offerType,
    classificationStatus,
  };

  if (!isDealItem(deal)) {
    return null;
  }

  return {
    deal,
    externalId,
    expiresAt: activeWindow.endIso,
    sourceFreshUntil: activeWindow.endIso,
    offerState: "active",
    offerType,
    claimEndsAt: activeWindow.endIso,
    accessEndsAt: null,
    classificationStatus,
  };
}
