import { createClient } from "npm:@supabase/supabase-js@2";
import {
  fetchSteamOwnedGames,
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
        ticket: row.ticket,
        return_origin: row.returnOrigin,
        expires_at: row.expiresAt,
      });
      if (error) throw error;
    },
    attachPendingSteam: async (nonce, now, pending) => {
      const { data, error } = await supabase
        .from("steam_connect_nonces")
        .update({
          steam_id: pending.steamId,
          persona_name: pending.personaName,
          avatar_url: pending.avatarUrl,
        })
        .eq("nonce", nonce)
        .is("consumed_at", null)
        .gt("expires_at", now.toISOString())
        .select("ticket, return_origin")
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return { ticket: data.ticket as string, returnOrigin: data.return_origin as string };
    },
    confirmSteamLink: async (ticket, userId, now) => {
      const { data, error } = await supabase
        .from("steam_connect_nonces")
        .update({ consumed_at: now.toISOString() })
        .eq("ticket", ticket)
        .eq("user_id", userId)
        .is("consumed_at", null)
        .gt("expires_at", now.toISOString())
        .not("steam_id", "is", null)
        .select("steam_id, persona_name, avatar_url")
        .maybeSingle();
      if (error) throw error;
      if (!data?.steam_id) return null;
      return {
        steamId: data.steam_id as string,
        personaName: (data.persona_name as string | null) ?? null,
        avatarUrl: (data.avatar_url as string | null) ?? null,
      };
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
    claimSync: async (userId) => {
      const { data, error } = await supabase.rpc("claim_steam_sync", {
        p_user_id: userId,
      });
      if (error) throw error;
      const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null;
      if (!row) {
        return {
          claimed: false,
          attemptId: null,
          steamId: null,
          linkRevision: null,
          currentStatus: "unlinked",
          ownedAppIds: null,
          syncedAt: null,
          retryAfterSeconds: 0,
        };
      }
      return {
        claimed: Boolean(row["claimed"]),
        attemptId: (row["attempt_id"] as string) ?? null,
        steamId: (row["steam_id"] as string) ?? null,
        linkRevision: (row["link_revision"] as string) ?? null,
        currentStatus: (row["current_status"] as string) ?? "idle",
        ownedAppIds: Array.isArray(row["owned_app_ids"])
          ? (row["owned_app_ids"] as unknown[]).map(Number)
          : null,
        syncedAt: (row["synced_at"] as string) ?? null,
        retryAfterSeconds:
          typeof row["retry_after_seconds"] === "number" ? row["retry_after_seconds"] : 0,
      };
    },
    finalizeSync: async (params) => {
      const { data, error } = await supabase.rpc("finalize_steam_sync", {
        p_user_id: params.userId,
        p_steam_id: params.steamId,
        p_link_revision: params.linkRevision,
        p_attempt_id: params.attemptId,
        p_sync_status: params.syncStatus,
        p_owned_app_ids: params.ownedAppIds,
        p_game_count: params.gameCount,
      });
      if (error) throw error;
      return Boolean(data);
    },
    fetchOwnedGames: (steamId) => fetchSteamOwnedGames(steamId, steamApiKey || null),
  };
}

Deno.serve((req) => handleSteamConnect(req, createDeps()));
