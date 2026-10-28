import assert from "node:assert/strict";
import { it } from "node:test";
import {
  handleContentIngest,
  fetchLiveEpicFreeGames,
  type IngestDeps,
} from "../../../supabase/functions/content-ingest/handler.ts";
const runId = "11111111-1111-4111-8111-111111111111";
const key = "synthetic-test-key";
const request = (body: unknown = { action: "sync_steam_deals" }) =>
  new Request("http://localhost/ingest", {
    method: "POST",
    headers: { authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
  });
function dependencies(overrides: Partial<IngestDeps> = {}): IngestDeps {
  return {
    serviceRoleKey: key,
    claimRun: async () => ({ claimed: true, runId }),
    finalizeRun: async () => true,
    fetchSteamSpecials: async () => [{ id: 1 }, { id: 2 }],
    mapSteamDeal: () => ({ deal: {}, externalId: "steam:app:1" }),
    upsertItem: async () => "row",
    ...overrides,
  };
}
it("rejects request with 503 when serviceRoleKey is missing or blank", async () => {
  const response = await handleContentIngest(request(), dependencies({ serviceRoleKey: "   " }));
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, "service_role_key_missing");
});
it("fails closed when a claim lacks a run ID", async () => {
  let writes = 0;
  const response = await handleContentIngest(
    request(),
    dependencies({
      claimRun: async () => ({ claimed: true }),
      upsertItem: async () => {
        writes++;
        return "row";
      },
    }),
  );
  assert.equal(response.status, 503);
  assert.equal(writes, 0);
});
it("does not report success or retry finalize after terminal persistence failure", async () => {
  let calls = 0;
  const response = await handleContentIngest(
    request(),
    dependencies({
      finalizeRun: async () => {
        calls++;
        return false;
      },
    }),
  );
  assert.equal(response.status, 503);
  assert.equal(calls, 1);
});
it("aborts on plain PostgREST fencing objects and never leaks raw details", async () => {
  let calls = 0;
  const response = await handleContentIngest(
    request(),
    dependencies({
      upsertItem: async () => {
        calls++;
        throw { code: "55000", message: "lease_expired", details: "private upstream details" };
      },
    }),
  );
  assert.equal(response.status, 409);
  assert.equal(calls, 1);
  assert.ok(!(await response.text()).includes("private upstream"));
});
it("rejects queued or cron work before claiming", async () => {
  let calls = 0;
  const deps = dependencies({
    claimRun: async () => {
      calls++;
      return { claimed: true, runId };
    },
  });
  for (const body of [
    { action: "sync_steam_deals", trigger: "cron" },
    { action: "sync_steam_deals", dispatchId: runId },
  ]) {
    assert.equal((await handleContentIngest(request(body), deps)).status, 409);
  }
  assert.equal(calls, 0);
});
it("persists actual partial counts and source total on a database failure", async () => {
  let writes = 0;
  let terminal: unknown;
  const response = await handleContentIngest(
    request(),
    dependencies({
      fetchSteamSpecials: async () => [{ id: 1 }, { id: 2 }, { id: 3 }],
      upsertItem: async () => {
        if (++writes === 2) throw { code: "08006", message: "private failure" };
        return "row";
      },
      finalizeRun: async (_id, status, stats) => {
        terminal = { status, ...stats };
        return true;
      },
    }),
  );
  assert.equal(response.status, 503);
  assert.equal(writes, 2);
  assert.deepEqual(terminal, {
    status: "failed",
    synced: 1,
    dropped: 0,
    total: 3,
    error: "http_status_503",
  });
});
it("preserves partial counters when a mapper throws", async () => {
  let mapped = 0;
  let terminal: unknown;
  const response = await handleContentIngest(
    request(),
    dependencies({
      mapSteamDeal: () => {
        if (++mapped === 2) throw new Error("private mapping failure");
        return { deal: {}, externalId: "steam:app:1" };
      },
      finalizeRun: async (_id, status, stats) => {
        terminal = { status, ...stats };
        return true;
      },
    }),
  );
  assert.equal(response.status, 500);
  assert.deepEqual(terminal, {
    status: "failed",
    synced: 1,
    dropped: 0,
    total: 2,
    error: "http_status_500",
  });
  assert.ok(!(await response.text()).includes("private mapping"));
});
it("never exposes upstream exception details from the releases action", async () => {
  const response = await handleContentIngest(
    request({ action: "sync_steam_releases" }),
    dependencies({
      mapSteamApp: () => null,
      fetchSteamFeatured: async () => {
        throw new Error("private upstream detail");
      },
    }),
  );
  assert.equal(response.status, 502);
  assert.ok(!(await response.text()).includes("private upstream detail"));
});
it("preserves 409 lease_lost even if finalize returns false or throws", async () => {
  let finalized = 0;
  const response = await handleContentIngest(
    request(),
    dependencies({
      fetchSteamSpecials: async () => [{ id: 1 }],
      upsertItem: async () => {
        throw { code: "55000", message: "lease_expired" };
      },
      finalizeRun: async () => {
        finalized++;
        return false;
      },
    }),
  );
  assert.equal(response.status, 409);
  assert.equal(finalized, 1);
  const body = (await response.json()) as { error: string };
  assert.equal(body.error, "lease_lost");
});
it("does not retry a thrown finalization error or expose its details", async () => {
  let calls = 0;
  const response = await handleContentIngest(
    request(),
    dependencies({
      finalizeRun: async () => {
        calls++;
        throw new Error("private finalize failure");
      },
    }),
  );
  assert.equal(response.status, 503);
  assert.equal(calls, 1);
  assert.ok(!(await response.text()).includes("private finalize"));
});
it("bounds streamed upstream bodies without trusting Content-Length", async (t) => {
  t.mock.method(
    globalThis,
    "fetch",
    async () =>
      new Response("x".repeat(1_000_001), { headers: { "content-type": "application/json" } }),
  );
  await assert.rejects(fetchLiveEpicFreeGames(), /upstream_body_too_large/);
});
it("passes a deadline signal and rejects redirects or wrong content types", async (t) => {
  t.mock.method(globalThis, "fetch", async (_url: unknown, options?: RequestInit) => {
    assert.equal(options?.redirect, "error");
    assert.ok(options?.signal instanceof AbortSignal);
    return new Response("not json", { headers: { "content-type": "text/html" } });
  });
  await assert.rejects(fetchLiveEpicFreeGames(), /schema/);
});
it("rejects HTTP 200 with malformed Epic envelope instead of reporting empty success", async (t) => {
  t.mock.method(
    globalThis,
    "fetch",
    async () => new Response('{"data":{}}', { headers: { "content-type": "application/json" } }),
  );
  await assert.rejects(fetchLiveEpicFreeGames(), /schema/);
});
