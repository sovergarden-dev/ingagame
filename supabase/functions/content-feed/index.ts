import { createClient } from "npm:@supabase/supabase-js@2";
import { handleContentFeed, type FeedRow } from "./handler.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

Deno.serve((req) =>
  handleContentFeed(req, async ({ kind, since, limit }) => {
    let query = supabase
      .from("content_items")
      .select("payload, published_at")
      .eq("kind", kind)
      .order("published_at", { ascending: false })
      .limit(limit);
    if (since) query = query.gt("published_at", since);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as FeedRow[];
  }),
);
