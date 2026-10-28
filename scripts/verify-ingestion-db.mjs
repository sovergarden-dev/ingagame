import assert from "node:assert/strict";
import { readFile, readdir, mkdtemp } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { randomBytes } from "node:crypto";
import { createServer } from "node:net";

const tools = process.env.INGA_TEST_TOOLS;
const scratch = process.env.INGA_TEST_SCRATCH;
if (!tools || !scratch)
  throw new Error("Set INGA_TEST_TOOLS and INGA_TEST_SCRATCH to isolated local directories");
const { execFileSync } = await import("node:child_process");
const { writeFile, rm } = await import("node:fs/promises");
const { default: pgModule } = await import(
  pathToFileURL(join(tools, "node_modules/pg/esm/index.mjs")).href
);
const server = createServer();
await new Promise((ready, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", ready);
});
const port = server.address().port;
await new Promise((done) => server.close(done));
const directory = await mkdtemp(join(scratch, "inga-pg-"));
const password = randomBytes(32).toString("hex");
const passwordPath = join(directory, "local-test-password");
const dataDir = join(directory, "data");
const native = join(
  tools,
  `node_modules/@embedded-postgres/${process.platform === "win32" ? "windows" : "linux"}-x64/native/bin`,
);
const exe = process.platform === "win32" ? ".exe" : "";
let started = false;
const pg = {
  async initialise() {
    await writeFile(passwordPath, password, { mode: 0o600 });
    try {
      execFileSync(
        join(native, `initdb${exe}`),
        [
          "-D",
          dataDir,
          "-U",
          "postgres",
          "--auth=scram-sha-256",
          `--pwfile=${passwordPath}`,
          "--encoding=UTF8",
          "--locale=C",
        ],
        { stdio: "pipe" },
      );
    } finally {
      await rm(passwordPath, { force: true });
    }
  },
  async start() {
    execFileSync(
      join(native, `pg_ctl${exe}`),
      [
        "start",
        "-D",
        dataDir,
        "-w",
        "-l",
        join(directory, "postgres.log"),
        "-o",
        `-p ${port} -h 127.0.0.1 -c statement_timeout=10000`,
      ],
      { stdio: "ignore", timeout: 15000 },
    );
    started = true;
  },
  getPgClient() {
    return new pgModule.Client({
      host: "127.0.0.1",
      port,
      user: "postgres",
      password,
      database: "postgres",
    });
  },
  async stop() {
    if (started)
      execFileSync(join(native, `pg_ctl${exe}`), ["stop", "-D", dataDir, "-m", "fast", "-w"], {
        stdio: "pipe",
      });
    await rm(directory, { recursive: true, force: true });
  },
};
const clients = [];
const outcomes = [];
async function connect() {
  const c = pg.getPgClient();
  await c.connect();
  clients.push(c);
  return c;
}
async function test(name, run) {
  try {
    await run();
    outcomes.push({ name, passed: true });
    console.log("PASS", name);
  } catch (error) {
    outcomes.push({ name, passed: false, message: error.message });
    console.error("FAIL", name, error.message);
  }
}
try {
  await pg.initialise();
  await pg.start();
  const db = await connect();
  console.log((await db.query("select version() as version")).rows[0].version);
  await db.query(
    "CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role NOLOGIN BYPASSRLS;",
  );
  const migrations = resolve("supabase/migrations");
  let appliedMigrations = 0;
  const names = (await readdir(migrations))
    .filter(
      (x) =>
        x.endsWith(".sql") &&
        (x.startsWith("20260907003000") ||
          x.startsWith("20261017") ||
          x.startsWith("20261018") ||
          x.startsWith("20261025")),
    )
    .sort();
  for (const name of names) {
    if (process.env.INGA_BASELINE === "1" && name.startsWith("20261025")) continue;
    if (name.startsWith("20261025") && process.env.INGA_UPGRADE === "1") {
      await db.query(
        "INSERT INTO public.content_items(kind,external_id,published_at,payload,offer_state) VALUES('deals','epic:namespace:upgrade:offer:old',now(),'{\"id\":\"preserved\"}','active'),('news','news:unrelated',now(),'{\"id\":\"unrelated\"}','active')",
      );
      await db.query(
        "INSERT INTO public.ingestion_runs(action,trigger,status,finished_at) VALUES('sync_steam_deals','manual','completed',now())",
      );
      await db.query(
        "CREATE SCHEMA cron; CREATE TABLE cron.job(jobid bigint,jobname text,command text); INSERT INTO cron.job VALUES(1,'inga-canary-sync-steam-deals','SELECT private.dispatch_ingestion_action(...)'),(2,'unrelated-maintenance','VACUUM ANALYZE'),(3,'inga-collect-pg-net-dispatches','SELECT private.collect_pg_net_dispatch_outcomes()'),(4,'shadow-dispatch','SELECT private.dispatch_ingestion_action(''sync_steam_deals'')')",
      );
      await db.query(
        "CREATE FUNCTION cron.unschedule(bigint) RETURNS boolean LANGUAGE sql AS $$ WITH removed AS (DELETE FROM cron.job WHERE jobid=$1 RETURNING 1) SELECT EXISTS(SELECT 1 FROM removed) $$",
      );
    }
    await db.query(await readFile(join(migrations, name), "utf8"));
    appliedMigrations++;
  }
  const claim = async (c = db, action = "sync_steam_deals") =>
    (await c.query("SELECT * FROM public.claim_ingestion_run($1,'manual',30)", [action])).rows[0];
  const enable = async () =>
    db.query(
      "UPDATE public.ingestion_config SET is_enabled=true,cooldown_seconds=0,next_allowed_at=null WHERE action='sync_steam_deals'; UPDATE public.ingestion_leases SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE action='sync_steam_deals'",
    );
  const write = (c, id, key = "steam:app:42:market:us:currency:USD") =>
    c.query(
      "SELECT public.upsert_content_item($1,'deals',$2,clock_timestamp(),'{\"id\":\"test\"}'::jsonb)",
      [id, key],
    );
  await test("migration leaves every configured action disabled", async () => {
    assert.equal(
      (await db.query("SELECT count(*)::int AS n FROM public.ingestion_config WHERE is_enabled"))
        .rows[0].n,
      0,
    );
  });
  if (process.env.INGA_UPGRADE === "1")
    await test("populated upgrade preserves history and unrelated jobs", async () => {
      const old = (
        await db.query(
          "SELECT payload,offer_state FROM public.content_items WHERE external_id='epic:namespace:upgrade:offer:old'",
        )
      ).rows[0];
      assert.equal(old.payload.id, "preserved");
      assert.equal(old.offer_state, "archived");
      assert.equal(
        (
          await db.query(
            "SELECT payload->>'id' AS id FROM public.content_items WHERE external_id='news:unrelated'",
          )
        ).rows[0].id,
        "unrelated",
      );
      assert.equal(
        (
          await db.query(
            "SELECT count(*)::int AS n FROM public.ingestion_runs WHERE status='completed'",
          )
        ).rows[0].n,
        1,
      );
      assert.deepEqual((await db.query("SELECT jobname FROM cron.job")).rows, [
        { jobname: "unrelated-maintenance" },
      ]);
    });
  await test("legacy unleased overload is absent", async () => {
    assert.equal(
      (
        await db.query(
          "SELECT to_regprocedure('public.upsert_content_item(text,text,timestamptz,jsonb)') AS signature",
        )
      ).rows[0].signature,
      null,
    );
  });
  await test("unknown action is not auto-provisioned", async () => {
    const result = await claim(db, "unexpected_action");
    assert.equal(result.claimed, false);
    assert.equal(
      (
        await db.query(
          "SELECT count(*)::int AS n FROM public.ingestion_config WHERE action='unexpected_action'",
        )
      ).rows[0].n,
      0,
    );
  });
  await test("scheduled invocations are blocked", async () => {
    await enable();
    const result = (
      await db.query("SELECT * FROM public.claim_ingestion_run('sync_steam_deals','cron',30)")
    ).rows[0];
    assert.equal(result.claimed, false);
  });
  await test("scheduler wrapper never enqueues while rollout is blocked", async () => {
    await assert.rejects(
      db.query("SELECT private.dispatch_ingestion_action('sync_steam_deals')"),
      /scheduler_not_ready/,
    );
  });
  await test("valid owner writes and terminal owner cannot write", async () => {
    await enable();
    const owner = await claim();
    assert.equal(owner.claimed, true);
    await write(db, owner.run_id);
    assert.equal(
      (
        await db.query("SELECT public.finalize_ingestion_run($1,'completed',1,0,1) AS ok", [
          owner.run_id,
        ])
      ).rows[0].ok,
      true,
    );
    await assert.rejects(write(db, owner.run_id), /lease_/);
  });
  await test("twenty concurrent claims produce one owner", async () => {
    await enable();
    const sessions = await Promise.all(Array.from({ length: 20 }, () => connect()));
    const results = await Promise.all(sessions.map((c) => claim(c)));
    assert.equal(results.filter((r) => r.claimed).length, 1);
  });
  await test("expired owner waiting on a lock is denied after the wait", async () => {
    await enable();
    const a = await claim();
    await db.query(
      "UPDATE public.ingestion_leases SET lease_expires_at=clock_timestamp()+interval '500 milliseconds' WHERE active_run_id=$1",
      [a.run_id],
    );
    const blocker = await connect();
    const writer = await connect();
    await blocker.query(
      "BEGIN; SELECT 1 FROM public.ingestion_leases WHERE action='sync_steam_deals' FOR UPDATE",
    );
    const pending = write(writer, a.run_id, "steam:app:wait").then(
      () => ({ ok: true }),
      (e) => ({ ok: false, message: e.message }),
    );
    try {
      const deadline = Date.now() + 3000;
      while (true) {
        const waiting = await db.query(
          "SELECT count(*)::int AS n FROM pg_stat_activity WHERE wait_event_type='Lock' AND query LIKE 'SELECT public.upsert_content_item%'",
        );
        if (waiting.rows[0].n > 0) break;
        if (Date.now() > deadline) throw new Error("writer did not reach lock barrier");
        await new Promise((done) => setTimeout(done, 10));
      }
      await db.query("SELECT pg_sleep(0.8)");
    } finally {
      await blocker.query("COMMIT");
    }
    const result = await pending;
    assert.equal(result.ok, false);
    assert.equal(
      (
        await db.query(
          "SELECT count(*)::int AS n FROM public.content_items WHERE external_id='steam:app:wait'",
        )
      ).rows[0].n,
      0,
    );
  });
  await test("reclaim and finalization serialize on the config lock without deadlock", async () => {
    await enable();
    const old = await claim();
    await enable();
    const blocker = await connect();
    const finalizer = await connect();
    const reclaimer = await connect();
    await blocker.query(
      "BEGIN; SELECT 1 FROM public.ingestion_config WHERE action='sync_steam_deals' FOR UPDATE",
    );
    const first = finalizer
      .query("SELECT public.finalize_ingestion_run($1,'completed',0,0,0)", [old.run_id])
      .then(
        () => true,
        () => false,
      );
    const second = claim(reclaimer).then(
      (r) => r,
      () => null,
    );
    try {
      const deadline = Date.now() + 3000;
      while (true) {
        const waiting = (
          await db.query(
            "SELECT count(*)::int AS n FROM pg_stat_activity WHERE pid=ANY($1::int[]) AND wait_event_type='Lock'",
            [[finalizer.processID, reclaimer.processID]],
          )
        ).rows[0].n;
        if (waiting === 2) break;
        if (Date.now() > deadline)
          throw new Error("both operations did not reach the lock barrier");
        await new Promise((r) => setTimeout(r, 10));
      }
    } finally {
      await blocker.query("COMMIT");
    }
    assert.equal(await first, true);
    const next = await second;
    assert.equal(next?.claimed, true);
    assert.equal(
      (
        await db.query(
          "SELECT active_run_id FROM public.ingestion_leases WHERE action='sync_steam_deals'",
        )
      ).rows[0].active_run_id,
      next.run_id,
    );
  });
  await test("content-row lock wait also rechecks expiry before mutation", async () => {
    await enable();
    const owner = await claim();
    await write(db, owner.run_id, "steam:app:content-barrier");
    const blocker = await connect();
    const writer = await connect();
    await db.query(
      "UPDATE public.ingestion_leases SET lease_expires_at=clock_timestamp()+interval '500 milliseconds' WHERE active_run_id=$1",
      [owner.run_id],
    );
    await blocker.query(
      "BEGIN; SELECT 1 FROM public.content_items WHERE external_id='steam:app:content-barrier' FOR UPDATE",
    );
    const pending = write(writer, owner.run_id, "steam:app:content-barrier").then(
      () => true,
      () => false,
    );
    try {
      const deadline = Date.now() + 3000;
      while (
        (
          await db.query("SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1", [
            writer.processID,
          ])
        ).rows[0]?.wait_event_type !== "Lock"
      ) {
        if (Date.now() > deadline) throw new Error("content writer did not reach lock barrier");
        await new Promise((r) => setTimeout(r, 10));
      }
      await db.query("SELECT pg_sleep(0.8)");
    } finally {
      await blocker.query("COMMIT");
    }
    assert.equal(await pending, false);
  });
  await test("old finalizer cannot release a replacement owner", async () => {
    await enable();
    const a = await claim();
    await enable();
    const b = await claim();
    await db.query("SELECT public.finalize_ingestion_run($1,'completed',0,0,0)", [a.run_id]);
    assert.equal(
      (
        await db.query(
          "SELECT active_run_id FROM public.ingestion_leases WHERE action='sync_steam_deals'",
        )
      ).rows[0].active_run_id,
      b.run_id,
    );
  });
  await test("anon cannot call the fenced writer", async () => {
    await db.query("SET ROLE anon");
    try {
      await assert.rejects(write(db, "00000000-0000-0000-0000-000000000001"), /permission denied/);
    } finally {
      await db.query("RESET ROLE");
    }
  });
  await test("service role cannot mutate audit or fencing tables directly", async () => {
    for (const table of [
      "content_items",
      "ingestion_config",
      "ingestion_leases",
      "ingestion_runs",
      "ingestion_dispatches",
    ]) {
      const rights = (
        await db.query(
          "SELECT has_table_privilege('service_role',$1,'INSERT,UPDATE,DELETE,TRUNCATE,TRIGGER,REFERENCES') AS writable",
          [`public.${table}`],
        )
      ).rows[0];
      assert.equal(rights.writable, false, table);
    }
  });
  await test("service role can claim, write and finalize only through fenced RPCs", async () => {
    await enable();
    await db.query("SET ROLE service_role");
    try {
      const owner = await claim();
      assert.equal(owner.claimed, true);
      await write(db, owner.run_id, "steam:app:service-role");
      assert.equal(
        (
          await db.query("SELECT public.finalize_ingestion_run($1,'completed',1,0,1) AS ok", [
            owner.run_id,
          ])
        ).rows[0].ok,
        true,
      );
    } finally {
      await db.query("RESET ROLE");
    }
  });
  await test("kill switch denies further writes from the current owner", async () => {
    await enable();
    const a = await claim();
    await db.query(
      "UPDATE public.ingestion_config SET is_enabled=false WHERE action='sync_steam_deals'",
    );
    await assert.rejects(write(db, a.run_id), /action_disabled/);
  });
  await test("provider ownership cannot write another provider's namespace", async () => {
    await enable();
    const a = await claim();
    await assert.rejects(write(db, a.run_id, "epic:v2:foreign"), /action_kind_mismatch/);
  });
  await test("finalize rejects invalid counters and preserves terminal outcomes", async () => {
    await enable();
    const a = await claim();
    await assert.rejects(
      db.query("SELECT public.finalize_ingestion_run($1,'completed',-1,0,0)", [a.run_id]),
      /invalid_finalize/,
    );
    await db.query("SELECT public.finalize_ingestion_run($1,'completed',0,0,0)", [a.run_id]);
    assert.equal(
      (await db.query("SELECT public.finalize_ingestion_run($1,'failed',0,0,0) AS ok", [a.run_id]))
        .rows[0].ok,
      false,
    );
    assert.equal(
      (await db.query("SELECT status FROM public.ingestion_runs WHERE id=$1", [a.run_id])).rows[0]
        .status,
      "completed",
    );
  });
  await test("collector records a late timeout without downgrading execution", async () => {
    await db.query(
      "CREATE SCHEMA net; CREATE TABLE net._http_response(id bigint,status_code integer,timed_out boolean,error_msg text,created timestamptz DEFAULT now())",
    );
    const dispatch = (
      await db.query(
        "INSERT INTO public.ingestion_dispatches(action,scheduled_for,pg_net_request_id,response_at,execution_outcome) VALUES('sync_steam_deals',now(),999,now(),'completed') RETURNING id",
      )
    ).rows[0];
    await db.query(
      "INSERT INTO net._http_response(id,timed_out,error_msg) VALUES(999,true,'private data that must not be copied')",
    );
    await db.query("SELECT private.collect_pg_net_dispatch_outcomes()");
    const observation = (
      await db.query("SELECT * FROM public.ingestion_dispatches WHERE id=$1", [dispatch.id])
    ).rows[0];
    assert.equal(observation.execution_outcome, "completed");
    assert.equal(observation.transport_error_code, "transport_timeout");
    assert.ok(observation.transport_collected_at);
    assert.equal(
      (await db.query("SELECT private.collect_pg_net_dispatch_outcomes() AS n")).rows[0].n,
      0,
    );
  });
  if (process.env.INGA_EPIC_CAPTURE)
    await test("manual Epic smoke commits only validated captured upstream data", async () => {
      const { handleContentIngest } = await import(
        pathToFileURL(resolve("supabase/functions/content-ingest/handler.ts")).href
      );
      const { mapEpicFreeGameToDeal } = await import(
        pathToFileURL(resolve("src/integrations/content/epic-free-games-mapper.ts")).href
      );
      const source = JSON.parse(await readFile(process.env.INGA_EPIC_CAPTURE, "utf8"));
      const elements = source.data.Catalog.searchStore.elements;
      const observed = new Date();
      const expected = elements
        .map((x) => mapEpicFreeGameToDeal(x, "us", observed))
        .filter(Boolean);
      assert.ok(
        expected.length > 0,
        "live snapshot contains no accepted promotions; do not invent data",
      );
      await db.query(
        "UPDATE public.ingestion_config SET is_enabled=true,cooldown_seconds=0,next_allowed_at=null WHERE action='sync_epic_free_games'",
      );
      const syntheticKey = randomBytes(24).toString("hex");
      const response = await handleContentIngest(
        new Request("http://localhost/ingest", {
          method: "POST",
          headers: { authorization: `Bearer ${syntheticKey}` },
          body: JSON.stringify({ action: "sync_epic_free_games" }),
        }),
        {
          serviceRoleKey: syntheticKey,
          now: () => observed,
          claimRun: async (action) =>
            (
              await db.query("SELECT * FROM public.claim_ingestion_run($1,'manual',300)", [action])
            ).rows.map((r) => ({ claimed: r.claimed, runId: r.run_id, reason: r.reason }))[0],
          finalizeRun: async (id, status, stats) =>
            (
              await db.query("SELECT public.finalize_ingestion_run($1,$2,$3,$4,$5,$6) AS ok", [
                id,
                status,
                stats.synced,
                stats.dropped,
                stats.total,
                stats.error ?? null,
              ])
            ).rows[0].ok,
          fetchEpicFreeGames: async () => elements,
          mapEpicDeal: (value, now) => mapEpicFreeGameToDeal(value, "us", now),
          upsertItem: async (...args) =>
            (
              await db.query(
                "SELECT public.upsert_content_item($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) AS id",
                args,
              )
            ).rows[0].id,
        },
      );
      const result = await response.json();
      assert.equal(response.status, 200);
      assert.equal(result.synced, expected.length);
      const rows = (
        await db.query(
          "SELECT payload FROM public.content_items WHERE external_id LIKE 'epic:v2:%'",
        )
      ).rows;
      assert.equal(rows.length, expected.length);
      console.log(
        JSON.stringify({
          smoke: "captured-upstream-to-isolated-postgres",
          sourceItems: elements.length,
          accepted: expected.length,
          rejected: elements.length - expected.length,
          titles: rows.map((r) => r.payload.gameSummary.title),
          runStatus: (
            await db.query("SELECT status FROM public.ingestion_runs WHERE id=$1", [result.runId])
          ).rows[0].status,
        }),
      );
    });
  console.log(
    JSON.stringify(
      {
        migrationCount: appliedMigrations,
        skipped: process.env.INGA_EPIC_CAPTURE
          ? []
          : ["captured upstream smoke: INGA_EPIC_CAPTURE unset"],
        tests: outcomes.length,
        passed: outcomes.filter((x) => x.passed).length,
        outcomes,
      },
      null,
      2,
    ),
  );
  if (outcomes.some((x) => !x.passed)) process.exitCode = 1;
} finally {
  await Promise.all(clients.map((c) => c.end().catch(() => {})));
  await pg.stop();
}
