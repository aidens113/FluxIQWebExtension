import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { AutomationStudioProjectDatabasePool, AutomationStudioProjectGatewayTraceStore } from "fluxiq/automation-studio";
import { ClientGatewayTraceMemoryStore, type ClientGatewayTraceEvent } from "fluxiq/client-gateway";
import { checkProjectTraceParity } from "../index.js";
import { recordFixtureTrace } from "../../trace-inspection/tests/trace-fixtures.js";
import { SESSION_PAYLOAD_MARKER, recordGatewaySession } from "./gateway-session.js";

const PROJECT_ID = "f1d2a3b4-0000-4000-8000-000000000033";

async function storeRoot(t: test.TestContext): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-trace-parity-"));
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

/** Records a live session in memory, then writes it to the project store with its events through `change`. */
async function writeChangedSession(root: string, traceId: string, change: (event: ClientGatewayTraceEvent) => ClientGatewayTraceEvent): Promise<void> {
  const memory = new ClientGatewayTraceMemoryStore();
  const manifest = await recordGatewaySession(memory, traceId);
  await withStore(root, async store => {
    for (const artifact of await memory.listArtifacts(traceId)) {
      const bytes = await memory.readArtifact(traceId, artifact.id);
      if (bytes !== undefined) await store.writeArtifact(traceId, artifact.id, bytes);
    }
    await store.appendEvents(traceId, (await memory.readEventRange(traceId, 1, Number.MAX_SAFE_INTEGER)).map(change));
    await store.writeManifest(manifest);
  });
}

test("a session Core's tap recorded into the project store replays to matched at every delivery point", async t => {
  const root = await storeRoot(t);
  await withStore(root, async store => { await recordGatewaySession(store, "trace.matched"); });
  const parity = await checkProjectTraceParity({ automationDataDir: root, projectId: PROJECT_ID });
  const [trace] = parity.traces;
  assert.ok(trace);
  assert.equal(trace.verdict, "matched", JSON.stringify(trace.groups));
  assert.ok(trace.events >= 8, `events ${trace.events}`);
  assert.deepEqual(trace.deliveryPoints, { compared: trace.events, matched: trace.events, diverged: 0, outside: 0 });
  assert.deepEqual(trace.divergencesByClass, { capture_gap: 0, nondeterminism: 0, intake_defect: 0 });
  assert.equal(trace.failure, null);
  assert.deepEqual({ traces: parity.totals.traces, matched: parity.totals.matched, compared: parity.totals.compared, matchedPoints: parity.totals.matchedPoints }, { traces: 1, matched: 1, compared: trace.events, matchedPoints: trace.events });
  assert.equal(JSON.stringify(parity).includes(SESSION_PAYLOAD_MARKER), false);
});

test("a mutated recorded result is an intake defect at its disposition, named by field, with no payload text", async t => {
  const root = await storeRoot(t);
  await writeChangedSession(root, "trace.mutated", event => {
    if (event.kind !== "inbound" || event.messageType !== "client.action_result" || event.payload.encoding !== "text") return event;
    return { ...event, payload: { encoding: "text", text: event.payload.text.replace(SESSION_PAYLOAD_MARKER, `${SESSION_PAYLOAD_MARKER}-changed`) } };
  });
  const [trace] = (await checkProjectTraceParity({ automationDataDir: root, projectId: PROJECT_ID })).traces;
  assert.equal(trace?.verdict, "diverged");
  const defect = trace?.divergences.find(row => row.class === "intake_defect");
  assert.equal(defect?.kind, "disposition");
  assert.equal(defect?.messageType, "client.action_result");
  assert.ok(defect?.fields.includes("payload.value.delivered.result"), JSON.stringify(defect));
  assert.equal(defect?.reason, "the same input, a different derivation");
  assert.equal(JSON.stringify(trace).includes(SESSION_PAYLOAD_MARKER), false);
});

test("a trace recorded before events named their session, which Core cannot show held one session, is a capture gap, not a defect", async t => {
  const root = await storeRoot(t);
  await withStore(root, async store => { await recordFixtureTrace(store, { traceId: "trace.p2", episodeId: "run.p2", resource: new Uint8Array([1, 2]) }); });
  const [trace] = (await checkProjectTraceParity({ automationDataDir: root, projectId: PROJECT_ID })).traces;
  assert.equal(trace?.verdict, "diverged");
  assert.ok((trace?.divergencesByClass.capture_gap ?? 0) > 0);
  assert.equal(trace?.divergencesByClass.intake_defect, 0, JSON.stringify(trace?.groups));
  // The fixture's envelopes name no session id, so Core refuses to attach one and says why.
  const refused = "the event does not say which session it belongs to, and the trace cannot be shown to hold one session: no outbound envelope or lifecycle record names a session id";
  assert.ok(trace?.groups.some(group => group.class === "capture_gap" && group.reason === refused), JSON.stringify(trace?.groups));
});

test("a harness that throws or never finishes fails that trace with closed text and the next still runs", async t => {
  const root = await storeRoot(t);
  await withStore(root, async store => {
    await recordGatewaySession(store, "trace.a");
    await recordGatewaySession(store, "trace.b");
  });
  let calls = 0;
  const parity = await checkProjectTraceParity({ automationDataDir: root, projectId: PROJECT_ID, deadlineMs: 50 }, {
    replay: async () => {
      calls += 1;
      if (calls === 1) throw new Error(`text quoting ${SESSION_PAYLOAD_MARKER}`);
      return await new Promise(() => undefined);
    },
  });
  assert.deepEqual(parity.traces.map(trace => trace.verdict), ["failed", "failed"]);
  assert.deepEqual(parity.traces.map(trace => trace.failure).sort(), ["the harness threw Error (text withheld)", "the replay did not finish within 50 ms"]);
  assert.equal(parity.totals.failed, 2);
  assert.equal(JSON.stringify(parity).includes(SESSION_PAYLOAD_MARKER), false);
});

test("the filter replays only the traces it selects and counts the rest as skipped", async t => {
  const root = await storeRoot(t);
  await withStore(root, async store => {
    await recordGatewaySession(store, "trace.keep");
    await recordGatewaySession(store, "trace.skip");
  });
  const parity = await checkProjectTraceParity({ automationDataDir: root, projectId: PROJECT_ID, include: manifest => manifest.traceId === "trace.keep" });
  assert.deepEqual(parity.traces.map(trace => trace.traceId), ["trace.keep"]);
  assert.equal(parity.tracesSkipped, 1);
});
