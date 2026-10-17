import { createClient } from "npm:@supabase/supabase-js@2";
import { handleContentIngest } from "./handler.ts";
import { mapSteamAppToRadarEntry } from "../../src/integrations/content/steam-release-mapper.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

Deno.serve((req) =>
  handleContentIngest(req, {
    serviceRoleKey,
    mapSteamApp: mapSteamAppToRadarEntry,
    upsertItem: async (kind, externalId, publishedAt, payload) => {
      const { data, error } = await supabase.rpc("upsert_content_item", {
        p_kind: kind,
        p_external_id: externalId,
        p_published_at: publishedAt,
        p_payload: payload,
      });
      if (error) throw error;
      return String(data);
    },
  }),
);
