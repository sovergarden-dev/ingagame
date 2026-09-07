export const CONTENT_KINDS = ["releases", "deals", "news"] as const;
export type ContentKind = (typeof CONTENT_KINDS)[number];

export const DEFAULT_LIMIT = 50;
export const MAX_LIMIT = 100;
export const CACHE_CONTROL = "public, max-age=60, stale-while-revalidate=120";

export type FeedRow = {
  payload: unknown;
  published_at: string;
};

export type FeedQuery = {
  kind: ContentKind;
  since: string | null;
  limit: number;
};

export type FeedQueryFn = (query: FeedQuery) => Promise<FeedRow[]>;

type ParseOk = { ok: true } & FeedQuery;
type ParseErr = { ok: false; status: number; error: string };
export type ParseFeedResult = ParseOk | ParseErr;

const SECRET_KEY =
  /secret|password|token|api[_-]?key|service[_-]?role|authorization|private[_-]?key/i;

export function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
  };
}

export function parseFeedSearchParams(url: URL): ParseFeedResult {
  const kind = url.searchParams.get("kind");
  if (kind !== "releases" && kind !== "deals" && kind !== "news") {
    return { ok: false, status: 400, error: "invalid_kind" };
  }

  const sinceRaw = url.searchParams.get("since");
  let since: string | null = null;
  if (sinceRaw) {
    const ms = Date.parse(sinceRaw);
    if (Number.isNaN(ms)) {
      return { ok: false, status: 400, error: "invalid_since" };
    }
    since = new Date(ms).toISOString();
  }

  const limitRaw = url.searchParams.get("limit");
  let limit = DEFAULT_LIMIT;
  if (limitRaw != null && limitRaw !== "") {
    const n = Number(limitRaw);
    if (!Number.isFinite(n)) {
      return { ok: false, status: 400, error: "invalid_limit" };
    }
    limit = Math.min(MAX_LIMIT, Math.max(1, Math.trunc(n)));
  }

  return { ok: true, kind, since, limit };
}

export function toPublicItem(payload: unknown): unknown | null {
  if (!payload || typeof payload !== "object") return null;
  return stripSecrets(payload);
}

function stripSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripSecrets);
  if (!value || typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (SECRET_KEY.test(key) || /SERVICE_ROLE/i.test(key)) continue;
    out[key] = stripSecrets(nested);
  }
  return out;
}

function jsonResponse(body: unknown, status: number, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(),
      "Content-Type": "application/json",
      ...extra,
    },
  });
}

export async function handleContentFeed(
  req: Request,
  queryItems: FeedQueryFn,
  options: { now?: () => Date } = {},
): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders() });
  }
  if (req.method !== "GET") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  const parsed = parseFeedSearchParams(new URL(req.url));
  if (!parsed.ok) {
    return jsonResponse({ error: parsed.error }, parsed.status);
  }

  try {
    const rows = await queryItems({
      kind: parsed.kind,
      since: parsed.since,
      limit: parsed.limit,
    });
    const items: unknown[] = [];
    for (const row of rows) {
      const item = toPublicItem(row.payload);
      if (item) items.push(item);
    }
    const fetchedAt = (options.now ?? (() => new Date()))().toISOString();
    return jsonResponse({ items, fetchedAt }, 200, { "Cache-Control": CACHE_CONTROL });
  } catch {
    return jsonResponse({ error: "feed_unavailable" }, 500);
  }
}
