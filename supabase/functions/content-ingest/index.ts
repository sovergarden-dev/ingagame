import { createClient } from "npm:@supabase/supabase-js@2";
import { handleContentIngest } from "./handler.ts";
import { mapSteamAppToRadarEntry } from "../../src/integrations/content/steam-release-mapper.ts";
import {
  mapSteamSpecialToDeal,
  type RawSteamSpecial,
} from "../../src/integrations/content/steam-deals-mapper.ts";
import {
  mapSteamNewsToArticle,
  type RawSteamNewsItem,
} from "../../src/integrations/content/steam-news-mapper.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

Deno.serve((req) =>
  handleContentIngest(req, {
    serviceRoleKey,
    mapSteamApp: mapSteamAppToRadarEntry,
    mapSteamDeal: (special) => mapSteamSpecialToDeal(special as unknown as RawSteamSpecial),
    mapSteamNews: (item) => mapSteamNewsToArticle(item as unknown as RawSteamNewsItem),
    upsertItem: async (
      kind,
      externalId,
      publishedAt,
      payload,
      expiresAt,
      offerState,
      sourceFreshUntil,
    ) => {
      const { data, error } = await supabase.rpc("upsert_content_item", {
        p_kind: kind,
        p_external_id: externalId,
        p_published_at: publishedAt,
        p_payload: payload,
        p_expires_at: expiresAt ?? null,
        p_offer_state: offerState ?? "active",
        p_source_fresh_until: sourceFreshUntil ?? null,
      });
      if (error) throw error;
      return String(data);
    },
  }),
);
