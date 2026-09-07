import { createClient } from "npm:@supabase/supabase-js@2";
import {
  fetchSteamPersona,
  handleSteamConnect,
  verifySteamOpenId,
  type SteamConnectDeps,
} from "./handler.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const steamApiKey = Deno.env.get("STEAM_API_KEY") ?? Deno.env.get("STEAM_WEB_API_KEY") ?? "";
const returnOrigin = Deno.env.get("STEAM_RETURN_ORIGIN") ?? Deno.env.get("APP_ORIGIN") ?? "";

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function createDeps(): SteamConnectDeps {
  return {
    now: () => new Date(),
    randomNonce: () => crypto.randomUUID(),
    env: {
      supabaseUrl,
      steamApiKey: steamApiKey || null,
      returnOrigin,
    },
    getUser: async (jwt) => {
      const { data, error } = await supabase.auth.getUser(jwt);
      if (error || !data.user) return null;
      return { id: data.user.id };
    },
    insertNonce: async (row) => {
      const { error } = await supabase.from("steam_connect_nonces").insert({
        user_id: row.userId,
        nonce: row.nonce,
        return_origin: row.returnOrigin,
        expires_at: row.expiresAt,
      });
      if (error) throw error;
    },
    consumeNonce: async (nonce, now) => {
      const { data, error } = await supabase
        .from("steam_connect_nonces")
        .update({ consumed_at: now.toISOString() })
        .eq("nonce", nonce)
        .is("consumed_at", null)
        .gt("expires_at", now.toISOString())
        .select("user_id, return_origin")
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return { userId: data.user_id as string, returnOrigin: data.return_origin as string };
    },
    upsertSteamLink: async (row) => {
      const { data: existing, error: lookupError } = await supabase
        .from("steam_links")
        .select("user_id")
        .eq("steam_id", row.steamId)
        .maybeSingle();
      if (lookupError) throw lookupError;
      if (existing && existing.user_id !== row.userId) return "steam_taken";

      const { error } = await supabase.from("steam_links").upsert({
        user_id: row.userId,
        steam_id: row.steamId,
        persona_name: row.personaName,
        avatar_url: row.avatarUrl,
        updated_at: new Date().toISOString(),
      });
      if (error) {
        if (error.code === "23505") return "steam_taken";
        throw error;
      }
      return "ok";
    },
    verifyOpenId: (params) => verifySteamOpenId(params),
    fetchPersona: (steamId) => fetchSteamPersona(steamId, steamApiKey || null),
  };
}

Deno.serve((req) => handleSteamConnect(req, createDeps()));
