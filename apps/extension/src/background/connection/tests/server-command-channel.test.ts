// Coverage of server-command-channel.ts: where each server message and command
// goes. The load-bearing routes are the ones a mistake would hide -- a refused
// recording start must not fail a healthy socket, and a stop or disconnect must
// re-enter through the facade's public method rather than short-cut past it.

import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import type {
  ActivityEntry,
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
    send: (async () => undefined) as ServerCommandChannelDeps["send"],
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
