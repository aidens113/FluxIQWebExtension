import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { AutomationStudioProjectDatabasePool, AutomationStudioProjectGatewayTraceStore } from "fluxiq/automation-studio";
import { ClientGatewayTraceRecorder } from "fluxiq/client-gateway";
import { inspectProjectTraces } from "../index.js";
import { recordFixtureTrace } from "./trace-fixtures.js";

const PROJECT_ID = "f1d2a3b4-0000-4000-8000-000000000002";
const source = { id: null, sequence: null, timestamp: null };
const correlation = { commandId: null, recordingId: null, causationEventId: null, owner: null, observationRevision: null, baseRevision: null };

async function storeRoot(t: test.TestContext): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-trace-stored-bytes-"));
  t.after(() => rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }));
  return root;
}

/** About 48 KB of words from a seeded generator: well above the store's 16 KiB inline limit. */
function largeView(seed: number): string {
  let state = seed;
  const words: string[] = [];
  while (words.join(" ").length < 48_000) {
    state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
    words.push(`w${state.toString(36)}`);
  }
  return words.join(" ");
}

/** A trace of two state updates, both carrying the same large view. */
async function recordLargeTrace(store: AutomationStudioProjectGatewayTraceStore, traceId: string, view: string): Promise<void> {
  let now = Date.parse("2026-10-20T00:00:00.000Z");
  const recorder = new ClientGatewayTraceRecorder(
    { traceId, episodeId: `run-${traceId}`, activity: "execution", origin: { kind: "live" }, contractVersions: {}, capabilities: null, context: { schema: { name: "fixture", version: "1" }, value: null }, streams: ["gateway"] },
    { store, now: () => (now += 5), maxBufferedEvents: 100, maxBufferedArtifactBytes: 1_000_000 },
  );
  for (let index = 0; index < 2; index += 1) {
    recorder.record({ stream: "gateway", kind: "inbound", messageType: "client.state_update", source, correlation, payloadSchema: null, payload: { encoding: "text", text: view }, artifactIds: [], redactions: [] });
  }
  await recorder.close({ terminationReason: "completed", terminationDetail: null });
}

async function withStore(root: string, write: (store: AutomationStudioProjectGatewayTraceStore) => Promise<void>): Promise<void> {
  const pool = new AutomationStudioProjectDatabasePool({ rootDir: root });
  const store = await AutomationStudioProjectGatewayTraceStore.open({ pool, projectId: PROJECT_ID });
  try {
    await write(store);
  } finally {
    await store.close();
    await pool.closeAll();
  }
}

test("small events are stored inline: stored bytes equal logical bytes, no chunks", async t => {
  const root = await storeRoot(t);
  await withStore(root, store => recordFixtureTrace(store, { traceId: "trace-small", episodeId: "run-small", resource: new Uint8Array([1]) }).then(() => undefined));
  const inspection = await inspectProjectTraces({ automationDataDir: root, projectId: PROJECT_ID });
  const [trace] = inspection.traces;
  assert.ok(trace);
  assert.equal(trace.storedBytes.logicalBytes, trace.eventBytes.total);
  assert.deepEqual(
    { inline: trace.storedBytes.inlineEvents, chunked: trace.storedBytes.chunkedEvents, chunks: trace.storedBytes.chunks, objects: trace.storedBytes.objectEvents, ratio: trace.storedBytes.ratio },
    { inline: trace.events, chunked: 0, chunks: 0, objects: 0, ratio: 1 },
  );
  assert.equal(trace.storedBytes.storedBytes, trace.storedBytes.inlineBytes);
  assert.deepEqual(inspection.storage, { traces: 1, logicalBytes: trace.storedBytes.logicalBytes, storedBytes: trace.storedBytes.storedBytes, ratio: 1, distinctChunks: 0, distinctChunkStoredBytes: 0 });
});

test("a repeated large view is chunked once: the trace stores far less than its logical bytes", async t => {
  const root = await storeRoot(t);
  await withStore(root, store => recordLargeTrace(store, "trace-large", largeView(7)));
  const inspection = await inspectProjectTraces({ automationDataDir: root, projectId: PROJECT_ID });
  const [trace] = inspection.traces;
  assert.ok(trace);
  const stored = trace.storedBytes;
  assert.equal(stored.chunkedEvents, 2);
  assert.ok(stored.chunkedLogicalBytes > 2 * 48_000);
  assert.ok(stored.chunks > 0);
  assert.equal(stored.exclusiveChunks, stored.chunks, "no other trace uses these chunks");
  assert.equal(stored.exclusiveChunkStoredBytes, stored.chunkStoredBytes);
  assert.equal(stored.digestListBytes % 32, 0);
  assert.equal(stored.storedBytes, stored.inlineBytes + stored.digestListBytes + stored.chunkStoredBytes);
  assert.ok(stored.ratio !== null && stored.ratio < 0.6, `the second copy shares the first's chunks (ratio ${stored.ratio})`);
});

test("chunks two traces share count once over the traces read, and are not exclusive to either", async t => {
  const root = await storeRoot(t);
  const view = largeView(11);
  await withStore(root, async store => {
    await recordLargeTrace(store, "trace-a", view);
    await recordLargeTrace(store, "trace-b", view);
  });
  const inspection = await inspectProjectTraces({ automationDataDir: root, projectId: PROJECT_ID });
  const [a, b] = inspection.traces.map(trace => trace.storedBytes);
  assert.ok(a && b);
  // Each event's JSON names its trace and event id, so the edge chunks differ; the view between is shared.
  for (const stored of [a, b]) {
    assert.ok(stored.exclusiveChunks > 0 && stored.exclusiveChunks < stored.chunks / 2, `most chunks are shared (${stored.exclusiveChunks} of ${stored.chunks} exclusive)`);
    assert.ok(stored.exclusiveChunkStoredBytes < stored.chunkStoredBytes);
  }
  const storage = inspection.storage;
  assert.ok(storage);
  assert.equal(storage.distinctChunks, a.chunks + b.exclusiveChunks);
  assert.equal(storage.distinctChunkStoredBytes, a.chunkStoredBytes + b.exclusiveChunkStoredBytes);
  const outside = (stored: typeof a) => stored.inlineBytes + stored.digestListBytes + stored.objectBytes;
  assert.equal(storage.storedBytes, outside(a) + outside(b) + storage.distinctChunkStoredBytes);
  assert.equal(storage.logicalBytes, a.logicalBytes + b.logicalBytes);
  assert.ok(storage.ratio !== null && a.ratio !== null && storage.ratio < a.ratio);
});
