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
  claimRun?: (
    action: string,
    trigger?: string,
  ) => Promise<{ claimed: boolean; runId?: string; reason?: string }>;
  finalizeRun?: (
    runId: string,
    status: "completed" | "failed",
    stats: { synced: number; dropped: number; total: number; error?: string },
  ) => Promise<boolean>;
  upsertItem: (
    runId: string,
    kind: "releases" | "deals" | "news",
    externalId: string,
    publishedAt: string,
    payload: unknown,
    expiresAt?: string | null,
    offerState?: string,
    sourceFreshUntil?: string | null,
    offerType?: string,
    claimEndsAt?: string | null,
    accessEndsAt?: string | null,
    classificationStatus?: string,
  ) => Promise<string>;
  fetchSteamFeatured?: () => Promise<RawSteamApp[]>;
  mapSteamApp?: (app: RawSteamApp) => MappedRadarEntry | null;
  fetchSteamSpecials?: () => Promise<unknown[]>;
  mapSteamDeal?: (
    special: unknown,
    now?: Date,
  ) => {
    deal: unknown;
    externalId: string;
    expiresAt?: string | null;
    offerState?: string;
    sourceFreshUntil?: string | null;
    offerType?: string;
    claimEndsAt?: string | null;
    accessEndsAt?: string | null;
    classificationStatus?: string;
  } | null;
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

  const payload = body as { action?: string; items?: unknown[]; trigger?: string };
  const action = payload.action ?? "sync_steam_releases";
  const now = deps.now ? deps.now() : new Date();

  async function withIngestLease(
    actionName: string,
    executeFn: (runId: string) => Promise<Response>,
  ): Promise<Response> {
    const trigger = payload.trigger ?? "manual";
    let runId: string;

    if (deps.claimRun) {
      const claim = await deps.claimRun(actionName, trigger);
      if (!claim.claimed) {
        const reason = claim.reason ?? "lease_held";
        if (reason === "action_disabled") {
          return jsonResponse({ error: "action_disabled", action: actionName, reason }, 409);
        }
        if (reason === "cooldown_active") {
          return jsonResponse({ error: "cooldown_active", action: actionName, reason }, 429);
        }
        return jsonResponse({ error: "lease_held", action: actionName, reason }, 409);
      }
      runId = claim.runId ?? "00000000-0000-0000-0000-000000000000";
    } else {
      runId = "00000000-0000-0000-0000-000000000000";
    }

    try {
      const res = await executeFn(runId);
      if (deps.finalizeRun && deps.claimRun) {
        if (res.ok) {
          try {
            const clone = res.clone();
            const data = (await clone.json()) as {
              synced?: number;
              dropped?: number;
              total?: number;
            };
            await deps.finalizeRun(runId, "completed", {
              synced: data.synced ?? 0,
              dropped: data.dropped ?? 0,
              total: data.total ?? 0,
            });
          } catch {
            await deps.finalizeRun(runId, "completed", { synced: 0, dropped: 0, total: 0 });
          }
        } else {
          await deps.finalizeRun(runId, "failed", {
            synced: 0,
            dropped: 0,
            total: 0,
            error: `http_status_${res.status}`,
          });
        }
      }
      return res;
    } catch (err) {
      if (deps.finalizeRun && deps.claimRun) {
        await deps.finalizeRun(runId, "failed", {
          synced: 0,
          dropped: 0,
          total: 0,
          error: err instanceof Error ? err.message : String(err),
        });
      }
      throw err;
    }
  }

  if (action === "sync_steam_releases") {
    return withIngestLease(action, async (activeRunId) => {
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
          await deps.upsertItem(activeRunId, "releases", externalId, now.toISOString(), entry);
          synced++;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          if (errMsg.includes("lease_")) {
            return jsonResponse({ error: "lease_lost", action, details: errMsg }, 409);
          }
          dropped++;
          errors.push(`upsert_failed:${app.id}:${errMsg}`);
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
    });
  }

  if (action === "sync_steam_deals") {
    return withIngestLease(action, async (activeRunId) => {
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
        const mapped = mapper(item, now);
        if (!mapped) {
          dropped++;
          continue;
        }
        try {
          await deps.upsertItem(
            activeRunId,
            "deals",
            mapped.externalId,
            now.toISOString(),
            mapped.deal,
            mapped.expiresAt ?? null,
            mapped.offerState ?? "active",
            mapped.sourceFreshUntil ?? null,
            mapped.offerType ?? "discount",
            mapped.claimEndsAt ?? null,
            mapped.accessEndsAt ?? null,
            mapped.classificationStatus ?? "unverified",
          );
          synced++;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          if (errMsg.includes("lease_")) {
            return jsonResponse({ error: "lease_lost", action, details: errMsg }, 409);
          }
          dropped++;
          errors.push(`upsert_failed:${mapped.externalId}:${errMsg}`);
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
    });
  }

  if (action === "sync_steam_news") {
    return withIngestLease(action, async (activeRunId) => {
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
          await deps.upsertItem(
            activeRunId,
            "news",
            mapped.externalId,
            now.toISOString(),
            mapped.article,
          );
          synced++;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          if (errMsg.includes("lease_")) {
            return jsonResponse({ error: "lease_lost", action, details: errMsg }, 409);
          }
          dropped++;
          errors.push(`upsert_failed:${mapped.externalId}:${errMsg}`);
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
    });
  }

  if (action === "ingest_batch") {
    return withIngestLease(action, async (activeRunId) => {
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
          await deps.upsertItem(
            activeRunId,
            item.kind,
            item.externalId,
            now.toISOString(),
            item.payload,
          );
          synced++;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          if (errMsg.includes("lease_")) {
            return jsonResponse({ error: "lease_lost", action, details: errMsg }, 409);
          }
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
    });
  }

  return jsonResponse({ error: "unknown_action", action }, 400);
}
