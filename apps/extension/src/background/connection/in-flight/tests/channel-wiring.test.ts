// The server command channel's half of in-flight reconciliation (plan B3): the
// result it sends clears the command's record, a session becoming ready
// reports what an earlier worker lost after the offline queue is flushed, and
// an `execute_action` repeating a command id whose result is already queued or
// sent is answered with that result and never reaches the page.
//
// The runtime router is never run here: every row below must answer without
// it, and a row that reached it would fail on the absent browser APIs.

import assert from "node:assert/strict";
import test from "node:test";
import type {
  BrowserActionCommand,
  BrowserActionResult,
  ClientGatewayActionResult,
  ClientGatewayServerMessage,
  FluxIQSession,
  FluxIQSettings,
  ServerCommandPayload
} from "../../../../shared/protocol";
import type { ActivePage } from "../../active-page";
import type { ActiveRecording } from "../../active-recording";
import type { ContentAttachment } from "../../content-attachment";
import { EventSequence } from "../../event-sequence";
import type { GatewaySession } from "../../gateway-session";
import { CommandReconciliation, InFlightRecordStore, workerMemoryRecordArea, type InFlightRecordArea } from "..";
import type { RecordingEvidenceReporter } from "../../recording-evidence";
import { RuntimeStatusTracker } from "../../runtime-status";
import { ServerCommandChannel, type ServerCommandChannelDeps } from "../../server-command-channel";

type SessionReady = Extract<ClientGatewayServerMessage, { type: "server.session_ready" }>;

function harness(area: InFlightRecordArea, queued: readonly ClientGatewayActionResult[] = []) {
  const log: string[] = [];
  const sent: Array<{ type: string; payload: unknown }> = [];
  const runtimeStatus = new RuntimeStatusTracker();
  const send = (async (type: string, payload: unknown) => {
    log.push(`send ${type}`);
    sent.push({ type, payload });
  }) as ServerCommandChannelDeps["send"];
  const store = new InFlightRecordStore(area);
  const reconciliation = new CommandReconciliation({
    store,
    queuedResult: async (commandId) => queued.find((result) => result.commandId === commandId),
    send: async (result) => await send("client.action_result", result)
  });
  const deps: ServerCommandChannelDeps = {
    send,
    gateway: {
      noteMessageReceived: () => undefined,
      markSessionReady: () => log.push("gateway.markSessionReady"),
      flushQueue: async () => {
        log.push("gateway.flushQueue");
      }
    } as unknown as GatewaySession,
    recording: {} as ActiveRecording,
    page: {
      url: () => "https://shop.test/",
      tabId: () => 3,
      unsupported: () => undefined,
      refresh: async () => undefined,
      sendBrowserState: async () => {
        log.push("page.sendBrowserState");
      },
      noteActionResult: () => undefined
    } as unknown as ActivePage,
    runtimeStatus,
    attachment: {} as ContentAttachment,
    evidence: {} as RecordingEvidenceReporter,
    sequence: new EventSequence(),
    session: () => ({ clientId: "client-1" }) as FluxIQSession,
    settings: () => ({ gatewayUrl: "ws://gateway.test" }) as FluxIQSettings,
    persistSession: async () => undefined,
    captureActionBoundary: async (phase) => {
      log.push(`boundary ${phase}`);
    },
    setLastError: () => undefined,
    onActivity: () => undefined,
    emitStatus: () => undefined,
    acceptActivity: () => undefined,
    recordEvent: async () => undefined,
    stopRecording: async () => undefined,
    disconnect: () => undefined,
    reconciliation
  };
  return { channel: new ServerCommandChannel(deps), reconciliation, store, log, sent, runtimeStatus };
}

const press: BrowserActionCommand = { commandId: "cmd-press", actionType: "web.dom.click", selector: "#add" };

function execute(action: BrowserActionCommand): ServerCommandPayload {
  return { command: "execute_action", action } as ServerCommandPayload;
}

type ResultReply = { sendActionResult(result: BrowserActionResult, tabId?: number, frameId?: number): Promise<void> };

test("the result sent for a command clears its record", async () => {
  const h = harness(workerMemoryRecordArea());
  await h.reconciliation.begin(press, 3);
  assert.equal((await h.store.all()).length, 1);
  h.runtimeStatus.startAction(press);
  await (h.channel as unknown as ResultReply).sendActionResult({
    commandId: "cmd-press", actionType: "web.dom.click", status: "succeeded", validation: { status: "none", reason: "not-yet-validated" }, startedAt: 100, finishedAt: 150
  }, 3, 0);
  assert.deepEqual(await h.store.all(), []);
});

test("an execute_action repeating a command id whose result is queued re-sends that result and is not executed", async () => {
  const queued: ClientGatewayActionResult = { commandId: "cmd-press", status: "succeeded", startedAt: 100, completedAt: 150, payload: { commandId: "cmd-press", status: "succeeded" } };
  const h = harness(workerMemoryRecordArea(), [queued]);
  await h.channel.handleCommand(execute(press), "m-1");
  assert.deepEqual(h.sent, [{ type: "client.action_result", payload: queued }]);
  assert.equal(h.runtimeStatus.current().state, "idle", "no runtime status opened");
  assert.equal(h.log.includes("boundary before"), false, "nothing was started toward the page");
  assert.deepEqual(await h.store.all(), [], "and no record written for a command that did not run");
});

test("an execute_action repeating a command id whose result was just sent re-sends it and is not executed", async () => {
  const h = harness(workerMemoryRecordArea());
  await h.reconciliation.begin(press, 3);
  h.runtimeStatus.startAction(press);
  await (h.channel as unknown as ResultReply).sendActionResult({
    commandId: "cmd-press", actionType: "web.dom.click", status: "failed", message: "lost", validation: { status: "none", reason: "not-yet-validated" }, startedAt: 100, finishedAt: 150
  }, 3, 0);
  const [first] = h.sent.filter((message) => message.type === "client.action_result");
  h.log.length = 0;
  await h.channel.handleCommand(execute(press), "m-2");
  const results = h.sent.filter((message) => message.type === "client.action_result");
  assert.equal(results.length, 2);
  assert.deepEqual(results[1]?.payload, first?.payload);
  assert.deepEqual(h.log, ["send client.action_result"], "answered, and nothing else ran");
});

test("a session becoming ready reports what an earlier worker lost, after the offline queue is flushed", async () => {
  const area = workerMemoryRecordArea();
  await harness(area).reconciliation.begin(press, 3);
  // A new worker over the same session storage.
  const h = harness(area);
  await h.channel.handleSessionReady({ type: "server.session_ready", id: "m-0", payload: { sessionId: "s-2", token: "t" } } as unknown as SessionReady);
  assert.deepEqual(h.log, ["gateway.markSessionReady", "page.sendBrowserState", "gateway.flushQueue", "send client.action_result"]);
  const reported = h.sent[0]?.payload as ClientGatewayActionResult;
  assert.equal(reported.commandId, "cmd-press");
  assert.equal(reported.status, "unknown");
  assert.deepEqual({ status: reported.payload?.status, effect: reported.payload?.effect }, { status: "interrupted", effect: "unknown" });
  assert.deepEqual(await h.store.all(), []);
});
