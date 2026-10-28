import { createClient } from "npm:@supabase/supabase-js@2";
import { handleContentIngest } from "./handler.ts";
import { mapSteamAppToRadarEntry } from "../../../src/integrations/content/steam-release-mapper.ts";
import {
  mapSteamSpecialToDeal,
  type RawSteamSpecial,
} from "../../../src/integrations/content/steam-deals-mapper.ts";
import {
  mapSteamNewsToArticle,
  type RawSteamNewsItem,
} from "../../../src/integrations/content/steam-news-mapper.ts";
import { mapEpicFreeGameToDeal } from "../../../src/integrations/content/epic-free-games-mapper.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

Deno.serve((req) =>
  handleContentIngest(req, {
    serviceRoleKey,
    claimRun: async (action, trigger = "manual") => {
      const { data, error } = await supabase.rpc("claim_ingestion_run", {
        p_action: action,
        p_trigger: trigger,
        p_lease_seconds: 300,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return {
        claimed: Boolean(row?.claimed),
        ...(row?.run_id ? { runId: String(row.run_id) } : {}),
        ...(row?.reason ? { reason: String(row.reason) } : {}),
      };
    },
    finalizeRun: async (runId, status, stats) => {
      const { data, error } = await supabase.rpc("finalize_ingestion_run", {
        p_run_id: runId,
        p_status: status,
        p_synced: stats.synced,
        p_dropped: stats.dropped,
        p_total: stats.total,
        p_error: stats.error ?? null,
      });
      if (error) throw error;
      return Boolean(data);
    },

    mapSteamApp: mapSteamAppToRadarEntry,
    mapSteamDeal: (special, now) => mapSteamSpecialToDeal(special as RawSteamSpecial, "us", now),
    mapSteamNews: (item) => mapSteamNewsToArticle(item as unknown as RawSteamNewsItem),
    mapEpicDeal: (elem, now) => mapEpicFreeGameToDeal(elem, "us", now),
    upsertItem: async (
      runId,
      kind,
      externalId,
      publishedAt,
      payload,
      expiresAt,
      offerState,
      sourceFreshUntil,
      offerType,
      claimEndsAt,
      accessEndsAt,
      classificationStatus,
    ) => {
      const { data, error } = await supabase.rpc("upsert_content_item", {
        p_run_id: runId,
        p_kind: kind,
        p_external_id: externalId,
        p_published_at: publishedAt,
        p_payload: payload,
        p_expires_at: expiresAt ?? null,
        p_offer_state: offerState ?? "active",
        p_source_fresh_until: sourceFreshUntil ?? null,
        p_offer_type: offerType ?? "discount",
        p_claim_ends_at: claimEndsAt ?? null,
        p_access_ends_at: accessEndsAt ?? null,
        p_classification_status: classificationStatus ?? "unverified",
      });
      if (error) throw error;
      return String(data);
    },
  }),
);
