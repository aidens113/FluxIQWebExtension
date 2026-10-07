import assert from "node:assert/strict";
import test from "node:test";

import type { FluxIQSettings } from "../../shared/protocol";
import { readSavedClientId, readSavedQueue, readSavedSession, readSavedSettings } from "../saved-state";

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
  assert.deepEqual(reading.repaired, ["requestsEnabled", "gatewayUrl", "coreApiUrl", "autoReconnect"]);
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

test("the offline queue keeps messages that name their type", () => {
  const good = { type: "client.recording_event", payload: {} };
  assert.deepEqual(readSavedQueue([good, null, { payload: {} }, "x"]), { value: [good], repaired: ["queuedEvents"] });
  assert.deepEqual(readSavedQueue({ not: "a list" }), { value: [], repaired: ["queuedEvents"] });
  assert.deepEqual(readSavedQueue([good]), { value: [good], repaired: [] });
});

test("a client id must be a non-blank string", () => {
  assert.equal(readSavedClientId("extension-1"), "extension-1");
  assert.equal(readSavedClientId("  "), undefined);
  assert.equal(readSavedClientId(7), undefined);
});


test("request preference stays OFF for missing, malformed and attempted true saved settings", () => {
  for (const stored of [undefined, {}, { requestsEnabled: true }, { requestsEnabled: "yes" }, { requestsEnabled: false }]) {
    assert.equal(readSavedSettings(stored, defaults).value.requestsEnabled, false);
  }
});
