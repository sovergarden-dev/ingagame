import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const repoRoot = join(import.meta.dirname, "../../..");
const migrationsDir = join(repoRoot, "supabase/migrations");
const p0bMigration = "20260907003000_content_items_edge_read.sql";

function readMigrations(): { name: string; sql: string }[] {
  return readdirSync(migrationsDir)
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .map((name) => ({ name, sql: readFileSync(join(migrationsDir, name), "utf8") }));
}

describe("P0c steam_links is authenticated-owner with REVOKE PUBLIC/anon", () => {
  it("adds steam_links after P0b with owner RLS and no PUBLIC/anon grants", () => {
    const additive = readMigrations().filter((m) => m.name > p0bMigration);
    assert.ok(additive.length > 0, "expected an additive migration after P0b");
    const sql = additive.map((m) => m.sql).join("\n");

    assert.match(sql, /CREATE TABLE public\.steam_links/);
    assert.match(sql, /user_id UUID NOT NULL PRIMARY KEY REFERENCES auth\.users ON DELETE CASCADE/);
    assert.match(sql, /steam_id TEXT NOT NULL/);
    assert.match(sql, /persona_name TEXT/);
    assert.match(sql, /avatar_url TEXT/);
    assert.match(sql, /UNIQUE \(steam_id\)/);
    assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
    assert.match(sql, /REVOKE ALL ON TABLE public\.steam_links FROM PUBLIC,\s*anon;/);
    assert.match(sql, /GRANT SELECT, DELETE ON public\.steam_links TO authenticated;/);
    assert.match(sql, /GRANT ALL ON public\.steam_links TO service_role;/);
    assert.match(sql, /CREATE POLICY "steam_links_select_own"/);
    assert.match(sql, /CREATE POLICY "steam_links_delete_own"/);
    assert.doesNotMatch(
      sql,
      /GRANT\s+(ALL|INSERT|UPDATE)[^;]*ON (TABLE )?public\.steam_links TO (PUBLIC|anon|authenticated)/i,
    );
  });

  it("does not put Steam tokens or API keys on steam_links", () => {
    const additive = readMigrations().filter((m) => m.name > p0bMigration);
    const sql = additive.map((m) => m.sql).join("\n");
    const steamLinksBlock = sql.slice(sql.indexOf("CREATE TABLE public.steam_links"));
    const tableSql = steamLinksBlock.slice(0, steamLinksBlock.indexOf(";") + 1);
    assert.doesNotMatch(
      tableSql,
      /api[_-]?key|access_token|refresh_token|client_secret|session_token/i,
    );
  });

  it("keeps OpenID nonces service_role-only (no client Data API rights)", () => {
    const additive = readMigrations().filter((m) => m.name > p0bMigration);
    const sql = additive.map((m) => m.sql).join("\n");
    assert.match(sql, /CREATE TABLE public\.steam_connect_nonces/);
    assert.match(
      sql,
      /REVOKE ALL ON TABLE public\.steam_connect_nonces FROM PUBLIC,\s*anon,\s*authenticated;/,
    );
    assert.match(sql, /GRANT ALL ON public\.steam_connect_nonces TO service_role;/);
    assert.doesNotMatch(
      sql,
      /GRANT\s+(ALL|SELECT|INSERT|UPDATE|DELETE)[^;]*ON (TABLE )?public\.steam_connect_nonces TO (PUBLIC|anon|authenticated)/i,
    );
  });
});
