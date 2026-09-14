// Coverage of active-recording.ts: the transitions into and out of a recording
// as the facade drives them. The handshake's own retry policy is covered in
// recording-start/tests/handshake.test.ts; what is proven here is the wiring --
// that a start sends what FluxIQ expects on every attempt, that silence starts
// locally, that a refusal locks the recorder, and that stopping says so.

import assert from "node:assert/strict";
import { test } from "node:test";
import type { UnsupportedPageState } from "../../../shared/protocol";
import { RECORDING_START_PROJECT_LOOKUP_BOUND_MS } from "../active-recording";
import { RECORDING_START_ACCEPT_TIMEOUT_MS } from "../recording-start/index";
import { fakeTimers, harness, NO_PROJECT, settle, STALE, stubManifest } from "./active-recording-test-harness";

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
  h.recording.noteStartRefusal(STALE!);
  assert.equal(h.labels().at(-1), "Recording start delayed");
  assert.match(String(h.activities.at(-1)?.detail), /Retrying in 400 ms \(1 of 3\)\.$/);
  assert.deepEqual(timers.delays(), [400]);

  timers.fireAll();
  await settle();
  assert.equal(h.sent.length, 2);
  assert.equal((h.sent[1]?.payload.metadata as Record<string, unknown>).startAttempt, 1);
  assert.deepEqual(h.resolveReasons, ["recording_start", "recording_start_retry"]);

  h.recording.noteStartRefusal(NO_PROJECT!);
  assert.equal(h.recording.state(), "idle");
  assert.deepEqual(h.scriptedNavigationCancellations, [], "an idle refused start has no recording intent to cancel");
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
  h.recording.noteStartRefusal(NO_PROJECT!);
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

  await h.recording.beginAccepted("recording-1", "project-2");
  assert.equal(h.recording.recordingId(), "recording-1", "a running recording keeps its id");
  assert.equal(h.activeProject(), "project-2", "FluxIQ's project for the same recording is linked");
  assert.deepEqual(h.snapshots, ["Initial snapshot captured", "Project-linked snapshot captured"]);
  assert.equal(h.recorded.length, 1, "no second start event");

  h.recording.noteEvent();
  h.recording.noteEvent();
  await h.recording.stop(true);
  assert.equal(h.recording.state(), "idle");
  assert.equal(h.scriptedNavigationCancellations.at(-1), "recording_stopped");
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

test("a refusal received while recording cancels scripted navigation before becoming idle", async () => {
  const h = harness();
  await h.recording.beginAccepted("recording-1", "project-1");
  h.recording.noteStartRefusal(NO_PROJECT!);
  assert.equal(h.recording.state(), "idle");
  assert.equal(h.scriptedNavigationCancellations.at(-1), "recording_stopped");
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

// The race `f-recording-start-send` probed: FluxIQ's acknowledgement lands while
// the local start is still looking its project up.
test("an acknowledgement while the local start is under way starts the recording once, then links its project", async (t) => {
  stubManifest(t);
  const timers = fakeTimers(t);
  const h = harness();

  await h.recording.start();
  await settle();
  const recordingId = String(h.sent[0]?.payload.recordingId);
  timers.fireAll();
  assert.deepEqual(h.resolveReasons, ["recording_start", "recording_start_timeout"], "the local start is under way");
  await h.recording.beginAccepted(recordingId, "project-1");
  await settle();

  assert.equal(h.recording.state(), "recording");
  assert.equal(h.recording.recordingId(), recordingId);
  assert.equal(h.recorded.length, 1, "one start event");
  assert.equal(h.labels().filter((label) => label === "Recording started").length, 1);
  assert.deepEqual(h.attached, [7], "the tab is attached once");
  assert.deepEqual(h.snapshots, ["Initial snapshot captured", "Project-linked snapshot captured"]);
  assert.equal(h.activeProject(), "project-1", "the local start's missing project does not replace FluxIQ's");
  assert.equal(h.session().projectId, "project-1");
});

test("a repeated acknowledgement while the first is still starting the recording starts it once", async () => {
  const h = harness();
  const first = h.recording.beginAccepted("recording-1", "project-1");
  const second = h.recording.beginAccepted("recording-1", "project-1");
  await Promise.all([first, second]);
  assert.equal(h.recorded.length, 1, "one start event");
  assert.deepEqual(h.attached, [7]);
  assert.deepEqual(h.snapshots, ["Initial snapshot captured"], "the same project needs no second link");
});

test("an acknowledgement naming another recording is ignored while a start is pending, under way or running", async (t) => {
  stubManifest(t);
  const timers = fakeTimers(t);
  const h = harness();

  await h.recording.start();
  await settle();
  const recordingId = String(h.sent[0]?.payload.recordingId);
  await h.recording.beginAccepted("recording-other", "project-2");
  assert.equal(h.recording.state(), "idle", "it does not answer the pending start");
  assert.equal(timers.count(), 1, "the acceptance window is still open");
  assert.equal(h.session().projectId, undefined, "and its project is not persisted");
  assert.equal(h.labels().at(-1), "Recording start ignored");

  timers.fireAll();
  await h.recording.beginAccepted("recording-other", "project-2");
  await settle();
  assert.equal(h.recording.recordingId(), recordingId, "nor the start under way");
  assert.equal(h.recorded.length, 1);

  await h.recording.beginAccepted("recording-other", "project-2");
  assert.equal(h.recording.recordingId(), recordingId, "nor the running recording");
  assert.equal(h.activeProject(), null, "whose project link is untouched");
  assert.deepEqual(h.snapshots, ["Initial snapshot captured"]);
});

// g-core-start-order: FluxIQ sends no acknowledgement once a Stop has reached
// it, but one already on the wire can still cross the client's Stop.
test("an acknowledgement that crosses the client's own Stop does not restart the recording", async (t) => {
  stubManifest(t);
  const timers = fakeTimers(t);
  const h = harness();

  await h.recording.start();
  await settle();
  const recordingId = String(h.sent[0]?.payload.recordingId);
  timers.fireAll();
  await settle();
  assert.equal(h.recording.state(), "recording");

  const stopping = h.recording.stop(true);
  await h.recording.beginAccepted(recordingId, "project-1");
  await stopping;
  assert.equal(h.recording.state(), "idle", "an acknowledgement while the stop is being sent does not restart it");
  await h.recording.beginAccepted(recordingId, "project-1");
  await settle();
  assert.equal(h.recording.state(), "idle", "nor one arriving after the stop was sent");
  assert.equal(h.recorded.length, 1, "the only start event is the local start's");
  assert.deepEqual(h.attached, [7]);
  assert.equal(h.sent.at(-1)?.type, "client.stop_recording", "and nothing follows the stop");
  assert.equal(h.labels().at(-1), "Recording start ignored");
});

test("a stalled project lookup holds a start for its bound, then the local fallback begins without a project", async (t) => {
  stubManifest(t);
  const timers = fakeTimers(t);
  let stalled = true;
  const h = harness({ lookup: () => (stalled ? new Promise<undefined>(() => undefined) : Promise.resolve(undefined)) });

  const pressed = h.recording.start();
  await settle();
  assert.equal(h.sent.length, 0, "the lookup holds the send");
  assert.deepEqual(timers.delays(), [RECORDING_START_ACCEPT_TIMEOUT_MS, RECORDING_START_PROJECT_LOOKUP_BOUND_MS]);

  timers.fire(RECORDING_START_ACCEPT_TIMEOUT_MS);
  await settle();
  assert.equal(h.recording.state(), "idle", "the window elapsed, but nothing records ahead of the unsent start");

  timers.fire(RECORDING_START_PROJECT_LOOKUP_BOUND_MS);
  await settle();
  assert.equal(h.sent.length, 1, "at the bound the start is sent without a project");
  assert.equal(h.sent[0]?.payload.projectId, undefined);
  assert.equal((h.sent[0]?.payload.metadata as Record<string, unknown>).projectId, null);
  assert.equal(h.recording.state(), "recording", "and the local fallback begins");
  assert.equal(h.recording.recordingId(), h.sent[0]?.payload.recordingId);
  assert.deepEqual(h.resolveReasons, ["recording_start"], "without waiting on the stalled lookup a second time");
  assert.equal(h.activeProject(), null);
  assert.ok(h.labels().includes("Project lookup timed out"));
  assert.equal(timers.count(), 0, "nothing is left armed");

  // A lookup that gave up once is not skipped for good: the next start looks again.
  stalled = false;
  await h.recording.stop(false);
  await h.recording.start();
  await settle();
  assert.deepEqual(h.resolveReasons, ["recording_start", "recording_start"]);
});
