import { createClient } from "npm:@supabase/supabase-js@2";
import { handleContentFeed, type FeedRow } from "./handler.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

Deno.serve((req) =>
  handleContentFeed(req, async ({ kind, since, limit, nowIso, offerType }) => {
    let query = supabase.from("content_items").select("payload, published_at").eq("kind", kind);

    if (kind === "deals") {
      query = query.eq("offer_state", "active");
      if (offerType) {
        query = query.eq("offer_type", offerType);
        if (offerType === "free_to_keep" || offerType === "free_weekend") {
          query = query.or(`claim_ends_at.is.null,claim_ends_at.gt.${nowIso}`);
        } else {
          query = query.or(`expires_at.is.null,expires_at.gt.${nowIso}`);
        }
      } else {
        query = query.or(`expires_at.is.null,expires_at.gt.${nowIso}`);
      }
    }

    query = query.order("published_at", { ascending: false }).limit(limit);

    if (since) query = query.gt("published_at", since);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as FeedRow[];
  }),
);
