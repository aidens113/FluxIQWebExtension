import assert from "node:assert/strict";
import test from "node:test";
import { ClientGatewayTraceMemoryStore } from "fluxiq/client-gateway";
import { holdsAnySecret, summarizeTrace, traceArtifactDedupe } from "../index.js";
import { FIXTURE_TOKEN, recordFixtureTrace } from "./trace-fixtures.js";

async function fixture(input: { traceId: string; resource: Uint8Array; leak?: boolean }) {
  const store = new ClientGatewayTraceMemoryStore();
  const manifest = await recordFixtureTrace(store, { ...input, episodeId: "run-fixture" });
  const events = await store.readEventRange(input.traceId, 1, Number.MAX_SAFE_INTEGER);
  const heldArtifacts = await store.listArtifacts(input.traceId);
  return { store, manifest, events, heldArtifacts };
}

test("a whole trace is complete by Core's evaluator and is reported as counts", async () => {
  const { manifest, events, heldArtifacts } = await fixture({ traceId: "trace-one", resource: new Uint8Array([1, 2, 3, 4]) });
  const summary = summarizeTrace({ manifest, events, heldArtifacts, objectThresholdBytes: 256 * 1024 });
  assert.equal(summary.completeness.status, "complete", JSON.stringify(summary.completeness.issues));
  assert.equal(summary.events, 5);
  assert.deepEqual(summary.eventsByKind, { inbound: 2, outbound: 1, artifact: 2 });
  assert.deepEqual(summary.eventsByStream, { gateway: 3, artifact: 2 });
  assert.equal(summary.eventBytes.inlineEvents, 5);
  assert.equal(summary.eventBytes.objectEvents, 0);
  assert.equal(summary.artifacts.inventory, 2);
  assert.equal(summary.artifacts.held, 2);
  assert.deepEqual({ traced: summary.references.tracedCommands, results: summary.references.resultsWithReferences, primary: summary.references.primary, resource: summary.references.resource, unavailable: summary.references.unavailable }, { traced: 1, results: 1, primary: 1, resource: 1, unavailable: 1 });
  assert.deepEqual(summary.references.byMediaType, { "text/html": 1, "image/png": 1 });
  assert.deepEqual(summary.credentialRedactions["client.hello"], { events: 1, redacted: 1 });
  assert.equal(summary.commandTimings.commands, 1);
  assert.equal(summary.commandTimings.answered, 1);
  assert.ok((summary.commandTimings.byMessageType["server.execute_action:capture_snapshot"]?.totalMs ?? 0) > 0);
  assert.deepEqual(summary.redactionsByReason, { credential: 1 });
});

test("an event at or above the store threshold is counted as a content object", async () => {
  const { manifest, events, heldArtifacts } = await fixture({ traceId: "trace-threshold", resource: new Uint8Array([9]) });
  const summary = summarizeTrace({ manifest, events, heldArtifacts, objectThresholdBytes: 1 });
  assert.equal(summary.eventBytes.objectEvents, 5);
  assert.equal(summary.eventBytes.object, summary.eventBytes.total);
});

test("a missing artifact makes the trace incomplete, naming the artifact", async () => {
  const { manifest, events, heldArtifacts } = await fixture({ traceId: "trace-missing", resource: new Uint8Array([5, 6]) });
  const summary = summarizeTrace({ manifest, events, heldArtifacts: heldArtifacts.slice(1), objectThresholdBytes: 256 * 1024 });
  assert.equal(summary.completeness.status, "incomplete");
  assert.deepEqual(summary.completeness.issues.map(issue => [issue.code, issue.artifactId]), [["missing_artifact", heldArtifacts[0]?.id]]);
});

test("a dropped credential redaction is reported, not counted as redacted", async () => {
  const { manifest, events, heldArtifacts } = await fixture({ traceId: "trace-unredacted", resource: new Uint8Array([7]) });
  const stripped = events.map(event => (event.messageType === "client.hello" ? { ...event, redactions: [] } : event));
  const summary = summarizeTrace({ manifest, events: stripped, heldArtifacts, objectThresholdBytes: 256 * 1024 });
  assert.deepEqual(summary.credentialRedactions["client.hello"], { events: 1, redacted: 0 });
});

test("a resource two traces hold is counted once in the dedupe", async () => {
  const shared = new Uint8Array([42, 42, 42]);
  const first = await fixture({ traceId: "trace-a", resource: shared });
  const second = await fixture({ traceId: "trace-b", resource: shared });
  const dedupe = traceArtifactDedupe([first.heldArtifacts, second.heldArtifacts]);
  assert.equal(dedupe.references, 4);
  assert.equal(dedupe.distinct, 2);
  assert.equal(dedupe.referencedBytes, 2 * (first.heldArtifacts[0]!.byteLength + shared.byteLength));
  assert.equal(dedupe.distinctBytes, first.heldArtifacts[0]!.byteLength + shared.byteLength);
});

test("the secret search finds a token in clear, in UTF-8 or UTF-16LE, and not in a redacted trace", async () => {
  const clean = await fixture({ traceId: "trace-clean", resource: new Uint8Array([1]) });
  assert.equal(clean.events.some(event => holdsAnySecret(JSON.stringify(event), [FIXTURE_TOKEN])), false);
  const leaked = await fixture({ traceId: "trace-leak", resource: new Uint8Array([1]), leak: true });
  assert.equal(leaked.events.filter(event => holdsAnySecret(JSON.stringify(event), [FIXTURE_TOKEN])).length, 1);
  assert.equal(holdsAnySecret(Buffer.from(`x${FIXTURE_TOKEN}y`, "utf16le"), [FIXTURE_TOKEN]), true);
  assert.equal(holdsAnySecret("anything", [""]), false);
});
