// The server command channel's check of a command's host lease
// (automation-project-agents plan, `Extension And Domain Wiring` 1): a command
// under a lease that moved is answered with the refusal and never started --
// no runtime status, no evidence boundary, no recorded event -- and a repeat of
// its id, or Core asking about it, hears the refusal rather than `not_seen`.
// A command under the current or a newer lease, or under none, runs.
//
// A command that is let through is stopped at its first step toward the page,
// the evidence boundary before it (`boundary before`), so the runtime router
// and the browser APIs it needs are never reached here; that step is how far a
// command got, and a refused command never gets there.

import assert from "node:assert/strict";
import test from "node:test";
import type { WebAutomationFactCheckCommand, WebAutomationHostLease } from "@fluxiq-web-extension/domain/client";
import type {
  BrowserActionCommand,
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
import { HostLeaseLedger } from "..";
import { CommandReconciliation, InFlightRecordStore, workerMemoryRecordArea, type InFlightRecordArea } from "../../in-flight/index";
import type { RecordingEvidenceReporter } from "../../recording-evidence";
import { RuntimeStatusTracker } from "../../runtime-status";
import { ServerCommandChannel, type ServerCommandChannelDeps } from "../../server-command-channel";

type Reconcile = Extract<ClientGatewayServerMessage, { type: "server.reconcile_command" }>;

/** Thrown at the evidence boundary before a command that was let through, so nothing past it runs. */
const STOP_BEFORE_PAGE = new Error("stopped before the page");

/** Hands the channel one command; a command let through ends at the boundary, which is not this row's failure. */
async function handle(channel: ServerCommandChannel, payload: ServerCommandPayload, messageId: string): Promise<void> {
  await channel.handleCommand(payload, messageId).catch((error: unknown) => {
    if (error !== STOP_BEFORE_PAGE) throw error;
  });
}

function harness(area: InFlightRecordArea = workerMemoryRecordArea()) {
  const log: string[] = [];
  const sent: Array<{ type: string; payload: unknown }> = [];
  const recorded: unknown[] = [];
  const runtimeStatus = new RuntimeStatusTracker();
  const send = (async (type: string, payload: unknown) => {
    log.push(`send ${type}`);
    sent.push({ type, payload });
  }) as ServerCommandChannelDeps["send"];
  const store = new InFlightRecordStore(area);
  const reconciliation = new CommandReconciliation({ store, queuedResult: async () => undefined, send: async (result) => await send("client.action_result", result) });
  const deps: ServerCommandChannelDeps = {
    send,
    gateway: { noteMessageReceived: () => undefined } as unknown as GatewaySession,
    recording: {} as ActiveRecording,
    page: {
      url: () => "https://shop.test/",
      tabId: () => 3,
      unsupported: () => undefined,
      refresh: async () => undefined,
      noteActionResult: () => undefined
    } as unknown as ActivePage,
    runtimeStatus,
    attachment: { attachTabForRecording: async () => undefined } as unknown as ContentAttachment,
    evidence: {} as RecordingEvidenceReporter,
    sequence: new EventSequence(),
    session: () => ({ clientId: "client-a" }) as FluxIQSession,
    settings: () => ({ gatewayUrl: "ws://gateway.test" }) as FluxIQSettings,
    persistSession: async () => undefined,
    captureActionBoundary: async (phase) => {
      log.push(`boundary ${phase}`);
      if (phase === "before") throw STOP_BEFORE_PAGE;
    },
    setLastError: () => undefined,
    onActivity: (kind, label) => log.push(`activity ${kind}: ${label}`),
    emitStatus: () => undefined,
    acceptActivity: () => undefined,
    recordEvent: async (payload) => {
      recorded.push(payload);
    },
    stopRecording: async () => undefined,
    disconnect: () => undefined,
    reconciliation,
    hostLeases: new HostLeaseLedger(area)
  };
  return { channel: new ServerCommandChannel(deps), store, log, sent, recorded, runtimeStatus, statusBefore: runtimeStatus.current() };
}

/** Forgets what earlier commands sent and logged, and notes the runtime status the next command must leave as it is. */
function forgetEarlier(h: ReturnType<typeof harness>): void {
  h.sent.length = 0;
  h.log.length = 0;
  h.recorded.length = 0;
  h.statusBefore = h.runtimeStatus.current();
}

const lease = (epoch: number, briefId = "brief-1"): WebAutomationHostLease => ({ resourceKey: "web.automation:client-a", epoch, holder: { role: "builder", briefId } });

function press(commandId: string): BrowserActionCommand {
  return { commandId, actionType: "web.dom.click", selector: "#add" };
}

function execute(action: BrowserActionCommand, leased?: unknown): ServerCommandPayload {
  return (leased === undefined ? { command: "execute_action", action } : { command: "execute_action", action, lease: leased }) as ServerCommandPayload;
}

const results = (sent: Array<{ type: string; payload: unknown }>) => sent.filter((message) => message.type === "client.action_result").map((message) => message.payload as ClientGatewayActionResult);

/** What a refused command's answer is, and that nothing toward the page started. */
function assertRefusedUnstarted(h: ReturnType<typeof harness>, commandId: string, code: string, seenEpoch?: number): ClientGatewayActionResult {
  const answers = results(h.sent);
  assert.equal(answers.length, 1);
  const refusal = answers[0]!;
  assert.equal(refusal.commandId, commandId);
  assert.equal(refusal.status, "failed");
  assert.deepEqual(
    { category: refusal.failure?.category, code: refusal.failure?.code, retryable: refusal.failure?.retryable, stage: refusal.failure?.stage, effect: refusal.failure?.effect },
    { category: "blocked_by_capability_or_policy", code, retryable: false, stage: "dispatch", effect: "unacted" }
  );
  assert.deepEqual(refusal.payload, { commandId, status: "refused", code });
  if (seenEpoch !== undefined) assert.match(refusal.failure?.actual ?? "", new RegExp(`seen epoch ${seenEpoch} `, "u"));
  assert.equal(h.log.includes("boundary before"), false, "nothing was started toward the page");
  assert.deepEqual(h.runtimeStatus.current(), h.statusBefore, "no runtime status opened or closed");
  assert.deepEqual(h.recorded, [], "nothing recorded");
  return refusal;
}

test("a command under a lower epoch than the browser has seen is refused as stale, and never started", async () => {
  const h = harness();
  await handle(h.channel, execute(press("cmd-current"), lease(5)), "m-1");
  forgetEarlier(h);
  await handle(h.channel, execute(press("cmd-late"), lease(4, "brief-0")), "m-2");
  assertRefusedUnstarted(h, "cmd-late", "host_lease.stale", 5);
  assert.equal(await h.store.read("cmd-late"), undefined, "and no in-flight record left for it");
});

test("a command naming another holder on the current epoch is refused as a mismatch", async () => {
  const h = harness();
  await handle(h.channel, execute(press("cmd-current"), lease(5)), "m-1");
  forgetEarlier(h);
  await handle(h.channel, execute(press("cmd-other"), lease(5, "brief-2")), "m-2");
  assertRefusedUnstarted(h, "cmd-other", "host_lease.holder_mismatch", 5);
});

test("a lease that cannot be read is refused as missing", async () => {
  const h = harness();
  await handle(h.channel, execute(press("cmd-garbled"), { resourceKey: "web.automation:client-a", epoch: "five" }), "m-1");
  assertRefusedUnstarted(h, "cmd-garbled", "host_lease.missing");
});

test("a repeated id of a refused command is answered with the refusal, and Core asking about it never hears not_seen", async () => {
  const h = harness();
  await handle(h.channel, execute(press("cmd-current"), lease(5)), "m-1");
  h.sent.length = 0;
  await handle(h.channel, execute(press("cmd-late"), lease(4)), "m-2");
  const [refusal] = results(h.sent);
  await handle(h.channel, execute(press("cmd-late"), lease(4)), "m-3");
  assert.deepEqual(results(h.sent), [refusal, refusal]);
  await h.channel.handleMessage({ type: "server.reconcile_command", id: "m-4", payload: { commandId: "cmd-late" } } as unknown as Reconcile);
  const answer = h.sent.find((message) => message.type === "client.reconcile_result")?.payload as { state: string; result?: unknown };
  assert.equal(answer.state, "landed");
  assert.deepEqual(answer.result, refusal);
});

test("a higher epoch is adopted and the command runs; the lease before it is stale from then on", async () => {
  const h = harness();
  await handle(h.channel, execute(press("cmd-a"), lease(4)), "m-1");
  await handle(h.channel, execute(press("cmd-b"), lease(6, "brief-2")), "m-2");
  assert.equal(h.log.filter((entry) => entry === "boundary before").length, 2, "both commands started");
  forgetEarlier(h);
  await handle(h.channel, execute(press("cmd-c"), lease(4)), "m-3");
  assertRefusedUnstarted(h, "cmd-c", "host_lease.stale", 6);
});

test("a command without a lease, with no lease ever seen, runs as it always has", async () => {
  const h = harness();
  await handle(h.channel, execute(press("cmd-plain")), "m-1");
  assert.equal(h.log.includes("boundary before"), true);
  assert.equal(results(h.sent).some((result) => result.failure?.code?.startsWith("host_lease.") === true), false);
});

test("a restarted worker still refuses a lease below the one the worker before it saw", async () => {
  const area = workerMemoryRecordArea();
  await handle(harness(area).channel, execute(press("cmd-current"), lease(8)), "m-1");
  const restarted = harness(area);
  await handle(restarted.channel, execute(press("cmd-late"), lease(7)), "m-2");
  assertRefusedUnstarted(restarted, "cmd-late", "host_lease.stale", 8);
});

test("a fact check under a stale lease is refused the same way, and the page is never read", async () => {
  const h = harness();
  await handle(h.channel, execute(press("cmd-current"), lease(5)), "m-1");
  forgetEarlier(h);
  const check = { commandId: "cmd-facts", request: { claims: [] } } as unknown as WebAutomationFactCheckCommand;
  await handle(h.channel, { command: "evaluate_facts", check, lease: lease(3) }, "m-2");
  assertRefusedUnstarted(h, "cmd-facts", "host_lease.stale", 5);
});
