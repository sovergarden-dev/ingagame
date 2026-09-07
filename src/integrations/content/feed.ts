import type { Article, Deal, FreshnessStatus, RadarEntry } from "@/domain/types";

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

async function devMockItems(kind: ContentKind): Promise<unknown[]> {
  if (!import.meta.env.DEV) return [];
  const mock = await import("@/domain/mock-data");
  if (kind === "releases") return [...mock.UPCOMING_RELEASES, ...mock.RECENTLY_RELEASED];
  if (kind === "deals") return mock.DEALS;
  return mock.ARTICLES;
}

export async function getReleases(
  options: FetchContentKindOptions<RadarEntry> = {},
): Promise<ContentFeedResult<RadarEntry>> {
  const mockItems = options.mockItems ?? ((await devMockItems("releases")) as RadarEntry[]);
  return fetchContentKind("releases", { ...options, mockItems });
}

export async function getDeals(
  options: FetchContentKindOptions<Deal> = {},
): Promise<ContentFeedResult<Deal>> {
  const mockItems = options.mockItems ?? ((await devMockItems("deals")) as Deal[]);
  return fetchContentKind("deals", { ...options, mockItems });
}

export async function getNews(
  options: FetchContentKindOptions<Article> = {},
): Promise<ContentFeedResult<Article>> {
  const mockItems = options.mockItems ?? ((await devMockItems("news")) as Article[]);
  return fetchContentKind("news", { ...options, mockItems });
}

export function splitReleaseItems(items: RadarEntry[]): {
  upcoming: RadarEntry[];
  recent: RadarEntry[];
  changed: RadarEntry[];
} {
  const upcoming = items.filter((entry) => entry.event.state !== "available");
  const recent = items.filter((entry) => entry.event.state === "available");
  const changed = upcoming.filter((entry) => entry.event.previousDate);
  return { upcoming, recent, changed };
}

export function freshnessFromFeed(
  result: ContentFeedResult<unknown> | undefined,
  isPending: boolean,
  nowMs: number,
): FreshnessStatus {
  if (isPending) return { state: "refreshing", minutesAgo: 0 };
  if (!result?.fetchedAt) return { state: "stale", minutesAgo: 0 };
  const then = Date.parse(result.fetchedAt);
  const minutesAgo = Number.isNaN(then) ? 0 : Math.max(0, Math.round((nowMs - then) / 60_000));
  if (result.status === "error" || result.source === "mock") {
    return { state: "stale", minutesAgo };
  }
  if (minutesAgo <= 5) return { state: "fresh", minutesAgo };
  return { state: "stale", minutesAgo };
}
