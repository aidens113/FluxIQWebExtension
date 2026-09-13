// Coverage of server-command-channel.ts: where each server message and command
// goes. The load-bearing routes are the ones a mistake would hide -- a refused
// recording start must not fail a healthy socket, a stop or disconnect must
// re-enter through the facade's public method rather than short-cut past it, and
// an action's reply sends a recording confirmation only when it succeeded, naming
// the tab input its own command asked for and carrying that tab without an origin
// or a query.

import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { WEB_AUTOMATION_ACTION_TYPES, WEB_AUTOMATION_INPUT_IDS } from "@fluxiq-web-extension/domain/client";
import type {
  ActivityEntry,
  BrowserActionCommand,
  BrowserActionResult,
  BrowserActionType,
  ClientGatewayServerMessage,
  FluxIQSession,
  FluxIQSettings,
  ServerCommandPayload
} from "../../../shared/protocol";
import type { ActivePage } from "../active-page";
import type { ActiveRecording } from "../active-recording";
import type { ContentAttachment } from "../content-attachment";
import { EventSequence } from "../event-sequence";
import type { GatewaySession } from "../gateway-session";
import type { RecordingEvidenceReporter } from "../recording-evidence";
import type { RecordingStartRefusal } from "../recording-start/index";
import { RuntimeStatusTracker } from "../runtime-status";
import { ServerCommandChannel, type ServerCommandChannelDeps } from "../server-command-channel";

function harness() {
  const calls: string[] = [];
  const refusals: RecordingStartRefusal[] = [];
  const accepted: Array<[string, string | null | undefined]> = [];
  const stops: boolean[] = [];
  const snapshotLabels: string[] = [];
  const activities: Array<{ label: string; tone: ActivityEntry["tone"] | undefined }> = [];
  const sent: Array<{ type: string; payload: unknown }> = [];
  const runtimeStatus = new RuntimeStatusTracker();
  let lastError: string | undefined = "stale error";
  let pageTabId: number | undefined = 3;

  const gateway = {
    noteMessageReceived: () => calls.push("gateway.noteMessageReceived"),
    markFailed: () => calls.push("gateway.markFailed"),
    markSessionReady: () => calls.push("gateway.markSessionReady"),
    flushQueue: async () => {
      calls.push("gateway.flushQueue");
    }
  } as unknown as GatewaySession;
  const recording = {
    noteStartRefusal: (refusal: RecordingStartRefusal) => refusals.push(refusal),
    beginAccepted: async (recordingId: string, projectId?: string | null) => {
      accepted.push([recordingId, projectId]);
    }
  } as unknown as ActiveRecording;
  const page = {
    url: () => "https://shop.test/",
    tabId: () => pageTabId,
    unsupported: () => undefined,
    setTabId: (tabId: number) => {
      calls.push(`page.setTabId ${tabId}`);
      pageTabId = tabId;
    },
    refresh: async () => undefined,
    sendBrowserState: async () => {
      calls.push("page.sendBrowserState");
    },
    noteActionResult: () => undefined
  } as unknown as ActivePage;
  const evidence = {
    captureActiveSnapshot: async (label: string) => {
      snapshotLabels.push(label);
    }
  } as unknown as RecordingEvidenceReporter;

  const deps: ServerCommandChannelDeps = {
    send: (async (type: string, payload: unknown) => {
      sent.push({ type, payload });
    }) as ServerCommandChannelDeps["send"],
    gateway,
    recording,
    page,
    runtimeStatus,
    attachment: {} as ContentAttachment,
    evidence,
    sequence: new EventSequence(),
    session: () => ({ clientId: "client-1" }) as FluxIQSession,
    settings: () => ({ gatewayUrl: "ws://gateway.test" }) as FluxIQSettings,
    persistSession: async () => {
      calls.push("persistSession");
    },
    captureActionBoundary: async () => undefined,
    setLastError: (message) => {
      lastError = message;
    },
    onActivity: (_kind, label, _detail, tone) => {
      activities.push({ label, tone });
    },
    emitStatus: () => undefined,
    recordEvent: async () => undefined,
    stopRecording: async (notifyServer) => {
      stops.push(notifyServer);
    },
    disconnect: () => calls.push("facade.disconnect")
  };

  return {
    channel: new ServerCommandChannel(deps),
    calls,
    refusals,
    accepted,
    stops,
    snapshotLabels,
    activities,
    sent,
    runtimeStatus,
    lastError: () => lastError
  };
}

function serverMessage(message: object): ClientGatewayServerMessage {
  return message as ClientGatewayServerMessage;
}

function command(payload: object): ServerCommandPayload {
  return payload as ServerCommandPayload;
}

test("a refused recording start goes to the recording and leaves the socket healthy", async () => {
  const h = harness();
  await h.channel.handleMessage(serverMessage({
    type: "server.error",
    id: "m-1",
    payload: { code: "recording.project_required", message: "Open a project first." }
  }));
  assert.equal(h.refusals.length, 1);
  assert.equal(h.refusals[0]?.reason, "project_not_selected");
  assert.equal(h.lastError(), "Open a project first.");
  assert.equal(h.calls.includes("gateway.markFailed"), false);

  await h.channel.handleMessage(serverMessage({
    type: "server.error",
    id: "m-2",
    payload: { code: "gateway.internal", message: "Gateway fault." }
  }));
  assert.equal(h.refusals.length, 1, "any other server error is not a refusal");
  assert.equal(h.calls.includes("gateway.markFailed"), true);
  assert.equal(h.lastError(), "Gateway fault.");
});

test("stop and disconnect re-enter through the facade; an accepted start goes to the recording", async () => {
  const h = harness();
  await h.channel.handleCommand(command({ command: "stop_recording" }), "m-3");
  assert.deepEqual(h.stops, [false], "a stop FluxIQ sent is not reported back to it");

  await h.channel.handleCommand(command({ command: "disconnect" }), "m-4");
  await h.channel.handleMessage(serverMessage({ type: "server.disconnect", id: "m-5", payload: {} }));
  assert.equal(h.calls.filter((call) => call === "facade.disconnect").length, 2);

  await h.channel.handleCommand(command({ command: "start_recording", recordingId: "recording-1", projectId: "project-1" }), "m-6");
  assert.deepEqual(h.accepted, [["recording-1", "project-1"]]);
});

test("a snapshot command opens a runtime status and closes it as succeeded", async () => {
  const h = harness();
  await h.channel.handleCommand(command({ command: "capture_snapshot" }), "m-7");
  assert.equal(h.snapshotLabels.length, 1);
  const status = h.runtimeStatus.current();
  assert.equal(status.state, "succeeded");
  assert.equal(status.commandId, "m-7");
  assert.equal(status.actionType, "web.dom.capture_snapshot");
  assert.deepEqual(h.activities.map((activity) => activity.tone), ["warning", "success"]);
  assert.equal(h.activities[0]?.label, "Runtime started: Capture snapshot");
  assert.equal(h.lastError(), undefined, "a runtime start clears the previous error");
});

test("a session becoming ready persists it, then publishes browser state before flushing the queue", async () => {
  const h = harness();
  await h.channel.handleSessionReady(serverMessage({
    type: "server.session_ready",
    id: "m-8",
    payload: { sessionId: "session-1", token: "token-1", projectId: "project-1" }
  }) as Extract<ClientGatewayServerMessage, { type: "server.session_ready" }>);
  assert.deepEqual(h.calls, ["persistSession", "gateway.markSessionReady", "page.sendBrowserState", "gateway.flushQueue"]);
  assert.equal(h.activities.at(-1)?.label, "Connected to FluxIQ");
});

test("set_active_tab records the tab before asking the browser to activate it", async (t: TestContext) => {
  const h = harness();
  const updates: Array<[number, string[]]> = [];
  const holder = globalThis as { chrome?: unknown };
  const previous = holder.chrome;
  holder.chrome = {
    tabs: {
      update: async (tabId: number) => {
        updates.push([tabId, [...h.calls]]);
        return { id: tabId };
      }
    }
  };
  t.after(() => {
    holder.chrome = previous;
  });

  await h.channel.handleMessage(serverMessage({ type: "server.set_active_tab", id: "m-9", payload: { tabId: 11 } }));
  assert.equal(updates.length, 1);
  assert.equal(updates[0]?.[0], 11);
  assert.ok(updates[0]?.[1].includes("page.setTabId 11"), "the page already names the tab when the browser is asked");
});

type ResultReply = { sendActionResult(result: BrowserActionResult, tabId?: number, frameId?: number): Promise<void> };
type SentRecordingEvent = { metadata: { clientKind?: string; inputId?: string; runtimeConfirmation?: boolean }; payload: Record<string, unknown> };

// A command as `execute_action` delivers it. A tab action carries a request, so
// only its status can keep it from being confirmed.
function actionCommand(actionType: BrowserActionType, overrides: Partial<BrowserActionCommand> = {}): BrowserActionCommand {
  return {
    commandId: `c-${actionType}`,
    actionType,
    ...(actionType === "web.browser.tab" ? { tab: { operation: "close" } } : {}),
    ...overrides
  };
}

// Starts the action the way `execute_action` does, then replies on the path the
// runtime router calls with the action's result. The router itself is not run,
// so these rows need no browser.
async function finishAction(
  h: ReturnType<typeof harness>,
  action: BrowserActionCommand,
  result: Partial<BrowserActionResult> = {}
): Promise<SentRecordingEvent[]> {
  h.runtimeStatus.startAction(action);
  await (h.channel as unknown as ResultReply).sendActionResult({
    commandId: action.commandId,
    actionType: action.actionType,
    status: "succeeded",
    validation: { status: "none", reason: "not-yet-validated" },
    startedAt: 100,
    finishedAt: 150,
    element: { tagName: "input", selector: "#field", value: "entered" },
    ...result
  }, 3, 0);
  return h.sent.filter((message) => message.type === "client.recording_event").map((message) => message.payload as SentRecordingEvent);
}

test("an action that did not succeed replies with its result and sends no recording confirmation", async () => {
  for (const actionType of WEB_AUTOMATION_ACTION_TYPES) {
    for (const status of ["failed", "timed_out"] as const) {
      const h = harness();
      const confirmations = await finishAction(h, actionCommand(actionType), { status });
      assert.equal(h.sent.filter((message) => message.type === "client.action_result").length, 1, `${actionType}, ${status}: the result is sent`);
      assert.deepEqual(confirmations, [], `${actionType}, ${status}`);
    }
  }
});

test("a succeeded upload, tab switch or tab close is confirmed once, after its result, with no value", async () => {
  const rows: Array<[label: string, action: BrowserActionCommand, url: string, clientKind: string, inputId: string, tab: object | undefined]> = [
    ["an upload", actionCommand("web.dom.upload"), "https://shop.test/upload?token=abc", "dom.change", WEB_AUTOMATION_INPUT_IDS.filesChosen, undefined],
    [
      "a switch",
      actionCommand("web.browser.tab", { tab: { operation: "switch", urlPath: "/details" } }),
      "https://shop.test:8443/details?token=abc#top",
      "browser.tab",
      WEB_AUTOMATION_INPUT_IDS.tabSwitched,
      { operation: "switch", urlPath: "/details" }
    ],
    [
      "a close",
      actionCommand("web.browser.tab", { tab: { operation: "close" } }),
      "https://shop.test/list?token=abc",
      "browser.tab",
      WEB_AUTOMATION_INPUT_IDS.tabClosed,
      { operation: "close" }
    ]
  ];
  for (const [label, action, url, clientKind, inputId, tab] of rows) {
    const h = harness();
    const confirmations = await finishAction(h, action, { url });
    assert.deepEqual(h.sent.map((message) => message.type), ["client.action_result", "client.recording_event"], label);
    const [confirmation] = confirmations;
    assert.equal(confirmation?.metadata.inputId, inputId, label);
    assert.equal(confirmation?.metadata.clientKind, clientKind, label);
    assert.equal(confirmation?.metadata.runtimeConfirmation, true, label);
    assert.equal("inputValue" in (confirmation?.payload ?? {}), false, `${label}: no inputValue member`);
    if (tab === undefined) {
      assert.equal("tab" in (confirmation?.payload ?? {}), false, `${label}: no tab member`);
      continue;
    }
    // The stored payload's tab, in the recorded shape: no origin, port, query or fragment.
    assert.deepEqual(confirmation?.payload.tab, tab, label);
    assert.doesNotMatch(JSON.stringify(confirmation?.payload.tab), /shop\.test|8443|token|[?#]/u, label);
  }
});

test("a tab result is confirmed only with the request its own command started with", async () => {
  const h = harness();
  h.runtimeStatus.startAction(actionCommand("web.browser.tab", { commandId: "c-close", tab: { operation: "close" } }));
  await (h.channel as unknown as ResultReply).sendActionResult({
    commandId: "c-late",
    actionType: "web.browser.tab",
    status: "succeeded",
    validation: { status: "none", reason: "not-yet-validated" },
    startedAt: 100,
    finishedAt: 150
  }, 3);
  assert.deepEqual(h.sent.map((message) => message.type), ["client.action_result"], "another command's close is not this result's operation");
});
