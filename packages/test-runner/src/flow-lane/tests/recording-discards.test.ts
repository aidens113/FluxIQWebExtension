import assert from "node:assert/strict";
import test from "node:test";
import { RunnerFailure } from "../../failure.js";
import { readRecordingDiscards } from "../recording-discards.js";

/**
 * A `/api/client-gateway/snapshot` response shaped as Core serves it: the audit
 * entries `noteDiscardedClientMessage` writes, with the client and page fields
 * that must not travel, beside an unrelated pairing entry.
 */
function snapshot(auditLog: unknown[]) {
  return { ok: true, payload: { sessions: [{ sessionId: "session.one", status: "ready" }], auditLog } };
}
function discard(type: string, metadata: Record<string, unknown>, id = `audit.${type}`) {
  return { id, timestamp: 1, sessionId: "session.one", type, message: "A recording event arrived 12 ms after its recording was finalized", metadata: { source: "automation-studio", clientId: "client.one", clientName: "Chromium", projectId: "project.web", eventType: "client.recording_event", inputId: "element-pressed", executable: type === "recording.action_discarded", ...metadata } };
}
const pairing = { id: "audit.pairing", timestamp: 0, type: "pairing.approved", message: "Pairing approved", metadata: { clientId: "client.one" } };

test("a discarded action on the run's own recording fails as recording.persistence, and only type, entry id, recording, counts and timing travel", () => {
  const audit = readRecordingDiscards(snapshot([
    pairing,
    discard("recording.event_discarded", { recordingId: "recording.run", discardedEvents: 1, discardedActions: 0, sinceFinalizedMs: 4 }),
    discard("recording.action_discarded", { recordingId: "recording.run", discardedEvents: 3, discardedActions: 1, sinceFinalizedMs: 12 }),
  ]), ["recording.run"]);

  assert.deepEqual(audit.discards, [
    { type: "recording.event_discarded", entryId: "audit.recording.event_discarded", recordingId: "recording.run", discardedActions: 0, discardedEvents: 1, sinceFinalizedMs: 4 },
    { type: "recording.action_discarded", entryId: "audit.recording.action_discarded", recordingId: "recording.run", discardedActions: 1, discardedEvents: 3, sinceFinalizedMs: 12 },
  ]);
  assert.ok(audit.failure instanceof RunnerFailure);
  assert.equal(audit.failure.category, "recording.persistence");
  assert.match(audit.failure.message, /1 for recording\.run/u);
  const serialized = JSON.stringify(audit.discards);
  for (const withheld of ["client.one", "Chromium", "element-pressed", "arrived 12 ms"]) assert.equal(serialized.includes(withheld), false, withheld);
});

test("a discard against another recording is not this run's loss", () => {
  const audit = readRecordingDiscards(snapshot([
    discard("recording.action_discarded", { recordingId: "recording.earlier", discardedEvents: 2, discardedActions: 2 }),
    discard("recording.action_discarded", { discardedEvents: 1, discardedActions: 1 }),
  ]), ["recording.run"]);

  assert.deepEqual(audit.discards, []);
  assert.equal(audit.failure, undefined);
});

test("discarded evidence alone is recorded but does not fail the run", () => {
  const audit = readRecordingDiscards(snapshot([
    pairing,
    discard("recording.event_discarded", { recordingId: "recording.run", discardedEvents: 5, discardedActions: 0 }),
  ]), new Set(["recording.run"]));

  assert.deepEqual(audit.discards, [{ type: "recording.event_discarded", entryId: "audit.recording.event_discarded", recordingId: "recording.run", discardedActions: 0, discardedEvents: 5 }]);
  assert.equal(audit.failure, undefined);
});

test("an evidence entry whose running count shows a lost action still fails the run", () => {
  // The action's own entry can have left Core's 100-entry snapshot window.
  const audit = readRecordingDiscards(snapshot([
    discard("recording.event_discarded", { recordingId: "recording.run", discardedEvents: 4, discardedActions: 2 }),
  ]), ["recording.run"]);

  assert.equal(audit.failure?.category, "recording.persistence");
  assert.match(audit.failure?.message ?? "", /2 for recording\.run/u);
});

test("a clean audit yields nothing, and a response with no audit log fails closed", () => {
  assert.deepEqual(readRecordingDiscards(snapshot([pairing]), ["recording.run"]), { discards: [], failure: undefined });
  for (const response of [{ ok: true, payload: { sessions: [] } }, { ok: true }, undefined]) {
    const audit = readRecordingDiscards(response, ["recording.run"]);
    assert.deepEqual(audit.discards, []);
    assert.equal(audit.failure?.category, "gateway.connection");
  }
});

// -- The second read, before the topology closes ------------------------------
// Core audits a discard only when the late message arrives, so the runner reads
// the log again and unions that read with the first.

const runRecordings = ["recording.run"];

test("a second read is unioned with the first by audit entry: an entry both reads return is counted once, and an action discarded after the first read fails the run", () => {
  const lateEvidence = discard("recording.event_discarded", { recordingId: "recording.run", discardedEvents: 1, discardedActions: 0, sinceFinalizedMs: 4 }, "audit.first");
  const first = readRecordingDiscards(snapshot([pairing, lateEvidence]), runRecordings);
  assert.equal(first.failure, undefined);

  const lateAction = discard("recording.action_discarded", { recordingId: "recording.run", discardedEvents: 2, discardedActions: 1, sinceFinalizedMs: 900 }, "audit.second");
  const second = readRecordingDiscards(snapshot([pairing, lateEvidence, lateAction]), runRecordings, first.discards);

  assert.deepEqual(second.discards, [
    { type: "recording.event_discarded", entryId: "audit.first", recordingId: "recording.run", discardedActions: 0, discardedEvents: 1, sinceFinalizedMs: 4 },
    { type: "recording.action_discarded", entryId: "audit.second", recordingId: "recording.run", discardedActions: 1, discardedEvents: 2, sinceFinalizedMs: 900 },
  ]);
  assert.equal(second.failure?.category, "recording.persistence");
  assert.match(second.failure?.message ?? "", /Core discarded recorded actions .*\(1 for recording\.run\)/u);
  // The first read's result is not changed by the second.
  assert.equal(first.discards.length, 1);
});

test("a loss only the first read saw still fails the second, and an unreadable second read keeps the first read's discards", () => {
  // The action's entry has left the 100-entry window by the second read.
  const lostEarly = discard("recording.action_discarded", { recordingId: "recording.run", discardedEvents: 1, discardedActions: 1 }, "audit.early");
  const first = readRecordingDiscards(snapshot([lostEarly]), runRecordings);
  const second = readRecordingDiscards(snapshot([pairing]), runRecordings, first.discards);
  assert.deepEqual(second.discards, first.discards);
  assert.equal(second.failure?.category, "recording.persistence");
  // A known loss outranks an audit the second read could not get.
  assert.equal(readRecordingDiscards({ ok: true }, runRecordings, first.discards).failure?.category, "recording.persistence");

  const evidenceOnly = readRecordingDiscards(snapshot([discard("recording.event_discarded", { recordingId: "recording.run", discardedEvents: 1, discardedActions: 0 }, "audit.evidence")]), runRecordings);
  const unreadable = readRecordingDiscards(undefined, runRecordings, evidenceOnly.discards);
  assert.deepEqual(unreadable.discards, evidenceOnly.discards);
  assert.equal(unreadable.failure?.category, "gateway.connection");
});

test("an audit entry without an id is matched by its type, recording and running counts", () => {
  const entry = { type: "recording.event_discarded", metadata: { recordingId: "recording.run", discardedEvents: 3, discardedActions: 0 } };
  const next = { type: "recording.event_discarded", metadata: { recordingId: "recording.run", discardedEvents: 4, discardedActions: 0 } };
  const first = readRecordingDiscards(snapshot([entry]), runRecordings);
  const second = readRecordingDiscards(snapshot([entry, next]), runRecordings, first.discards);

  assert.deepEqual(second.discards.map(item => item.discardedEvents), [3, 4]);
  assert.equal(second.discards.some(item => "entryId" in item), false);
  assert.equal(second.failure, undefined);
});
