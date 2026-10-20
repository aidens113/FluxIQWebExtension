import assert from "node:assert/strict";
import test from "node:test";

import type { FluxIQSettings } from "../../shared/protocol";
import { readSavedClientId, readSavedOutbox, readSavedSession, readSavedSettings } from "../saved-state";

const defaults: FluxIQSettings = {
  gatewayUrl: "ws://127.0.0.1:4777/client",
  coreApiUrl: "http://127.0.0.1:3000",
  autoReconnect: true,
  captureMutations: true,
  captureInputValues: true,
  captureSnapshots: true,
  requestsEnabled: false
};

test("well-formed settings are kept, and nothing stored reads as the defaults", () => {
  const stored = { ...defaults, gatewayUrl: "wss://fluxiq.example/client", autoReconnect: false };
  assert.deepEqual(readSavedSettings(stored, defaults), { value: stored, repaired: [] });
  assert.deepEqual(readSavedSettings(undefined, defaults), { value: defaults, repaired: [] });
});

test("each malformed settings field is replaced by its default and named", () => {
  const reading = readSavedSettings({ gatewayUrl: "http://not-a-socket", coreApiUrl: 42, autoReconnect: "yes", captureSnapshots: false }, defaults);
  assert.deepEqual(reading.value, { ...defaults, captureSnapshots: false });
  assert.deepEqual(reading.repaired, ["gatewayUrl", "coreApiUrl", "autoReconnect"]);
  assert.deepEqual(readSavedSettings("garbage", defaults), { value: defaults, repaired: ["settings"] });
  assert.deepEqual(readSavedSettings([1, 2], defaults), { value: defaults, repaired: ["settings"] });
});

test("a session keeps its well-formed fields and drops the rest", () => {
  const reading = readSavedSession({ clientId: "c1", token: 12, sessionId: "s1", projectId: null, connectedAt: "yesterday" }, "fallback");
  assert.deepEqual(reading.value, { clientId: "c1", sessionId: "s1", projectId: null });
  assert.deepEqual(reading.repaired, ["session.token", "session.connectedAt"]);
  assert.deepEqual(readSavedSession("garbage", "fallback"), { value: null, repaired: ["session"] });
  assert.deepEqual(readSavedSession(undefined, "fallback"), { value: null, repaired: [] });
  assert.deepEqual(readSavedSession({ token: "t" }, "fallback").value, { clientId: "fallback", token: "t" });
});

test("the offline queue keeps its lineage and each entry with a whole binding and a typed message", () => {
  const good = { binding: { session: "lineage-1", projectId: "project-1", recordingId: null }, message: { type: "client.recording_event", payload: {} } };
  const unbound = { binding: { session: "lineage-1", projectId: 7, recordingId: null }, message: { type: "client.recording_event", payload: {} } };
  const untyped = { binding: { session: "lineage-1", projectId: null, recordingId: "rec-1" }, message: { payload: {} } };
  assert.deepEqual(readSavedOutbox({ lineage: "lineage-1", entries: [good] }), { value: { lineage: "lineage-1", entries: [good] }, repaired: [] });
  assert.deepEqual(readSavedOutbox({ lineage: "lineage-1", entries: [good, null, unbound, untyped, "x"] }), { value: { lineage: "lineage-1", entries: [good] }, repaired: ["outbox.entries"] });
  assert.deepEqual(readSavedOutbox(undefined), { value: { entries: [] }, repaired: [] });
});

test("an offline queue of the wrong shape is repaired, never thrown", () => {
  assert.deepEqual(readSavedOutbox("garbage"), { value: { entries: [] }, repaired: ["outbox"] });
  assert.deepEqual(readSavedOutbox([1, 2]), { value: { entries: [] }, repaired: ["outbox"] });
  assert.deepEqual(readSavedOutbox({ lineage: 12, entries: { not: "a list" } }), { value: { entries: [] }, repaired: ["outbox.lineage", "outbox.entries"] });
  assert.deepEqual(readSavedOutbox({ lineage: "  ", entries: [] }), { value: { entries: [] }, repaired: ["outbox.lineage"] });
});

test("the offline queue keeps its loss record and each entry's recorded size, so the next flush still reports the loss", () => {
  const sized = { binding: { session: "lineage-1", projectId: null, recordingId: null }, message: { type: "client.state_update", payload: {} }, bytes: 120 };
  const lost = { count: 3, byReason: { count_limit: 1, byte_budget: 2 } };
  assert.deepEqual(readSavedOutbox({ lineage: "lineage-1", entries: [sized], lost }), { value: { lineage: "lineage-1", entries: [sized], lost }, repaired: [] });
});

test("a malformed loss record keeps the counts it can read under Core's reasons, and a size that is not a byte count is dropped", () => {
  const entry = { binding: { session: "lineage-1", projectId: null, recordingId: null }, message: { type: "client.state_update", payload: {} } };
  assert.deepEqual(
    readSavedOutbox({ entries: [{ ...entry, bytes: -4 }], lost: { count: 9, byReason: { count_limit: 2, invented: 7 } } }),
    { value: { entries: [entry], lost: { count: 2, byReason: { count_limit: 2 } } }, repaired: ["outbox.lost"] }
  );
  assert.deepEqual(readSavedOutbox({ entries: [], lost: "lots" }), { value: { entries: [] }, repaired: ["outbox.lost"] });
});

test("a client id must be a non-blank string", () => {
  assert.equal(readSavedClientId("extension-1"), "extension-1");
  assert.equal(readSavedClientId("  "), undefined);
  assert.equal(readSavedClientId(7), undefined);
});


test("the stored request choice is read as the person set it, before any policy is known, and never repaired away", () => {
  assert.deepEqual(readSavedSettings({ ...defaults, requestsEnabled: true }, defaults), { value: { ...defaults, requestsEnabled: true }, repaired: [] });
  assert.deepEqual(readSavedSettings({ ...defaults, requestsEnabled: false }, defaults), { value: defaults, repaired: [] });
  assert.equal(readSavedSettings({}, defaults).value.requestsEnabled, false, "nothing stored is the default, off");
  const malformed = readSavedSettings({ ...defaults, requestsEnabled: "yes" }, defaults);
  assert.equal(malformed.value.requestsEnabled, false);
  assert.deepEqual(malformed.repaired, ["requestsEnabled"]);
});
