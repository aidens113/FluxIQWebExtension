// Coverage of active-recording.ts: the transitions into and out of a recording
// as the facade drives them. The handshake's own retry policy is covered in
// recording-start/tests/handshake.test.ts; what is proven here is the wiring --
// that a start sends what FluxIQ expects on every attempt, that silence starts
// locally, that a refusal locks the recorder, and that stopping says so.

import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import type {
  ActivityEntry,
  ConnectionState,
  FluxIQSession,
  FluxIQSettings,
  RecordingEventPayload,
  TabDescriptor,
  UnsupportedPageState
} from "../../../shared/protocol";
import type { ActivePage } from "../active-page";
import { ActiveRecording, type ActiveRecordingDeps } from "../active-recording";
import { ActivityLog } from "../activity-log";
import type { ContentAttachment } from "../content-attachment";
import { EventSequence } from "../event-sequence";
import { NavigationRecorder } from "../navigation-recorder";
import { PointerClickFilter } from "../pointer-click-filter";
import type { ProjectContext } from "../project-context";
import type { RecordingEvidenceReporter } from "../recording-evidence";
import { classifyRecordingStartRefusal } from "../recording-start/index";

// Hand-driven timers, on the pattern handshake.test.ts uses.
function fakeTimers(t: TestContext) {
  const pending = new Map<number, { callback: () => void; delay: number }>();
  let nextId = 1;
  t.mock.method(globalThis, "setTimeout", (callback: () => void, delay = 0) => {
    const id = nextId;
    nextId += 1;
    pending.set(id, { callback, delay });
    return id;
  });
  t.mock.method(globalThis, "clearTimeout", (id: number) => {
    pending.delete(id);
  });
  return {
    delays: () => [...pending.values()].map((timer) => timer.delay),
    count: () => pending.size,
    fireAll: () => {
      const due = [...pending.values()];
      pending.clear();
      for (const timer of due) timer.callback();
    }
  };
}

// The start manifest describes the browser, which reads the extension manifest.
// Installed for one test and removed after it, so no other test sees a chrome.
function stubManifest(t: TestContext): void {
  const holder = globalThis as { chrome?: unknown };
  const previous = holder.chrome;
  holder.chrome = { runtime: { getManifest: () => ({ version: "0.0.0-test" }) } };
  t.after(() => {
    holder.chrome = previous;
  });
}

// Lets every promise chain the last call started run to completion.
async function settle(): Promise<void> {
  for (let turn = 0; turn < 20; turn += 1) await new Promise((resolve) => setImmediate(resolve));
}

type Sent = { type: string; payload: Record<string, unknown> };
type Activity = { kind: string; label: string; detail: string | undefined; tone: ActivityEntry["tone"] | undefined };

const STALE = classifyRecordingStartRefusal({
  code: "recording.project_required",
  message: "",
  metadata: { activeProjectId: "project-1" }
});
const NO_PROJECT = classifyRecordingStartRefusal({ code: "recording.project_required", message: "" });

function harness(options: {
  gatewayState?: ConnectionState;
  unsupported?: UnsupportedPageState;
  projectId?: string;
} = {}) {
  const settings = { gatewayUrl: "ws://gateway.test" } as FluxIQSettings;
  let session = { clientId: "client-1" } as FluxIQSession;
  let lastError: string | undefined;
  let activeProject: string | null | undefined;
  const sent: Sent[] = [];
  const activities: Activity[] = [];
  const recorded: Array<{ payload: RecordingEventPayload; tabId: number | undefined }> = [];
  const resolveReasons: string[] = [];
  const snapshots: string[] = [];
  const broadcasts: unknown[] = [];
  const attached: number[] = [];
  const tabs: TabDescriptor[] = [{ tabId: 7, url: "https://shop.test/cart" }];

  const page = {
    refresh: async () => undefined,
    unsupported: () => options.unsupported,
    url: () => "https://shop.test/cart",
    tabId: () => 7,
    sendBrowserState: async () => undefined
  } as unknown as ActivePage;
  const projects = {
    resolve: async (reason: string) => {
      resolveReasons.push(reason);
      return options.projectId;
    },
    current: () => options.projectId,
    activeRecordingProject: () => activeProject,
    setActiveRecordingProject: (projectId: string | null | undefined) => {
      activeProject = projectId;
    }
  } as unknown as ProjectContext;
  const evidence = {
    buildInitialRecordingState: async (timestamp: number) => ({ timestamp }),
    captureActiveSnapshot: async (label: string) => {
      snapshots.push(label);
    }
  } as unknown as RecordingEvidenceReporter;
  const attachment = {
    attachTabForRecording: async (tabId: number) => {
      attached.push(tabId);
    },
    broadcast: async (message: unknown) => {
      broadcasts.push(message);
    }
  } as unknown as ContentAttachment;

  const deps: ActiveRecordingDeps = {
    send: (async (type: string, payload: Record<string, unknown>) => {
      sent.push({ type, payload });
    }) as ActiveRecordingDeps["send"],
    gatewayState: () => options.gatewayState ?? "connected",
    session: () => session,
    settings: () => settings,
    persistSession: async (next) => {
      session = next;
    },
    page,
    projects,
    evidence,
    attachment,
    navigation: new NavigationRecorder(),
    clicks: new PointerClickFilter(),
    sequence: new EventSequence(),
    activityLog: new ActivityLog(),
    allTabs: async () => tabs,
    recordEvent: async (payload, tabId) => {
      recorded.push({ payload, tabId });
    },
    onActivity: (kind, label, detail, tone) => {
      activities.push({ kind, label, detail, tone });
    },
    emitStatus: () => undefined,
    lastError: () => lastError,
    setLastError: (message) => {
      lastError = message;
    }
  };

  return {
    recording: new ActiveRecording(deps),
    settings,
    sent,
    activities,
    recorded,
    resolveReasons,
    snapshots,
    broadcasts,
    attached,
    lastError: () => lastError,
    setLastError: deps.setLastError,
    session: () => session,
    activeProject: () => activeProject,
    labels: () => activities.map((activity) => activity.label)
  };
}

test("nothing is sent while disconnected, and an unsupported page refuses with its reason", async () => {
  const offline = harness({ gatewayState: "disconnected" });
  await offline.recording.start();
  assert.equal(offline.sent.length, 0);
  assert.equal(offline.lastError(), "Connect to FluxIQ before recording.");
  assert.equal(offline.recording.state(), "idle");

  const blocked = harness({ unsupported: { reason: "Browser pages cannot be recorded." } as UnsupportedPageState });
  await blocked.recording.start();
  assert.equal(blocked.sent.length, 0);
  assert.equal(blocked.lastError(), "Browser pages cannot be recorded.");
  assert.deepEqual(blocked.activities.at(-1), {
    kind: "page",
    label: "Page cannot be recorded",
    detail: "Browser pages cannot be recorded.",
    tone: "warning"
  });
});

test("a start sends the recording manifest once, and a second press waits for FluxIQ", async (t) => {
  stubManifest(t);
  const timers = fakeTimers(t);
  const h = harness({ projectId: "project-1" });

  await h.recording.start();
  await settle();
  assert.equal(h.sent.length, 1);
  const [start] = h.sent;
  assert.equal(start?.type, "client.start_recording");
  assert.match(String(start?.payload.recordingId), /^client\.client-1\.\d+$/);
  assert.equal(start?.payload.projectId, "project-1");
  assert.deepEqual(start?.payload.metadata, {
    domainId: start?.payload.domainId,
    requestedBy: "extension-record-button",
    projectId: "project-1",
    activeTabUrl: "https://shop.test/cart",
    startAttempt: 0
  });
  assert.deepEqual(h.resolveReasons, ["recording_start"]);
  assert.equal(timers.count(), 1, "the acceptance window is open");

  await h.recording.start();
  assert.equal(h.sent.length, 1, "a pending start is never sent twice");
  assert.equal(h.labels().at(-1), "Recording is starting");

  h.recording.cancelStart();
  assert.equal(timers.count(), 0, "cancelling closes the acceptance window");
  await h.recording.start();
  await settle();
  assert.equal(h.sent.length, 2, "once cancelled, the next press starts again");
});

test("silence begins the recording locally, with the tab event taking the facade's path", async (t) => {
  stubManifest(t);
  const timers = fakeTimers(t);
  const h = harness();

  await h.recording.start();
  await settle();
  const recordingId = String(h.sent[0]?.payload.recordingId);
  timers.fireAll();
  await settle();

  assert.equal(h.recording.state(), "recording");
  assert.equal(h.recording.recordingId(), recordingId);
  assert.deepEqual(h.resolveReasons, ["recording_start", "recording_start_timeout"]);
  assert.equal(h.recorded.length, 1);
  assert.equal(h.recorded[0]?.payload.kind, "browser.tab");
  assert.deepEqual(h.recorded[0]?.payload.metadata, { recordingState: "started", recordingId });
  assert.deepEqual(h.attached, [7]);
  assert.deepEqual(h.snapshots, ["Initial snapshot captured"]);
  assert.equal(h.activeProject(), null, "no project was resolved, and the session named none");
  assert.equal(h.labels().at(-1), "Project context pending");
});

test("a transient refusal is re-sent with a fresh project lookup; a persistent one locks the recorder", async (t) => {
  assert.ok(STALE && NO_PROJECT);
  stubManifest(t);
  const timers = fakeTimers(t);
  const h = harness({ projectId: "project-1" });

  await h.recording.start();
  await settle();
  h.recording.noteStartRefusal(STALE);
  assert.equal(h.labels().at(-1), "Recording start delayed");
  assert.match(String(h.activities.at(-1)?.detail), /Retrying in 400 ms \(1 of 3\)\.$/);
  assert.deepEqual(timers.delays(), [400]);

  timers.fireAll();
  await settle();
  assert.equal(h.sent.length, 2);
  assert.equal((h.sent[1]?.payload.metadata as Record<string, unknown>).startAttempt, 1);
  assert.deepEqual(h.resolveReasons, ["recording_start", "recording_start_retry"]);

  h.recording.noteStartRefusal(NO_PROJECT);
  assert.equal(h.recording.state(), "idle");
  assert.equal(timers.count(), 0, "a surfaced refusal leaves nothing armed");
  assert.deepEqual(h.recording.block(), {
    code: "recording.project_required",
    title: "Project Required",
    message: "Open a FluxIQ project in the web panel before starting a recording. (Retried 1 time.)"
  });
  assert.equal(h.lastError(), NO_PROJECT.lastError);
  assert.equal(h.labels().at(-1), "Recording locked");

  h.recording.dismissBlock();
  assert.equal(h.recording.block(), undefined);
  assert.equal(h.lastError(), undefined, "dismissing clears the refusal's own error");
});

test("dismissing a block leaves an unrelated error on the status line", () => {
  assert.ok(NO_PROJECT);
  const h = harness();
  h.recording.noteStartRefusal(NO_PROJECT);
  assert.ok(h.recording.block());
  h.setLastError("WebSocket connection failed.");
  h.recording.dismissBlock();
  assert.equal(h.recording.block(), undefined);
  assert.equal(h.lastError(), "WebSocket connection failed.");
});

test("an acceptance while recording only re-links the project; stopping reports the count", async () => {
  const h = harness();
  await h.recording.beginAccepted("recording-1", "project-1");
  assert.equal(h.recording.state(), "recording");
  assert.equal(h.session().projectId, "project-1", "the accepted project is persisted");
  assert.equal(h.recorded.length, 1);

  await h.recording.beginAccepted("recording-2", "project-2");
  assert.equal(h.recording.recordingId(), "recording-1", "a running recording keeps its id");
  assert.equal(h.activeProject(), "project-2");
  assert.deepEqual(h.snapshots, ["Initial snapshot captured", "Project-linked snapshot captured"]);
  assert.equal(h.recorded.length, 1, "no second start event");

  h.recording.noteEvent();
  h.recording.noteEvent();
  await h.recording.stop(true);
  assert.equal(h.recording.state(), "idle");
  const stop = h.sent.at(-1);
  assert.equal(stop?.type, "client.stop_recording");
  assert.equal(stop?.payload.recordingId, "recording-1");
  assert.equal(stop?.payload.projectId, "project-2");
  assert.equal(h.activities.at(-1)?.detail, "2 user actions captured");
  assert.deepEqual(h.broadcasts, [{ type: "recording", recording: false, settings: h.settings }]);

  await h.recording.beginAccepted("recording-3", null);
  const sentBefore = h.sent.length;
  await h.recording.stop(false);
  assert.equal(h.sent.length, sentBefore, "a stop FluxIQ asked for is not echoed back");
});

// C2 in i-recording-loss: FluxIQ acknowledges a client's start with
// `server.start_recording` for the same id. These rows stub the socket, so they
// hold whether or not FluxIQ sends that acknowledgement yet.
test("an acknowledgement inside the window starts the recording once, and the window never fires", async (t) => {
  stubManifest(t);
  const timers = fakeTimers(t);
  const h = harness({ projectId: "project-1" });

  await h.recording.start();
  await settle();
  const recordingId = String(h.sent[0]?.payload.recordingId);
  assert.equal(timers.count(), 1, "the acceptance window is open");

  await h.recording.beginAccepted(recordingId, "project-1");
  assert.equal(h.recording.state(), "recording");
  assert.equal(h.recording.recordingId(), recordingId);
  assert.equal(timers.count(), 0, "the acknowledgement closed the window");

  timers.fireAll();
  await settle();
  assert.deepEqual(h.resolveReasons, ["recording_start"], "no local start ran");
  assert.equal(h.recorded.length, 1, "one start event");
  assert.deepEqual(h.attached, [7]);
  assert.deepEqual(h.snapshots, ["Initial snapshot captured"]);
  assert.equal(h.labels().filter((label) => label === "Recording started").length, 1);
});

test("an acknowledgement after a local start changes nothing but the project link", async (t) => {
  stubManifest(t);
  const timers = fakeTimers(t);
  const h = harness();

  await h.recording.start();
  await settle();
  const recordingId = String(h.sent[0]?.payload.recordingId);
  timers.fireAll();
  await settle();
  assert.equal(h.recording.state(), "recording");
  assert.equal(h.activeProject(), null, "the local start found no project");
  h.recording.noteEvent();
  const sentBefore = h.sent.length;

  await h.recording.beginAccepted(recordingId, "project-1");
  assert.equal(h.recording.state(), "recording");
  assert.equal(h.recording.recordingId(), recordingId);
  assert.equal(h.recording.eventCount(), 1, "actions captured before the acknowledgement are kept");
  assert.equal(h.activeProject(), "project-1", "the acknowledgement links its project");
  assert.equal(h.session().projectId, "project-1");
  assert.equal(h.recorded.length, 1, "no second start event");
  assert.deepEqual(h.attached, [7], "the tab is not attached again");
  assert.deepEqual(h.snapshots, ["Initial snapshot captured", "Project-linked snapshot captured"]);
  assert.equal(h.sent.length, sentBefore, "nothing is sent back");

  await h.recording.beginAccepted(recordingId, "project-1");
  assert.equal(h.snapshots.length, 2, "the same acknowledgement again changes nothing");
});
