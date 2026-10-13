/**
 * Provider-independent domain types for Inga.
 * Nothing here may depend on a specific third-party game API.
 */

export type PlatformId =
  "pc" | "steam" | "epic" | "playstation" | "xbox" | "switch" | "switch2" | "mobile" | "vr";

export type PlatformFamily = "pc" | "playstation" | "xbox" | "nintendo" | "mobile" | "vr";

export interface Platform {
  id: PlatformId;
  name: string;
  family: PlatformFamily;
  shortLabel: string;
}

/** How precisely a release date is known. Never invent a clock time. */
export type ReleasePrecision = "exact" | "date" | "month" | "quarter" | "year" | "tba";

/** How much we trust the release information. */
export type ReleaseConfidence = "confirmed" | "high" | "expected" | "unconfirmed" | "tba";

export type ReleaseKind = "full" | "early-access" | "dlc" | "expansion" | "demo" | "beta";

export type ReleaseState = "upcoming" | "available" | "delayed";

export interface ReleaseEvent {
  id: string;
  gameId: string;
  /** ISO 8601. For non-exact precision, treat as the start of the window. */
  date: string;
  precision: ReleasePrecision;
  confidence: ReleaseConfidence;
  kind: ReleaseKind;
  state: ReleaseState;
  platforms: PlatformId[];
  /** IANA timezone the exact timestamp is anchored to, when known. */
  timezone?: string;
  region?: string;
  /** Positive number = pushed back by N days. */
  delayDays?: number;
  previousDate?: string;
  note?: string;
  source?: string;
}

export interface Game {
  id: string;
  slug: string;
  title: string;
  /** Original-language title, for the "Game title language" setting. */
  originalTitle?: string;
  developer: string;
  publisher: string;
  summary: string;
  genres: string[];
  coverUrl: string;
  backdropUrl?: string;
  platforms: PlatformId[];
  /** A game has many release events; never a single releaseDate field. */
  releaseEvents: ReleaseEvent[];
  hypeScore?: number;
  criticScore?: number;
  /** Official stills. Absent means the gallery stays empty. */
  screenshots?: Screenshot[];
}

export interface RadarEntry {
  game: Game;
  event: ReleaseEvent;
}

export interface Deal {
  id: string;
  gameId: string;
  store: string;
  priceCurrent: number;
  priceBase: number;
  discountPercent: number;
  currency: string;
  endsAt?: string;
  url?: string;
  /** Denormalized catalogue snapshot from content-feed when present. */
  game?: Game;
}

export interface Giveaway {
  id: string;
  gameId: string;
  store: string;
  endsAt: string;
  worth?: number;
  currency?: string;
}

export interface Article {
  id: string;
  title: string;
  source: string;
  publishedAt: string;
  imageUrl?: string;
  gameId?: string;
  url?: string;
  /** Denormalized catalogue snapshot from content-feed when present. */
  game?: Game;
}

export interface Screenshot {
  id: string;
  url: string;
  alt: string;
}

export interface Video {
  id: string;
  gameId: string;
  title: string;
  kind: "trailer" | "gameplay" | "review";
  thumbnailUrl: string;
  durationSeconds: number;
  /** Playable URL. Absent means the row is not a trailer control. */
  url?: string;
}

export interface RegionLaunch {
  region: string;
  timezoneLabel: string;
  localTime: string;
  isUserRegion?: boolean;
}

export type FreshnessState = "fresh" | "stale" | "refreshing" | "changed";

export interface FreshnessStatus {
  state: FreshnessState;
  minutesAgo: number;
  changeCount?: number;
}
