// Core asking what became of a command whose answer never reached it
// (`server.reconcile_command`, plan B3, Core C8). The browser answers from what
// it kept -- `running`, `landed` with the kept result, `unknown`, `not_seen` --
// and never by acting: no row below reaches the runtime router, which would
// fail on the absent browser APIs, and none opens a runtime status or captures
// a boundary. An id answered `not_seen` is refused if it arrives afterwards.
//
// Two workers are two `CommandReconciliation`s over one session-storage
// stand-in, which is what `chrome.storage.session` is to a restarted worker.

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
import { CommandReconciliation, InFlightRecordStore, SeenCommandStore, workerMemoryRecordArea, type InFlightRecordArea } from "..";
import type { RecordingEvidenceReporter } from "../../recording-evidence";
import { RuntimeStatusTracker } from "../../runtime-status";
import { ServerCommandChannel, type ServerCommandChannelDeps } from "../../server-command-channel";

type ReconcileRequest = Extract<ClientGatewayServerMessage, { type: "server.reconcile_command" }>;
type ResultReply = { sendActionResult(result: BrowserActionResult, tabId?: number, frameId?: number): Promise<void> };

const press: BrowserActionCommand = { commandId: "cmd-press", actionType: "web.dom.click", selector: "#confirm" };

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
    seen: new SeenCommandStore(area),
    queuedResult: async (commandId) => queued.find((result) => result.commandId === commandId),
    send: async (result) => await send("client.action_result", result)
  });
  const deps: ServerCommandChannelDeps = {
    send,
    gateway: { noteMessageReceived: () => undefined } as unknown as GatewaySession,
    recording: {} as ActiveRecording,
    page: { url: () => "https://social.test/", tabId: () => 3, unsupported: () => undefined, refresh: async () => undefined, noteActionResult: () => undefined } as unknown as ActivePage,
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
  return { channel: new ServerCommandChannel(deps), reconciliation, log, sent, runtimeStatus };
}

function reconcileRequest(commandId: string): ReconcileRequest {
  return { id: `m-${commandId}`, type: "server.reconcile_command", protocolVersion: "0.1", timestamp: 1, payload: { commandId } } as ReconcileRequest;
}

async function ask(h: ReturnType<typeof harness>, commandId: string): Promise<unknown> {
  h.log.length = 0;
  h.sent.length = 0;
  const status = h.runtimeStatus.current();
  await h.channel.handleMessage(reconcileRequest(commandId));
  assert.deepEqual(h.log, ["send client.reconcile_result"], "answered, and nothing else ran");
  assert.deepEqual(h.runtimeStatus.current(), status, "no runtime status opened or closed");
  return h.sent[0]?.payload;
}

async function sendResult(h: ReturnType<typeof harness>): Promise<ClientGatewayActionResult> {
  h.runtimeStatus.startAction(press);
  await (h.channel as unknown as ResultReply).sendActionResult({
    commandId: "cmd-press", actionType: "web.dom.click", status: "succeeded", validation: { status: "none", reason: "not-yet-validated" }, startedAt: 100, finishedAt: 150
  }, 3, 0);
  return h.sent.find((message) => message.type === "client.action_result")?.payload as ClientGatewayActionResult;
}

test("running: a command still being carried out here is answered running", async () => {
  const h = harness(workerMemoryRecordArea());
  await h.reconciliation.begin(press, 3);
  assert.deepEqual(await ask(h, "cmd-press"), { commandId: "cmd-press", state: "running" });
});

test("landed: a command whose result was sent -- and lost on the way -- is answered with that result", async () => {
  const h = harness(workerMemoryRecordArea());
  await h.reconciliation.begin(press, 3);
  const result = await sendResult(h);
  assert.deepEqual(await ask(h, "cmd-press"), { commandId: "cmd-press", state: "landed", result });
});

test("landed: a result still waiting in the offline queue is the one answered", async () => {
  const queued: ClientGatewayActionResult = { commandId: "cmd-queued", status: "succeeded", startedAt: 100, completedAt: 150 };
  const h = harness(workerMemoryRecordArea(), [queued]);
  assert.deepEqual(await ask(h, "cmd-queued"), { commandId: "cmd-queued", state: "landed", result: queued });
});

test("unknown: a record an earlier worker left without a result", async () => {
  const area = workerMemoryRecordArea();
  await harness(area).reconciliation.begin(press, 3);
  const after = harness(area);
  assert.deepEqual(await ask(after, "cmd-press"), { commandId: "cmd-press", state: "unknown" });
});

test("unknown, never not_seen: a command an earlier worker received and answered, whose result this worker no longer holds", async () => {
  const area = workerMemoryRecordArea();
  const before = harness(area);
  await before.reconciliation.begin(press, 3);
  await sendResult(before);
  const after = harness(area);
  assert.deepEqual(await ask(after, "cmd-press"), { commandId: "cmd-press", state: "unknown" });
});

test("not_seen: a command this browser never received, and a copy arriving afterwards is refused, not run", async () => {
  const h = harness(workerMemoryRecordArea());
  assert.deepEqual(await ask(h, "cmd-press"), { commandId: "cmd-press", state: "not_seen" });

  h.log.length = 0;
  h.sent.length = 0;
  await h.channel.handleCommand({ command: "execute_action", action: press } as ServerCommandPayload, "m-late");
  assert.deepEqual(h.log, ["send client.action_result"], "answered, and nothing was started toward the page");
  const refused = h.sent[0]?.payload as ClientGatewayActionResult;
  assert.equal(refused.status, "failed");
  assert.equal(refused.failure?.effect, "unacted");
  assert.equal(refused.payload?.status, "not_seen");
  assert.deepEqual(await ask(h, "cmd-press"), { commandId: "cmd-press", state: "not_seen" }, "and asked again, it is still not seen");
});

test("a command that has arrived but not yet begun is running, so Core is never told not_seen for it", async () => {
  const h = harness(workerMemoryRecordArea());
  assert.equal(await h.reconciliation.answerRepeat("cmd-press"), undefined, "a new id may run");
  assert.deepEqual(await ask(h, "cmd-press"), { commandId: "cmd-press", state: "running" });
});
