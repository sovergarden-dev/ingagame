import { PLATFORMS } from "../../domain/platforms.ts";
import { isReleaseStillAhead } from "../../domain/release.ts";
import type {
  Article,
  Deal,
  FreshnessStatus,
  Game,
  PlatformId,
  RadarEntry,
  ReleaseEvent,
} from "../../domain/types.ts";

export type ContentKind = "releases" | "deals" | "news";

export type FeedSource = "server" | "mock" | "empty";
export type FeedStatus = "ok" | "empty" | "error";

export type ContentFeedResult<T> = {
  items: T[];
  fetchedAt: string | null;
  source: FeedSource;
  status: FeedStatus;
};

export type ViteEnvSlice = {
  DEV?: boolean;
  PROD?: boolean;
  VITE_CONTENT_FEED_MOCK?: string;
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  SUPABASE_URL?: string;
  SUPABASE_PUBLISHABLE_KEY?: string;
};

export type FetchContentKindOptions<T> = {
  since?: string;
  limit?: number;
  fetch?: typeof fetch;
  env?: ViteEnvSlice;
  mockItems?: T[];
};

export function contentFeedUrl(
  baseUrl: string,
  kind: ContentKind,
  opts: { since?: string; limit?: number } = {},
): string {
  const root = baseUrl.replace(/\/$/, "");
  const url = new URL(`${root}/functions/v1/content-feed`);
  url.searchParams.set("kind", kind);
  if (opts.since) url.searchParams.set("since", opts.since);
  if (opts.limit != null) url.searchParams.set("limit", String(opts.limit));
  return url.toString();
}

export function showFixtureShelves(source: FeedSource | undefined) {
  return source === "mock";
}

export function allowMockContentFeed(env: ViteEnvSlice = {}): boolean {
  if (env.DEV !== true) return false;
  if (env.VITE_CONTENT_FEED_MOCK === "0") return false;
  return true;
}

export function parseContentFeedResponse(json: unknown): { items: unknown[]; fetchedAt: string } {
  if (!json || typeof json !== "object") {
    throw new Error("invalid_feed");
  }
  const record = json as Record<string, unknown>;
  const items = Array.isArray(record.items) ? record.items : [];
  const fetchedAt = typeof record.fetchedAt === "string" ? record.fetchedAt : "";
  return { items, fetchedAt };
}

export function devMockIfUnrenderable<T>(
  result: ContentFeedResult<T>,
  mockItems: T[],
  env: ViteEnvSlice = {},
): ContentFeedResult<T> {
  if (result.items.length > 0) return result;
  if (result.source !== "server") return result;
  if (!allowMockContentFeed(env)) return result;
  return {
    items: mockItems,
    fetchedAt: null,
    source: "mock",
    status: mockItems.length ? "ok" : "empty",
  };
}

function readViteEnv(): ViteEnvSlice {
  return (import.meta.env ?? {}) as ViteEnvSlice;
}

export async function fetchContentKind<T>(
  kind: ContentKind,
  options: FetchContentKindOptions<T> = {},
): Promise<ContentFeedResult<T>> {
  const env = options.env ?? readViteEnv();
  const allowMock = allowMockContentFeed(env);
  const mockItems = options.mockItems ?? [];

  const fallback = (status: FeedStatus): ContentFeedResult<T> => {
    if (allowMock) {
      return {
        items: mockItems,
        fetchedAt: null,
        source: "mock",
        status,
      };
    }
    return { items: [], fetchedAt: null, source: "empty", status: "error" };
  };

  if (allowMock && env.VITE_CONTENT_FEED_MOCK === "1") {
    return {
      items: mockItems,
      fetchedAt: null,
      source: "mock",
      status: mockItems.length ? "ok" : "empty",
    };
  }

  const baseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
  const publishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_PUBLISHABLE_KEY;
  if (!baseUrl || !publishableKey) return fallback("error");

  const feedOpts: { since?: string; limit?: number } = {};
  if (options.since) feedOpts.since = options.since;
  if (options.limit != null) feedOpts.limit = options.limit;

  try {
    const fetchFn = options.fetch ?? fetch;
    const response = await fetchFn(contentFeedUrl(baseUrl, kind, feedOpts), {
      method: "GET",
      headers: {
        apikey: publishableKey,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return fallback("error");
    const parsed = parseContentFeedResponse(await response.json());
    const items = parsed.items as T[];
    return {
      items,
      fetchedAt: parsed.fetchedAt,
      source: "server",
      status: items.length ? "ok" : "empty",
    };
  } catch {
    return fallback("error");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

const PRECISIONS: ReadonlySet<string> = new Set([
  "exact",
  "date",
  "month",
  "quarter",
  "year",
  "tba",
]);
const CONFIDENCES: ReadonlySet<string> = new Set([
  "confirmed",
  "high",
  "expected",
  "unconfirmed",
  "tba",
]);
const KINDS: ReadonlySet<string> = new Set([
  "full",
  "early-access",
  "dlc",
  "expansion",
  "demo",
  "beta",
]);
const STATES: ReadonlySet<string> = new Set(["upcoming", "available", "delayed"]);

export function isPlatformId(value: unknown): value is PlatformId {
  return typeof value === "string" && value in PLATFORMS;
}

function isPlatformIdList(value: unknown): value is PlatformId[] {
  return Array.isArray(value) && value.every(isPlatformId);
}

export function isReleaseEvent(value: unknown): value is ReleaseEvent {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    value.id.trim().length > 0 &&
    typeof value.gameId === "string" &&
    value.gameId.trim().length > 0 &&
    typeof value.date === "string" &&
    value.date.length >= 10 &&
    !Number.isNaN(Date.parse(value.date)) &&
    PRECISIONS.has(value.precision as string) &&
    CONFIDENCES.has(value.confidence as string) &&
    KINDS.has(value.kind as string) &&
    STATES.has(value.state as string) &&
    isPlatformIdList(value.platforms)
  );
}

export function isGameSnapshot(value: unknown): value is Game {
  if (!isRecord(value)) return false;
  if (
    typeof value.id !== "string" ||
    value.id.trim().length === 0 ||
    typeof value.slug !== "string" ||
    value.slug.trim().length === 0 ||
    typeof value.title !== "string" ||
    typeof value.coverUrl !== "string" ||
    typeof value.developer !== "string" ||
    typeof value.publisher !== "string" ||
    typeof value.summary !== "string"
  ) {
    return false;
  }
  if (!isPlatformIdList(value.platforms)) return false;
  if (!Array.isArray(value.genres) || !value.genres.every((g) => typeof g === "string")) {
    return false;
  }
  if (!Array.isArray(value.releaseEvents) || !value.releaseEvents.every(isReleaseEvent)) {
    return false;
  }
  if (value.backdropUrl != null && typeof value.backdropUrl !== "string") return false;
  if (value.originalTitle != null && typeof value.originalTitle !== "string") return false;
  return true;
}

export function isRadarEntry(value: unknown): value is RadarEntry {
  if (!isRecord(value)) return false;
  if (!isGameSnapshot(value.game) || !isReleaseEvent(value.event)) return false;
  return value.game.id === value.event.gameId;
}

export function isDealItem(value: unknown): value is Deal {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    value.id.trim().length === 0 ||
    typeof value.gameId !== "string" ||
    value.gameId.trim().length === 0 ||
    typeof value.store !== "string" ||
    typeof value.priceCurrent !== "number" ||
    typeof value.priceBase !== "number" ||
    typeof value.discountPercent !== "number" ||
    typeof value.currency !== "string"
  ) {
    return false;
  }
  if (value.game != null) {
    if (!isGameSnapshot(value.game)) return false;
    if (value.game.id !== value.gameId) return false;
  }
  return true;
}

export function isArticleItem(value: unknown): value is Article {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    value.id.trim().length === 0 ||
    typeof value.title !== "string" ||
    typeof value.source !== "string" ||
    typeof value.publishedAt !== "string"
  ) {
    return false;
  }
  if (
    value.gameId != null &&
    (typeof value.gameId !== "string" || value.gameId.trim().length === 0)
  ) {
    return false;
  }
  if (value.game != null) {
    if (!isGameSnapshot(value.game)) return false;
    if (typeof value.gameId === "string" && value.game.id !== value.gameId) return false;
  }
  return true;
}

/** Empty-error results throw so React Query keeps the last successful payload. */
export class FeedUnavailableError extends Error {
  constructor() {
    super("feed_unavailable");
    this.name = "FeedUnavailableError";
  }
}

export function requireFeedSuccess<T>(result: ContentFeedResult<T>): ContentFeedResult<T> {
  if (result.status === "error" && result.items.length === 0) {
    throw new FeedUnavailableError();
  }
  return result;
}

export function findGameBySlug(
  slug: string,
  sources: {
    releases?: RadarEntry[];
    deals?: Deal[];
    news?: Article[];
  },
): Game | undefined {
  for (const entry of sources.releases ?? []) {
    if (entry.game.slug === slug) return entry.game;
  }
  for (const deal of sources.deals ?? []) {
    if (deal.game?.slug === slug) return deal.game;
  }
  for (const article of sources.news ?? []) {
    if (article.game?.slug === slug) return article.game;
  }
  return undefined;
}

export function uniqueGamesFromReleases(entries: RadarEntry[]): Game[] {
  const seen = new Set<string>();
  const games: Game[] = [];
  for (const { game } of entries) {
    if (seen.has(game.id)) continue;
    seen.add(game.id);
    games.push(game);
  }
  return games;
}

/** Stable ISO clock for radar "today" — epoch until `useNow` hydrates (no SSR mismatch). */
export function radarReferenceIso(nowMs: number | null): string {
  return nowMs == null ? "1970-01-01T00:00:00.000Z" : new Date(nowMs).toISOString();
}

export function selectReleaseItems(items: unknown[]): RadarEntry[] {
  return items.filter(isRadarEntry);
}

export function selectDealItems(items: unknown[]): Deal[] {
  return items.filter(isDealItem);
}

export function selectArticleItems(items: unknown[]): Article[] {
  return items.filter(isArticleItem);
}

function withSelectedItems<T>(
  result: ContentFeedResult<unknown>,
  items: T[],
): ContentFeedResult<T> {
  const status = result.status === "error" ? "error" : items.length ? "ok" : "empty";
  return { ...result, items, status };
}

async function devMockItems(kind: ContentKind): Promise<unknown[]> {
  if (!import.meta.env.DEV) return [];
  const mock = await import("@/domain/mock-data");
  if (kind === "releases") return [...mock.UPCOMING_RELEASES, ...mock.RECENTLY_RELEASED];
  if (kind === "deals") {
    return mock.DEALS.map((deal) => ({ ...deal, game: mock.getGame(deal.gameId) }));
  }
  return mock.ARTICLES.map((article) => ({
    ...article,
    ...(article.gameId ? { game: mock.getGame(article.gameId) } : {}),
  }));
}

export async function getReleases(
  options: FetchContentKindOptions<RadarEntry> = {},
): Promise<ContentFeedResult<RadarEntry>> {
  const mockItems = options.mockItems ?? ((await devMockItems("releases")) as RadarEntry[]);
  const result = await fetchContentKind("releases", { ...options, mockItems });
  const selected = withSelectedItems(result, selectReleaseItems(result.items));
  return devMockIfUnrenderable(selected, mockItems, options.env ?? readViteEnv());
}

export async function getDeals(
  options: FetchContentKindOptions<Deal> = {},
): Promise<ContentFeedResult<Deal>> {
  const mockItems = options.mockItems ?? ((await devMockItems("deals")) as Deal[]);
  const result = await fetchContentKind("deals", { ...options, mockItems });
  const selected = withSelectedItems(result, selectDealItems(result.items));
  return devMockIfUnrenderable(selected, mockItems, options.env ?? readViteEnv());
}

export async function getNews(
  options: FetchContentKindOptions<Article> = {},
): Promise<ContentFeedResult<Article>> {
  const mockItems = options.mockItems ?? ((await devMockItems("news")) as Article[]);
  const result = await fetchContentKind("news", { ...options, mockItems });
  const selected = withSelectedItems(result, selectArticleItems(result.items));
  return devMockIfUnrenderable(selected, mockItems, options.env ?? readViteEnv());
}

export function splitReleaseItems(
  items: RadarEntry[],
  nowMs: number | null = null,
): {
  upcoming: RadarEntry[];
  recent: RadarEntry[];
  changed: RadarEntry[];
} {
  const notAvailable = items.filter((entry) => entry.event.state !== "available");
  const upcoming =
    nowMs == null
      ? notAvailable
      : notAvailable.filter((entry) => isReleaseStillAhead(entry.event, nowMs));
  const recent = items.filter((entry) => entry.event.state === "available");
  const changed = upcoming.filter((entry) => entry.event.previousDate);
  return { upcoming, recent, changed };
}

export function freshnessFromFeed(
  result: ContentFeedResult<unknown> | undefined,
  isPending: boolean,
  nowMs: number,
  isError = false,
): FreshnessStatus {
  if (isPending) return { state: "refreshing", minutesAgo: 0 };
  const then = result?.fetchedAt ? Date.parse(result.fetchedAt) : Number.NaN;
  const minutesAgo = Number.isNaN(then) ? 0 : Math.max(0, Math.round((nowMs - then) / 60_000));
  if (isError || result?.status === "error" || result?.source === "mock" || !result?.fetchedAt) {
    return { state: "stale", minutesAgo };
  }
  if (minutesAgo <= 5) return { state: "fresh", minutesAgo };
  return { state: "stale", minutesAgo };
}
