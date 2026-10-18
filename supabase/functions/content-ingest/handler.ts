export const STEAM_FEATURED_URL =
  "https://store.steampowered.com/api/featuredcategories/?l=english";

export function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

export type RawSteamApp = {
  id: number;
  name: string;
  header_image?: string;
  large_capsule_image?: string;
  tiny_image?: string;
  windows_available?: boolean;
  mac_available?: boolean;
  linux_available?: boolean;
  developer?: string;
  publisher?: string;
  short_description?: string;
  genres?: string[];
  release_date?:
    | {
        coming_soon?: boolean;
        date?: string;
      }
    | string;
};

export type MappedRadarEntry = {
  game: {
    id: string;
    steamAppId?: number | undefined;
  };
  event: unknown;
};

export type IngestDeps = {
  now?: () => Date;
  serviceRoleKey: string;
  upsertItem: (
    kind: "releases" | "deals" | "news",
    externalId: string,
    publishedAt: string,
    payload: unknown,
  ) => Promise<string>;
  fetchSteamFeatured?: () => Promise<RawSteamApp[]>;
  mapSteamApp?: (app: RawSteamApp) => MappedRadarEntry | null;
  fetchSteamSpecials?: () => Promise<unknown[]>;
  mapSteamDeal?: (special: unknown) => { deal: unknown; externalId: string } | null;
  fetchSteamNews?: (appId: number) => Promise<unknown[]>;
  mapSteamNews?: (item: unknown) => { article: unknown; externalId: string } | null;
};

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(),
      "Content-Type": "application/json",
    },
  });
}

function extractBearer(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (!auth) return null;
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match ? (match[1]?.trim() ?? null) : null;
}

export async function fetchLiveSteamFeatured(): Promise<RawSteamApp[]> {
  const res = await fetch(STEAM_FEATURED_URL, {
    headers: {
      "User-Agent": "GamePulse-Ingest/1.0",
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    throw new Error(`steam_fetch_failed: ${res.status}`);
  }
  const json = (await res.json()) as { coming_soon?: { items?: RawSteamApp[] } };
  return json?.coming_soon?.items ?? [];
}

export async function fetchLiveSteamSpecials(): Promise<unknown[]> {
  const res = await fetch(STEAM_FEATURED_URL, {
    headers: {
      "User-Agent": "GamePulse-Ingest/1.0",
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    throw new Error(`steam_specials_fetch_failed: ${res.status}`);
  }
  const json = (await res.json()) as { specials?: { items?: unknown[] } };
  return json?.specials?.items ?? [];
}

export async function fetchLiveSteamNews(appId: number): Promise<unknown[]> {
  const url = `https://api.steampowered.com/ISteamNews/GetNewsForApp/v0002/?appid=${appId}&count=10&maxlength=500&format=json`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "GamePulse-Ingest/1.0",
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    throw new Error(`steam_news_fetch_failed: ${res.status}`);
  }
  const json = (await res.json()) as { appnews?: { newsitems?: unknown[] } };
  return json?.appnews?.newsitems ?? [];
}

export async function handleContentIngest(req: Request, deps: IngestDeps): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders() });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  // Authentication check: strictly require service_role authorization
  const token = extractBearer(req);
  if (!token || token !== deps.serviceRoleKey) {
    return jsonResponse({ error: "unauthorized" }, 401);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400);
  }

  if (!body || typeof body !== "object") {
    return jsonResponse({ error: "invalid_body" }, 400);
  }

  const payload = body as { action?: string; items?: unknown[] };
  const action = payload.action ?? "sync_steam_releases";
  const now = deps.now ? deps.now() : new Date();

  if (action === "sync_steam_releases") {
    const mapper = deps.mapSteamApp;
    if (!mapper) {
      return jsonResponse({ error: "missing_mapper" }, 500);
    }

    const fetcher = deps.fetchSteamFeatured ?? fetchLiveSteamFeatured;
    let apps: RawSteamApp[] = [];
    try {
      apps = await fetcher();
    } catch (err) {
      return jsonResponse(
        { error: "steam_fetch_error", details: err instanceof Error ? err.message : String(err) },
        502,
      );
    }

    let synced = 0;
    let dropped = 0;
    const errors: string[] = [];

    for (const app of apps) {
      const entry = mapper(app);
      if (!entry) {
        dropped++;
        continue;
      }

      // External identity with namespace per Notion Sy06 review: "steam:app:<id>"
      const externalId = `steam:app:${app.id}`;
      try {
        await deps.upsertItem("releases", externalId, now.toISOString(), entry);
        synced++;
      } catch (err) {
        dropped++;
        errors.push(`upsert_failed:${app.id}:${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return jsonResponse(
      {
        ok: true,
        action: "sync_steam_releases",
        synced,
        dropped,
        total: apps.length,
        errors: errors.slice(0, 10),
      },
      200,
    );
  }

  if (action === "sync_steam_deals") {
    const mapper = deps.mapSteamDeal;
    if (!mapper) {
      return jsonResponse({ error: "missing_deal_mapper" }, 500);
    }

    const fetcher = deps.fetchSteamSpecials ?? fetchLiveSteamSpecials;
    let specials: unknown[] = [];
    try {
      specials = await fetcher();
    } catch (err) {
      return jsonResponse(
        {
          error: "steam_specials_fetch_error",
          details: err instanceof Error ? err.message : String(err),
        },
        502,
      );
    }

    let synced = 0;
    let dropped = 0;
    const errors: string[] = [];

    for (const item of specials) {
      const mapped = mapper(item);
      if (!mapped) {
        dropped++;
        continue;
      }
      try {
        await deps.upsertItem("deals", mapped.externalId, now.toISOString(), mapped.deal);
        synced++;
      } catch (err) {
        dropped++;
        errors.push(
          `upsert_failed:${mapped.externalId}:${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    return jsonResponse(
      {
        ok: true,
        action: "sync_steam_deals",
        synced,
        dropped,
        total: specials.length,
        errors: errors.slice(0, 10),
      },
      200,
    );
  }

  if (action === "sync_steam_news") {
    const mapper = deps.mapSteamNews;
    if (!mapper) {
      return jsonResponse({ error: "missing_news_mapper" }, 500);
    }

    const appIdRaw = (payload as { appId?: unknown }).appId;
    const appId = typeof appIdRaw === "number" && appIdRaw > 0 ? appIdRaw : 1145350;

    const fetcher = deps.fetchSteamNews ?? fetchLiveSteamNews;
    let newsItems: unknown[] = [];
    try {
      newsItems = await fetcher(appId);
    } catch (err) {
      return jsonResponse(
        {
          error: "steam_news_fetch_error",
          details: err instanceof Error ? err.message : String(err),
        },
        502,
      );
    }

    let synced = 0;
    let dropped = 0;
    const errors: string[] = [];

    for (const item of newsItems) {
      const mapped = mapper(item);
      if (!mapped) {
        dropped++;
        continue;
      }
      try {
        await deps.upsertItem("news", mapped.externalId, now.toISOString(), mapped.article);
        synced++;
      } catch (err) {
        dropped++;
        errors.push(
          `upsert_failed:${mapped.externalId}:${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    return jsonResponse(
      {
        ok: true,
        action: "sync_steam_news",
        appId,
        synced,
        dropped,
        total: newsItems.length,
        errors: errors.slice(0, 10),
      },
      200,
    );
  }

  if (action === "ingest_batch") {
    const rawItems = Array.isArray(payload.items) ? payload.items : [];
    let synced = 0;
    let dropped = 0;

    for (const raw of rawItems) {
      if (!raw || typeof raw !== "object") {
        dropped++;
        continue;
      }
      const item = raw as {
        kind?: "releases" | "deals" | "news";
        externalId?: string;
        payload?: unknown;
      };
      if (!item.kind || !item.externalId || !item.payload) {
        dropped++;
        continue;
      }
      try {
        await deps.upsertItem(item.kind, item.externalId, now.toISOString(), item.payload);
        synced++;
      } catch {
        dropped++;
      }
    }

    return jsonResponse(
      {
        ok: true,
        action: "ingest_batch",
        synced,
        dropped,
        total: rawItems.length,
      },
      200,
    );
  }

  return jsonResponse({ error: "unknown_action", action }, 400);
}
