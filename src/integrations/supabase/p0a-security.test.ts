import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, it } from "node:test";

const repoRoot = join(import.meta.dirname, "../../..");
const srcDir = join(repoRoot, "src");
const migrationsDir = join(repoRoot, "supabase/migrations");
const baselineMigration = "20260905161247_48eac4a6-e779-42e4-b715-cb9cfe77afcb.sql";

const ENV_ACCESS =
  /(?:import\.meta\.env|process\.env)(?:\s*\.\s*([A-Za-z_][\w]*)|\s*\[\s*(['"`])([^'"`]*?)\2\s*\])/g;
const VITE_SERVICE_OR_SECRET = /\bVITE_[A-Za-z0-9_]*((?:SERVICE)|(?:SECRET))[A-Za-z0-9_]*\b/g;
const CLIENT_SERVER_MODULE = /(?:from\s+|import\s*\(\s*)['"][^'"]*client\.server(?:\.ts)?['"]/;

function isServerOnlyPath(relPath: string): boolean {
  return relPath.endsWith(".server.ts") || relPath === "src/server.ts";
}

function isTestPath(relPath: string): boolean {
  return relPath.endsWith(".test.ts") || relPath.endsWith(".test.tsx");
}

function isScannedClientPath(relPath: string): boolean {
  if (!/\.(ts|tsx|js|mjs|cjs)$/.test(relPath)) return false;
  if (isTestPath(relPath) || isServerOnlyPath(relPath)) return false;
  return true;
}

function forbiddenEnvKey(key: string): boolean {
  if (/SERVICE_ROLE/i.test(key)) return true;
  if (/^sb_secret_/.test(key)) return true;
  if (/^VITE_.*(?:SERVICE|SECRET)/i.test(key)) return true;
  return false;
}

/** Findings that would ship a service-role / secret key through the Vite client graph. */
function findClientSecretPinViolations(source: string, relPath: string): string[] {
  if (!isScannedClientPath(relPath)) return [];

  ENV_ACCESS.lastIndex = 0;
  VITE_SERVICE_OR_SECRET.lastIndex = 0;

  const findings: string[] = [];
  if (CLIENT_SERVER_MODULE.test(source)) {
    findings.push(`${relPath}: imports client.server`);
  }
  if (/SERVICE_ROLE/.test(source)) {
    findings.push(`${relPath}: mentions SERVICE_ROLE`);
  }

  for (const match of source.matchAll(ENV_ACCESS)) {
    const key = match[1] ?? match[3] ?? "";
    if (forbiddenEnvKey(key)) {
      findings.push(`${relPath}: env key ${key}`);
    }
  }

  for (const match of source.matchAll(VITE_SERVICE_OR_SECRET)) {
    findings.push(`${relPath}: ${match[0]}`);
  }

  return [...new Set(findings)];
}

function walkFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules") continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkFiles(path));
    else out.push(path);
  }
  return out;
}

function readMigrations(): { name: string; sql: string }[] {
  return readdirSync(migrationsDir)
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .map((name) => ({ name, sql: readFileSync(join(migrationsDir, name), "utf8") }));
}

describe("P0a REVOKE PUBLIC/anon on profiles and watchlist_items", () => {
  it("ships an additive migration that revokes table rights from PUBLIC and anon", () => {
    const migrations = readMigrations();
    const additive = migrations.filter((m) => m.name > baselineMigration);
    assert.ok(
      additive.length > 0,
      "expected an additive migration after 20260905161247 (do not rewrite history)",
    );

    const sql = additive.map((m) => m.sql).join("\n");
    assert.match(sql, /REVOKE ALL ON TABLE public\.profiles FROM PUBLIC,\s*anon;/);
    assert.match(sql, /REVOKE ALL ON TABLE public\.watchlist_items FROM PUBLIC,\s*anon;/);
  });

  it("keeps authenticated owner RLS and does not drop those policies", () => {
    const allSql = readMigrations()
      .map((m) => m.sql)
      .join("\n");
    assert.match(allSql, /CREATE POLICY "profiles_select_own"/);
    assert.match(allSql, /CREATE POLICY "profiles_insert_own"/);
    assert.match(allSql, /CREATE POLICY "profiles_update_own"/);
    assert.match(allSql, /CREATE POLICY "watchlist_manage_own"/);
    assert.match(allSql, /GRANT SELECT, INSERT, UPDATE ON public\.profiles TO authenticated;/);
    assert.match(
      allSql,
      /GRANT SELECT, INSERT, UPDATE, DELETE ON public\.watchlist_items TO authenticated;/,
    );
    assert.doesNotMatch(allSql, /DROP POLICY/i);
    assert.doesNotMatch(allSql, /DISABLE ROW LEVEL SECURITY/i);
  });
});

describe("P0a never ship SERVICE_ROLE / sb_secret to the Vite client", () => {
  it("flags client.server imports and SERVICE_ROLE in client modules", () => {
    const fromServer = findClientSecretPinViolations(
      `import { supabaseAdmin } from "@/integrations/supabase/client.server";`,
      "src/routes/watchlist.tsx",
    );
    assert.ok(fromServer.some((f) => f.includes("client.server")));

    const serviceRole = findClientSecretPinViolations(
      `const k = process.env["SUPABASE_SERVICE_ROLE_KEY"];`,
      "src/integrations/supabase/client.ts",
    );
    assert.ok(serviceRole.some((f) => f.includes("SERVICE_ROLE")));
  });

  it("flags VITE_ wrapping of service/secret keys, including sb_secret env usage", () => {
    const viteWrapped = findClientSecretPinViolations(
      `const k = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;`,
      "src/integrations/supabase/client.ts",
    );
    assert.ok(viteWrapped.length > 0);

    const viteSecret = findClientSecretPinViolations(
      `const k = import.meta.env["VITE_APP_SECRET"];`,
      "src/lib/leaky.ts",
    );
    assert.ok(viteSecret.length > 0);

    const sbSecretEnv = findClientSecretPinViolations(
      `const k = import.meta.env["sb_secret_abc"];`,
      "src/integrations/supabase/client.ts",
    );
    assert.ok(sbSecretEnv.some((f) => f.includes("sb_secret_abc")));
  });

  it("allows publishable Vite env and sb_secret_ prefix detection; allows *.server.ts", () => {
    const clientOk = findClientSecretPinViolations(
      [
        `const url = import.meta.env["VITE_SUPABASE_URL"];`,
        `const key = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"];`,
        `return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");`,
      ].join("\n"),
      "src/integrations/supabase/client.ts",
    );
    assert.deepEqual(clientOk, []);

    const serverOk = findClientSecretPinViolations(
      `const SUPABASE_SERVICE_ROLE_KEY = process.env["SUPABASE_SERVICE_ROLE_KEY"];`,
      "src/integrations/supabase/client.server.ts",
    );
    assert.deepEqual(serverOk, []);
  });

  it("src/ client entry graph does not import client.server or mention SERVICE_ROLE", () => {
    const findings: string[] = [];
    for (const file of walkFiles(srcDir)) {
      const relPath = relative(repoRoot, file).replaceAll("\\", "/");
      const source = readFileSync(file, "utf8");
      findings.push(...findClientSecretPinViolations(source, relPath));
    }
    assert.deepEqual(findings, []);
  });
});
