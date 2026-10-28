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

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function text(value: unknown, limit = 256): string | null {
  return typeof value === "string" && value.trim().length > 0 && value.length <= limit
    ? value.trim()
    : null;
}

function instant(value: unknown): number | null {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
  )
    return null;
  const result = Date.parse(value);
  return Number.isFinite(result) ? result : null;
}

export function buildEpicPromotionExternalId(
  namespace: string,
  offerId: string,
  startDateIso: string,
  market = "us",
): string {
  return `epic:v2:namespace:${encodeURIComponent(namespace.trim())}:offer:${encodeURIComponent(offerId.trim())}:market:${market.toLowerCase()}:start:${new Date(startDateIso).toISOString()}`;
}

function resolveSlug(element: Record<string, unknown>): string | null {
  const catalog = record(element["catalogNs"]);
  const mappings = catalog?.["mappings"];
  const candidates: unknown[] = [];
  if (Array.isArray(mappings)) {
    for (const value of mappings.slice(0, 20)) {
      const mapping = record(value);
      if (mapping?.["pageType"] === "productHome") candidates.push(mapping["pageSlug"]);
    }
  }
  candidates.push(element["productSlug"]);
  for (const candidate of candidates) {
    const slug = text(candidate)?.replace(/\/home$/, "");
    if (slug && /^[a-zA-Z0-9]+(?:-[a-zA-Z0-9]+)*$/.test(slug)) return slug;
  }
  return null;
}

function resolveCover(images: unknown): string | null {
  if (!Array.isArray(images)) return null;
  for (const type of ["OfferImageWide", "DieselStoreFrontWide", "Thumbnail", "OfferImageTall"]) {
    for (const value of images.slice(0, 30)) {
      const image = record(value);
      if (image?.["type"] !== type || typeof image["url"] !== "string") continue;
      try {
        const url = new URL(image["url"]);
        if (
          url.protocol === "https:" &&
          !url.username &&
          !url.password &&
          ["cdn1.epicgames.com", "cdn2.unrealengine.com"].includes(url.hostname)
        )
          return url.href;
      } catch {
        continue;
      }
    }
  }
  return null;
}

/** Conservative US/USD paid-to-free base-game promotions only. No inferred OS or cross-store identity. */
export function mapEpicFreeGameToDeal(
  input: unknown,
  market = "us",
  now: Date = new Date(),
): MappedEpicOffer | null {
  const element = record(input);
  if (!element || market.toLowerCase() !== "us" || !Number.isFinite(now.getTime())) return null;
  const id = text(element["id"]);
  const namespace = text(element["namespace"]);
  const title = text(element["title"], 512);
  if (!id || !namespace || !title || element["offerType"] !== "BASE_GAME") return null;
  const price = record(record(element["price"])?.["totalPrice"]);
  const original = price?.["originalPrice"];
  if (
    typeof original !== "number" ||
    !Number.isSafeInteger(original) ||
    original <= 0 ||
    price?.["discountPrice"] !== 0 ||
    price["currencyCode"] !== "USD"
  )
    return null;
  const groups = record(element["promotions"])?.["promotionalOffers"];
  if (!Array.isArray(groups) || groups.length > 20) return null;
  const windows = new Map<string, { start: number; end: number }>();
  for (const value of groups) {
    const offers = record(value)?.["promotionalOffers"];
    if (!Array.isArray(offers) || offers.length > 20) return null;
    for (const raw of offers) {
      const offer = record(raw);
      if (!offer) return null;
      const start = instant(offer["startDate"]);
      const end = instant(offer["endDate"]);
      const discount = record(offer["discountSetting"]);
      if (start === null || end === null || start >= end) return null;
      if (
        start <= now.getTime() &&
        now.getTime() < end &&
        discount?.["discountType"] === "PERCENTAGE" &&
        discount["discountPercentage"] === 0
      ) {
        windows.set(`${start}:${end}`, { start, end });
      }
    }
  }
  if (windows.size !== 1) return null;
  const window = [...windows.values()][0];
  if (!window) return null;
  const end = new Date(window.end).toISOString();
  const externalId = buildEpicPromotionExternalId(
    namespace,
    id,
    new Date(window.start).toISOString(),
    market,
  );
  const gameId = `epic:${encodeURIComponent(namespace)}:${encodeURIComponent(id)}`;
  const slug = resolveSlug(element);
  const coverUrl = resolveCover(element["keyImages"]);
  const gameSummary: GameSummary = {
    id: gameId,
    title,
    ...(coverUrl ? { coverUrl } : {}),
    storeRefs: [{ store: "epic", namespace, offerId: id, ...(slug ? { slug } : {}) }],
    platformAvailability: { windows: null, mac: null, linux: null },
    source: "epic",
    observedAt: now.toISOString(),
  };
  const deal: Deal = {
    id: externalId,
    gameId,
    store: "Epic Games Store",
    priceCurrent: 0,
    priceBase: original / 100,
    discountPercent: 100,
    currency: "USD",
    endsAt: end,
    claimEndsAt: end,
    gameSummary,
    url: slug
      ? `https://store.epicgames.com/en-US/p/${slug}`
      : "https://store.epicgames.com/en-US/free-games",
    offerType: "free_to_keep",
    classificationStatus: "verified",
  };
  if (!isDealItem(deal)) return null;
  return {
    deal,
    externalId,
    expiresAt: end,
    sourceFreshUntil: new Date(
      Math.min(window.end, now.getTime() + 2 * 60 * 60 * 1000),
    ).toISOString(),
    offerState: "active",
    offerType: "free_to_keep",
    claimEndsAt: end,
    accessEndsAt: null,
    classificationStatus: "verified",
  };
}
