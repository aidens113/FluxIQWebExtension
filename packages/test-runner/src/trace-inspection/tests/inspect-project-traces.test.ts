import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { AutomationStudioProjectDatabasePool, AutomationStudioProjectGatewayTraceStore } from "fluxiq/automation-studio";
import { inspectProjectTraces } from "../index.js";
import { FIXTURE_TOKEN, recordFixtureTrace } from "./trace-fixtures.js";

const PROJECT_ID = "f1d2a3b4-0000-4000-8000-000000000001";

async function storeRoot(t: test.TestContext): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-trace-inspection-"));
  t.after(() => rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }));
  return root;
}

/** Writes traces through Core's own project store, as the gateway's recorder does live. */
async function writeTraces(root: string, traces: readonly { traceId: string; episodeId: string; resource: Uint8Array; leak?: boolean; startMs?: number }[]): Promise<void> {
  const pool = new AutomationStudioProjectDatabasePool({ rootDir: root });
  const store = await AutomationStudioProjectGatewayTraceStore.open({ pool, projectId: PROJECT_ID });
  try {
    for (const trace of traces) {
      let now = trace.startMs ?? Date.parse("2026-10-20T00:00:00.000Z");
      await recordFixtureTrace(store, { ...trace, clock: () => (now += 5) });
    }
  } finally {
    await store.close();
    await pool.closeAll();
  }
}

test("reads every trace back through the store, complete, with artifacts deduplicated across traces", async t => {
  const root = await storeRoot(t);
  const shared = new Uint8Array([3, 1, 4, 1, 5]);
  await writeTraces(root, [{ traceId: "trace-one", episodeId: "run-one", resource: shared }, { traceId: "trace-two", episodeId: "run-one", resource: shared }]);
  const inspection = await inspectProjectTraces({ automationDataDir: root, projectId: PROJECT_ID, secrets: [FIXTURE_TOKEN] });
  assert.equal(inspection.traces.length, 2);
  assert.deepEqual(inspection.traces.map(trace => trace.completeness.status), ["complete", "complete"]);
  assert.deepEqual(inspection.traces.map(trace => trace.artifacts.held), [2, 2]);
  assert.deepEqual({ references: inspection.dedupe.references, distinct: inspection.dedupe.distinct }, { references: 4, distinct: 2 });
  assert.deepEqual(inspection.secretScan, { secretsChecked: 1, eventsScanned: 10, artifactsScanned: 4, eventHits: 0, artifactHits: 0 });
  assert.equal(inspection.tracesSkipped, 0);
});

test("the secret search counts a stored event that holds a secret in clear, and never returns it", async t => {
  const root = await storeRoot(t);
  await writeTraces(root, [{ traceId: "trace-leak", episodeId: "run-leak", resource: new Uint8Array([8]), leak: true }]);
  const inspection = await inspectProjectTraces({ automationDataDir: root, projectId: PROJECT_ID, secrets: [FIXTURE_TOKEN] });
  assert.equal(inspection.secretScan.eventHits, 1);
  assert.equal(JSON.stringify(inspection).includes(FIXTURE_TOKEN), false);
});

test("the filter reads only the traces it selects and counts the rest as skipped", async t => {
  const root = await storeRoot(t);
  await writeTraces(root, [
    { traceId: "trace-earlier", episodeId: "run-earlier", resource: new Uint8Array([1]), startMs: Date.parse("2026-10-19T00:00:00.000Z") },
    { traceId: "trace-later", episodeId: "run-later", resource: new Uint8Array([2]), startMs: Date.parse("2026-10-20T12:00:00.000Z") },
  ]);
  const inspection = await inspectProjectTraces({ automationDataDir: root, projectId: PROJECT_ID, include: manifest => manifest.startedAt >= "2026-10-20T00:00:00.000Z" });
  assert.deepEqual(inspection.traces.map(trace => trace.episodeId), ["run-later"]);
  assert.equal(inspection.tracesSkipped, 1);
  assert.equal(inspection.secretScan.eventsScanned, 0);
});

test("a project that never traced reads as no traces", async t => {
  const root = await storeRoot(t);
  const inspection = await inspectProjectTraces({ automationDataDir: root, projectId: PROJECT_ID, secrets: [FIXTURE_TOKEN] });
  assert.deepEqual({ traces: inspection.traces.length, skipped: inspection.tracesSkipped, references: inspection.dedupe.references }, { traces: 0, skipped: 0, references: 0 });
});
