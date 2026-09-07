import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const repoRoot = join(import.meta.dirname, "../../..");
const migrationsDir = join(repoRoot, "supabase/migrations");
const baselineMigration = "20260906225200_revoke_public_anon_profiles_watchlist.sql";

function readMigrations(): { name: string; sql: string }[] {
  return readdirSync(migrationsDir)
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .map((name) => ({ name, sql: readFileSync(join(migrationsDir, name), "utf8") }));
}

describe("P0b content_items is Edge-only SELECT", () => {
  it("adds content_items after P0a with RLS and no anon/authenticated grants", () => {
    const additive = readMigrations().filter((m) => m.name > baselineMigration);
    assert.ok(additive.length > 0, "expected an additive migration after P0a");
    const sql = additive.map((m) => m.sql).join("\n");

    assert.match(sql, /CREATE TABLE public\.content_items/);
    assert.match(sql, /kind TEXT NOT NULL CHECK \(kind IN \('releases', 'deals', 'news'\)\)/);
    assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
    assert.match(
      sql,
      /REVOKE ALL ON TABLE public\.content_items FROM PUBLIC,\s*anon,\s*authenticated;/,
    );
    assert.match(sql, /GRANT SELECT ON TABLE public\.content_items TO service_role;/);
    assert.doesNotMatch(
      sql,
      /GRANT\s+(ALL|SELECT|INSERT|UPDATE|DELETE)[^;]*ON TABLE public\.content_items TO (PUBLIC|anon|authenticated)/i,
    );
    assert.doesNotMatch(
      sql,
      /GRANT\s+INSERT[^;]*content_items[^;]*TO (PUBLIC|anon|authenticated)/i,
    );
  });

  it("does not grant mutating rights on content_items to the publishable roles in any migration", () => {
    const allSql = readMigrations()
      .map((m) => m.sql)
      .join("\n");
    assert.doesNotMatch(
      allSql,
      /GRANT\s+(ALL|INSERT|UPDATE|DELETE)[^;]*ON TABLE public\.content_items TO (PUBLIC|anon|authenticated)/i,
    );
  });
});
