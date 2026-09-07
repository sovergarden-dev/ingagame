import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, it } from "node:test";

const repoRoot = join(import.meta.dirname, "../../..");
const srcDir = join(repoRoot, "src");

const STEAM_SECRET =
  /\b(?:STEAM_API_KEY|STEAM_WEB_API_KEY|STEAM_CLIENT_SECRET|VITE_STEAM_SECRET|VITE_STEAM_API_KEY|VITE_STEAM_CLIENT_SECRET)\b/;

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

describe("P0c never ship Steam API keys / OAuth secrets to the Vite client", () => {
  it("src/ client modules do not mention Steam API keys or OAuth client secrets", () => {
    const findings: string[] = [];
    for (const file of walkFiles(srcDir)) {
      const relPath = relative(repoRoot, file).replaceAll("\\", "/");
      if (!isScannedClientPath(relPath)) continue;
      const source = readFileSync(file, "utf8");
      const match = source.match(STEAM_SECRET);
      if (match) findings.push(`${relPath}: ${match[0]}`);
    }
    assert.deepEqual(findings, []);
  });

  it("does not wrap Steam secrets in VITE_STEAM_* client env", () => {
    const findings: string[] = [];
    for (const file of walkFiles(srcDir)) {
      const relPath = relative(repoRoot, file).replaceAll("\\", "/");
      if (!isScannedClientPath(relPath)) continue;
      const source = readFileSync(file, "utf8");
      if (/VITE_STEAM_(?:SECRET|API_KEY|CLIENT_SECRET|WEB_API_KEY)/.test(source)) {
        findings.push(relPath);
      }
    }
    assert.deepEqual(findings, []);
  });
});
