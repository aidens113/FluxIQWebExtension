// The panel store and its request wrapper against a stubbed `chrome.runtime`:
// a request never throws, every failure is a sentence, and a status arrives in
// the store from the first read, from a command's reply, and from a push.

import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { RUNTIME_MESSAGES } from "../../../shared/constants";
import type { ExtensionStatus } from "../../../shared/protocol";
import { EXTENSION_RESTARTED } from "../../copy";
import { createPanelStore, panelRequest, UNKNOWN_MESSAGE_ERROR } from "..";

type Reply = unknown | ((message: { type: string }) => unknown);
type Stub = { sent: Array<{ type: string }>; push(message: unknown): void };

function stubChrome(t: TestContext, reply: Reply, options: { lastError?: string } = {}): Stub {
  const holder = globalThis as { chrome?: unknown };
  const previous = holder.chrome;
  t.after(() => { holder.chrome = previous; });
  const sent: Array<{ type: string }> = [];
  const pushListeners: Array<(message: unknown) => void> = [];
  const runtime = {
    lastError: undefined as { message: string } | undefined,
    sendMessage(message: { type: string }, callback: (response: unknown) => void) {
      sent.push(message);
      const answer = typeof reply === "function" ? (reply as (message: { type: string }) => unknown)(message) : reply;
      queueMicrotask(() => {
        runtime.lastError = options.lastError === undefined ? undefined : { message: options.lastError };
        callback(answer);
        runtime.lastError = undefined;
      });
    },
    onMessage: { addListener(listener: (message: unknown) => void) { pushListeners.push(listener); } }
  };
  holder.chrome = { runtime };
  return { sent, push: (message) => { for (const listener of pushListeners) listener(message); } };
}

function status(connectionState: ExtensionStatus["connectionState"], extra: Partial<ExtensionStatus> = {}): ExtensionStatus {
  // `paired` is included and the literal cast, so this compiles before and after
  // workstream D makes `paired` part of ExtensionStatus.
  return { connectionState, recordingState: "idle", gatewayUrl: "", clientId: "c", queueSize: 0, eventCount: 0, recentActivities: [], paired: false, ...extra } as ExtensionStatus;
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

test("panelRequest answers ok with the reply as its value", async (t) => {
  stubChrome(t, { ok: true, status: status("connected") });
  const result = await panelRequest<{ status: ExtensionStatus }>({ type: RUNTIME_MESSAGES.getStatus });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.value.status.connectionState, "connected");
});

test("panelRequest turns a missing reply into the restart sentence instead of a TypeError", async (t) => {
  stubChrome(t, undefined);
  const result = await panelRequest({ type: RUNTIME_MESSAGES.getStatus });
  assert.deepEqual(result, { ok: false, sentence: EXTENSION_RESTARTED, detail: "The extension's background worker gave no answer." });
});

test("panelRequest turns a rejected send into the restart sentence and keeps the raw text", async (t) => {
  stubChrome(t, undefined, { lastError: "Could not establish connection. Receiving end does not exist." });
  const result = await panelRequest({ type: RUNTIME_MESSAGES.getStatus });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.sentence, EXTENSION_RESTARTED);
    assert.equal(result.detail, "Could not establish connection. Receiving end does not exist.");
  }
});

test("panelRequest maps a failed reply to a sentence and keeps the raw error as detail", async (t) => {
  stubChrome(t, { ok: false, error: "WebSocket connection failed." });
  assert.deepEqual(await panelRequest({ type: RUNTIME_MESSAGES.connect }), {
    ok: false, sentence: "Can't reach FluxIQ. Make sure it is running on this computer.", detail: "WebSocket connection failed."
  });
});

test("panelRequest keeps the background's failure code, so a view can tell refused from unreachable", async (t) => {
  stubChrome(t, { ok: false, code: "refused", httpStatus: 403, error: "This endpoint is not available to a paired client." });
  const refused = await panelRequest({ type: "fluxiq.panel.sendTurn" });
  assert.equal(refused.ok, false);
  if (!refused.ok) assert.equal(refused.code, "refused");

  stubChrome(t, { ok: false, error: "WebSocket connection failed." });
  const uncoded = await panelRequest({ type: RUNTIME_MESSAGES.connect });
  assert.equal(uncoded.ok, false);
  if (!uncoded.ok) assert.equal("code" in uncoded, false);
});

test("panelRequest flags a message this build does not handle as unsupported", async (t) => {
  stubChrome(t, { ok: false, error: UNKNOWN_MESSAGE_ERROR });
  const result = await panelRequest({ type: "fluxiq.panel.stopRun" });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.unsupported, true);
});

test("the store reads the status once on creation and replays it to a late subscriber", async (t) => {
  const stub = stubChrome(t, { ok: true, status: status("connected") });
  const store = createPanelStore();
  assert.deepEqual(stub.sent, [{ type: RUNTIME_MESSAGES.getStatus }]);
  await settle();
  assert.equal(store.current()?.connectionState, "connected");
  const seen: string[] = [];
  store.subscribe((next) => seen.push(next.connectionState));
  assert.deepEqual(seen, ["connected"]);
});

test("a command's reply and a push both publish, and unsubscribe stops delivery", async (t) => {
  const stub = stubChrome(t, (message: { type: string }) => message.type === RUNTIME_MESSAGES.getStatus
    ? { ok: true, status: status("disconnected") }
    : { ok: true, status: status("connecting") });
  const store = createPanelStore();
  await settle();
  const seen: string[] = [];
  const stop = store.subscribe((next) => seen.push(next.connectionState));
  await store.request({ type: RUNTIME_MESSAGES.connect });
  stub.push({ type: RUNTIME_MESSAGES.statusChanged, status: status("pairing", { pairingReferenceCode: "K7Q2" }) });
  stub.push({ type: "fluxiq.somethingElse", status: status("error") });
  stop();
  stub.push({ type: RUNTIME_MESSAGES.statusChanged, status: status("connected") });
  assert.deepEqual(seen, ["disconnected", "connecting", "pairing"]);
  assert.equal(store.current()?.connectionState, "connected");
});

test("a failed request leaves the status as it was", async (t) => {
  stubChrome(t, (message: { type: string }) => message.type === RUNTIME_MESSAGES.getStatus
    ? { ok: true, status: status("connected") }
    : { ok: false, error: "Connect to FluxIQ before recording." });
  const store = createPanelStore();
  await settle();
  const result = await store.request({ type: RUNTIME_MESSAGES.startRecording });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.sentence, "Connect to FluxIQ before recording.");
  assert.equal(store.current()?.connectionState, "connected");
});
