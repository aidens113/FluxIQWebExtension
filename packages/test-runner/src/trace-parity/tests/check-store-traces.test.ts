import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { AutomationStudioProjectDatabasePool, AutomationStudioProjectGatewayTraceStore } from "fluxiq/automation-studio";
import { ClientGatewayTraceMemoryStore, type ClientGatewayTraceEvent, type ClientGatewayTraceJsonValue } from "fluxiq/client-gateway";
import { checkStoreTraces, listStoreProjects } from "../index.js";
import { SESSION_PAYLOAD_MARKER, recordGatewaySession } from "./gateway-session.js";

const PROJECT_ID = "f1d2a3b4-0000-4000-8000-000000000044";

async function storeRoot(t: test.TestContext): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-store-traces-"));
  t.after(() => rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }));
  return root;
}

async function withStore(root: string, work: (store: AutomationStudioProjectGatewayTraceStore) => Promise<void>): Promise<void> {
  const pool = new AutomationStudioProjectDatabasePool({ rootDir: root });
  const store = await AutomationStudioProjectGatewayTraceStore.open({ pool, projectId: PROJECT_ID });
  try {
    await work(store);
  } finally {
    await store.close();
    await pool.closeAll();
  }
}

/** Records a live session in memory, then writes it to the project store with each event passed through `change`. */
async function writeChangedSession(root: string, traceId: string, change: (event: ClientGatewayTraceEvent, index: number) => ClientGatewayTraceEvent): Promise<number> {
  const memory = new ClientGatewayTraceMemoryStore();
  const manifest = await recordGatewaySession(memory, traceId);
  const events = await memory.readEventRange(traceId, 1, Number.MAX_SAFE_INTEGER);
  await withStore(root, async store => {
    for (const artifact of await memory.listArtifacts(traceId)) {
      const bytes = await memory.readArtifact(traceId, artifact.id);
      if (bytes !== undefined) await store.writeArtifact(traceId, artifact.id, bytes);
    }
    await store.appendEvents(traceId, events.map(change));
    await store.writeManifest(manifest);
  });
  return events.length;
}

/** The event as a capture before events named their session would have stored it. */
function withoutSession(event: ClientGatewayTraceEvent): ClientGatewayTraceEvent {
  const { session: _session, ...rest } = event;
  return rest;
}

/** A disposition as the tap wrote it before delivered digests (schema version 1). */
function asOlderDisposition(event: ClientGatewayTraceEvent): ClientGatewayTraceEvent {
  if (event.kind !== "disposition" || event.payload.encoding !== "json" || event.payloadSchema === null) return event;
  const { delivered: _delivered, ...value } = event.payload.value as { readonly [key: string]: ClientGatewayTraceJsonValue };
  return { ...event, payloadSchema: { ...event.payloadSchema, version: "1" }, payload: { encoding: "json", value } };
}

const ONLY_SESSION = "session reference of a legacy single-session trace";
const OLDER_DISPOSITION_REASON = "the disposition was recorded under schema version 1, which does not record what Core delivered for the message; every field it records matched";

test("a trace whose events name no session is replayed by Core's harness with its one session attached, declared, and matches", async t => {
  const root = await storeRoot(t);
  const events = await writeChangedSession(root, "trace.older", withoutSession);
  const check = await checkStoreTraces({ automationDataDir: root, tailLength: 4 });
  const [trace] = check.projects[0]?.traces ?? [];
  assert.ok(trace);
  assert.equal(check.projects[0]?.projectId, PROJECT_ID);
  assert.equal(trace.sessionReferences, "single_session");
  assert.equal(trace.recorded.verdict, "matched", JSON.stringify(trace.recorded.groups));
  assert.equal(trace.recorded.deliveryPoints.matched, events);
  assert.ok(trace.recorded.normalizations.includes(ONLY_SESSION), JSON.stringify(trace.recorded.normalizations));
  assert.equal(trace.olderDispositionSchemaOnly, 0);
  assert.deepEqual(trace.tail.rows.map(row => row.sequence), [events - 3, events - 2, events - 1, events]);
  assert.ok(trace.tail.rows.every(row => row.parity === "matched"));
  assert.equal(JSON.stringify(check).includes(SESSION_PAYLOAD_MARKER), false);
});

test("older dispositions (schema 1, no delivered digests) are capture gaps Core names, one per disposition, and are counted as such", async t => {
  const root = await storeRoot(t);
  await writeChangedSession(root, "trace.older-dispositions", event => asOlderDisposition(withoutSession(event)));
  const [trace] = (await checkStoreTraces({ automationDataDir: root })).projects[0]?.traces ?? [];
  assert.ok(trace);
  const dispositions = trace.tail.rows.filter(row => row.kind === "disposition").length;
  assert.ok(dispositions > 0);
  assert.equal(trace.recorded.verdict, "diverged");
  assert.deepEqual(trace.recorded.divergencesByClass, { capture_gap: dispositions, nondeterminism: 0, intake_defect: 0 });
  assert.deepEqual([...new Set(trace.recorded.groups.map(group => JSON.stringify([group.kind, group.fields, group.reason])))], [JSON.stringify(["disposition", ["payload.value.delivered"], OLDER_DISPOSITION_REASON])]);
  assert.equal(trace.olderDispositionSchemaOnly, dispositions);
  assert.equal(trace.recorded.deliveryPoints.matched, trace.events - dispositions);
});

test("a trace that names its sessions is checked as recorded", async t => {
  const root = await storeRoot(t);
  await withStore(root, async store => { await recordGatewaySession(store, "trace.current"); });
  const [trace] = (await checkStoreTraces({ automationDataDir: root })).projects[0]?.traces ?? [];
  assert.equal(trace?.sessionReferences, "recorded");
  assert.equal(trace?.recorded.verdict, "matched");
  assert.equal(trace?.recorded.normalizations.includes(ONLY_SESSION), false);
});

test("a legacy trace naming two sessions is refused by Core: capture gaps whose reason says why, and no intake defect", async t => {
  const root = await storeRoot(t);
  let outbound = 0;
  await writeChangedSession(root, "trace.two-sessions", event => {
    const stripped = withoutSession(event);
    if (stripped.kind !== "outbound" || stripped.payload.encoding !== "json" || (outbound += 1) !== 2) return stripped;
    return { ...stripped, payload: { encoding: "json", value: { ...(stripped.payload.value as { readonly [key: string]: ClientGatewayTraceJsonValue }), sessionId: "session.other" } } };
  });
  const [trace] = (await checkStoreTraces({ automationDataDir: root })).projects[0]?.traces ?? [];
  assert.ok(trace);
  assert.equal(trace.sessionReferences, "refused");
  assert.equal(trace.recorded.verdict, "diverged");
  assert.equal(trace.recorded.deliveryPoints.matched, 0);
  assert.deepEqual(trace.recorded.divergencesByClass, { capture_gap: trace.recorded.divergencesByClass.capture_gap, nondeterminism: 0, intake_defect: 0 });
  assert.deepEqual([...new Set(trace.recorded.groups.map(group => group.reason))], [
    "the event does not say which session it belongs to, and the trace cannot be shown to hold one session: its outbound envelopes and lifecycle records name more than one session id",
  ]);
});

test("the projects of a storage root are the directories holding a project database", async t => {
  const root = await storeRoot(t);
  assert.deepEqual(await listStoreProjects(root), []);
  await withStore(root, async store => { await recordGatewaySession(store, "trace.listed"); });
  await mkdir(path.join(root, "projects", "not-a-project"), { recursive: true });
  assert.deepEqual(await listStoreProjects(root), [PROJECT_ID]);
});
