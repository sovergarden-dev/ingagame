export const STEAM_FEATURED_URL =
  "https://store.steampowered.com/api/featuredcategories/?l=english&cc=us";
export const EPIC_FREE_GAMES_URL =
  "https://store-site-backend-static-ipv4.ak.epicgames.com/freeGamesPromotions?locale=en-US&country=US&allowCountries=US";

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
  fetchEpicFreeGames?: () => Promise<unknown[]>;
  mapEpicDeal?: (
    element: unknown,
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

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

async function fetchJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "GamePulse-Ingest/1.0", Accept: "application/json" },
      signal: controller.signal,
      redirect: "error",
    });
    if (!response.ok) throw new Error(`upstream_http_${response.status}`);
    if (!response.headers.get("content-type")?.includes("application/json") || !response.body) {
      throw new Error("upstream_schema_error");
    }
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.byteLength;
        if (size > 1_000_000) throw new Error("upstream_body_too_large");
        chunks.push(chunk.value);
      }
    } finally {
      await reader.cancel().catch(() => {});
      reader.releaseLock();
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return JSON.parse(new TextDecoder().decode(bytes));
  } finally {
    clearTimeout(timer);
  }
}

function items(value: unknown): unknown[] {
  if (!Array.isArray(value) || value.length > 200 || value.some((x) => !object(x))) {
    throw new Error("upstream_schema_error");
  }
  return value;
}

export async function fetchLiveSteamFeatured(): Promise<RawSteamApp[]> {
  const result = object(await fetchJson(STEAM_FEATURED_URL));
  return items(object(result?.["coming_soon"])?.["items"]) as RawSteamApp[];
}
export async function fetchLiveSteamSpecials(): Promise<unknown[]> {
  const result = object(await fetchJson(STEAM_FEATURED_URL));
  return items(object(result?.["specials"])?.["items"]);
}
export async function fetchLiveSteamNews(appId: number): Promise<unknown[]> {
  const result = object(
    await fetchJson(
      `https://api.steampowered.com/ISteamNews/GetNewsForApp/v0002/?appid=${appId}&count=10&maxlength=500&format=json`,
    ),
  );
  return items(object(result?.["appnews"])?.["newsitems"]);
}
export async function fetchLiveEpicFreeGames(): Promise<unknown[]> {
  const result = object(await fetchJson(EPIC_FREE_GAMES_URL));
  return items(
    object(object(object(result?.["data"])?.["Catalog"])?.["searchStore"])?.["elements"],
  );
}

function writeFailure(
  error: unknown,
  action: string,
  synced: number,
  dropped: number,
  total: number,
): Response {
  const code = object(error)?.["code"];
  const message = error instanceof Error ? error.message : object(error)?.["message"];
  const isLease =
    (code === "55000" || error instanceof Error) &&
    typeof message === "string" &&
    /^(lease_required|lease_expired|lease_not_running|lease_not_owner|action_disabled|action_kind_mismatch)(:|$)/.test(
      message,
    );
  return jsonResponse(
    { error: isLease ? "lease_lost" : "write_failed", action, synced, dropped, total },
    isLease ? 409 : 503,
  );
}

export async function handleContentIngest(req: Request, deps: IngestDeps): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders() });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  // Authentication check: strictly require service_role authorization
  if (!deps.serviceRoleKey || !deps.serviceRoleKey.trim()) {
    return jsonResponse({ error: "service_role_key_missing" }, 503);
  }
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

  if (!object(body)) {
    return jsonResponse({ error: "invalid_body" }, 400);
  }

  const payload = body as {
    action?: string;
    items?: unknown[];
    trigger?: string;
    dispatchId?: string;
    appId?: unknown;
  };
  const action = payload.action ?? "sync_steam_releases";
  const now = deps.now ? deps.now() : new Date();

  if (
    (payload.trigger !== undefined && payload.trigger !== "manual") ||
    payload.dispatchId !== undefined
  ) {
    return jsonResponse({ error: "scheduler_not_ready" }, 409);
  }
  if (action === "ingest_batch") return jsonResponse({ error: "batch_disabled" }, 409);
  const started = performance.now();
  const writeItem: IngestDeps["upsertItem"] = async (...args) => {
    if (performance.now() - started > 90000) throw new Error("run_deadline");
    return deps.upsertItem(...args);
  };

  async function withIngestLease(
    actionName: string,
    executeFn: (runId: string) => Promise<Response>,
  ): Promise<Response> {
    if (!deps.claimRun || !deps.finalizeRun)
      return jsonResponse({ error: "lease_unavailable" }, 503);
    let claim: Awaited<ReturnType<NonNullable<IngestDeps["claimRun"]>>>;
    try {
      claim = await deps.claimRun(actionName, "manual");
    } catch {
      return jsonResponse({ error: "claim_unavailable" }, 503);
    }
    if (!claim.claimed) {
      const reason = [
        "lease_held",
        "action_disabled",
        "cooldown_active",
        "missing_config",
        "scheduler_not_ready",
      ].includes(claim.reason ?? "")
        ? claim.reason
        : "lease_held";
      return jsonResponse(
        { error: reason, action: actionName, reason },
        reason === "cooldown_active" ? 429 : 409,
      );
    }
    const runId = claim.runId;
    if (
      !runId ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(runId) ||
      runId === "00000000-0000-0000-0000-000000000000"
    )
      return jsonResponse({ error: "invalid_claim" }, 503);
    let res: Response;
    try {
      res = await executeFn(runId);
    } catch {
      res = jsonResponse({ error: "execution_failed" }, 500);
    }
    let data: Record<string, unknown> = {};
    try {
      data = object(await res.clone().json()) ?? {};
    } catch {
      data = {};
    }
    const count = (name: string) => {
      const value = data[name];
      return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : 0;
    };
    const stats = {
      synced: count("synced"),
      dropped: count("dropped"),
      total: count("total"),
      ...(res.ok ? {} : { error: `http_status_${res.status}` }),
    };
    try {
      const finalized = await deps.finalizeRun(runId, res.ok ? "completed" : "failed", stats);
      if (!finalized && res.status !== 409)
        return jsonResponse({ error: "finalization_unconfirmed", runId }, 503);
    } catch {
      if (res.status !== 409)
        return jsonResponse({ error: "finalization_unconfirmed", runId }, 503);
    }
    return jsonResponse({ ...data, runId }, res.status);
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
      } catch {
        return jsonResponse({ error: "steam_fetch_error" }, 502);
      }

      let synced = 0;
      let dropped = 0;
      const errors: string[] = [];

      for (const app of apps) {
        let entry: ReturnType<NonNullable<IngestDeps["mapSteamApp"]>>;
        try {
          entry = mapper(app);
        } catch {
          return jsonResponse(
            { error: "mapper_failed", action, synced, dropped, total: apps.length },
            500,
          );
        }
        if (!entry) {
          dropped++;
          continue;
        }

        // External identity with namespace per Notion Sy06 review: "steam:app:<id>"
        const externalId = `steam:app:${app.id}`;
        try {
          await writeItem(activeRunId, "releases", externalId, now.toISOString(), entry);
          synced++;
        } catch (err) {
          return writeFailure(err, action, synced, dropped, apps.length);
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
          },
          502,
        );
      }

      let synced = 0;
      let dropped = 0;
      const errors: string[] = [];

      for (const item of specials) {
        let mapped: ReturnType<NonNullable<IngestDeps["mapSteamDeal"]>>;
        try {
          mapped = mapper(item, now);
        } catch {
          return jsonResponse(
            { error: "mapper_failed", action, synced, dropped, total: specials.length },
            500,
          );
        }
        if (!mapped) {
          dropped++;
          continue;
        }
        try {
          await writeItem(
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
          return writeFailure(err, action, synced, dropped, specials.length);
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
          },
          502,
        );
      }

      let synced = 0;
      let dropped = 0;
      const errors: string[] = [];

      for (const item of newsItems) {
        let mapped: ReturnType<NonNullable<IngestDeps["mapSteamNews"]>>;
        try {
          mapped = mapper(item);
        } catch {
          return jsonResponse(
            { error: "mapper_failed", action, synced, dropped, total: newsItems.length },
            500,
          );
        }
        if (!mapped) {
          dropped++;
          continue;
        }
        try {
          await writeItem(
            activeRunId,
            "news",
            mapped.externalId,
            now.toISOString(),
            mapped.article,
          );
          synced++;
        } catch (err) {
          return writeFailure(err, action, synced, dropped, newsItems.length);
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

  if (action === "sync_epic_free_games") {
    return withIngestLease(action, async (activeRunId) => {
      const mapper = deps.mapEpicDeal;
      if (!mapper) {
        return jsonResponse({ error: "missing_epic_mapper" }, 500);
      }

      const fetcher = deps.fetchEpicFreeGames ?? fetchLiveEpicFreeGames;
      let elements: unknown[] = [];
      try {
        elements = await fetcher();
      } catch (err) {
        return jsonResponse(
          {
            error: "epic_fetch_error",
          },
          502,
        );
      }

      let synced = 0;
      let dropped = 0;
      const errors: string[] = [];

      for (const item of elements) {
        let mapped: ReturnType<NonNullable<IngestDeps["mapEpicDeal"]>>;
        try {
          mapped = mapper(item, now);
        } catch {
          return jsonResponse(
            { error: "mapper_failed", action, synced, dropped, total: elements.length },
            500,
          );
        }
        if (!mapped) {
          dropped++;
          continue;
        }
        try {
          await writeItem(
            activeRunId,
            "deals",
            mapped.externalId,
            now.toISOString(),
            mapped.deal,
            mapped.expiresAt,
            mapped.offerState,
            mapped.sourceFreshUntil,
            mapped.offerType,
            mapped.claimEndsAt,
            mapped.accessEndsAt,
            mapped.classificationStatus,
          );
          synced++;
        } catch (err) {
          return writeFailure(err, action, synced, dropped, elements.length);
        }
      }

      return jsonResponse(
        {
          ok: true,
          action: "sync_epic_free_games",
          synced,
          dropped,
          total: elements.length,
          errors: errors.slice(0, 10),
        },
        200,
      );
    });
  }

  return jsonResponse({ error: "unknown_action", action }, 400);
}
