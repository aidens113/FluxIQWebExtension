// Stop, navigation, and start-crossing lifecycle coverage for active-recording.ts.

import assert from "node:assert/strict";
import { test } from "node:test";
import type { TabDescriptor } from "../../../shared/protocol";
import { NavigationRecorder } from "../navigation-recorder";
import { fakeTimers, harness, NO_PROJECT, settle, STALE, stubManifest } from "./active-recording-test-harness";

test("stop flushes a pending navigation while the recording is active before notifying FluxIQ", async () => {
  const navigation = new NavigationRecorder();
  const order: string[] = [];
  let releaseLanding: () => void = () => undefined;
  const landingGate = new Promise<void>((resolve) => { releaseLanding = resolve; });
  const h = harness({
    navigation,
    send: async (type) => {
      if (type === "client.stop_recording") order.push("stop");
    }
  });
  await h.recording.beginAccepted("recording-1", "project-1");
  navigation.schedule(7, "https://shop.test/account", async () => {
    assert.equal(h.recording.state(), "recording", "the landing settles before the state becomes idle");
    order.push("landing-started");
    await landingGate;
    order.push("landing-sent");
  });

  const stopping = h.recording.stop(true);
  assert.equal(h.recording.acceptsEvents(), false, "the stop closes admission before its drain awaits");
  await Promise.resolve();
  assert.equal(h.recording.state(), "recording");
  assert.deepEqual(order, ["landing-started"]);
  releaseLanding();
  await stopping;
  assert.deepEqual(order, ["landing-started", "landing-sent", "stop"]);
  assert.equal(h.recording.state(), "idle");
});

test("concurrent notifying stops share one teardown and send one stop", async () => {
  const navigation = new NavigationRecorder();
  let releaseLanding: () => void = () => undefined;
  const landingGate = new Promise<void>((resolve) => { releaseLanding = resolve; });
  const h = harness({ navigation });
  await h.recording.beginAccepted("recording-1", "project-1");
  navigation.schedule(7, "https://shop.test/account", () => landingGate);

  const first = h.recording.stop(true);
  const second = h.recording.stop(true);
  assert.equal(first, second, "both callers receive the single in-flight stop");
  assert.equal(h.recording.acceptsEvents(), false);
  releaseLanding();
  await Promise.all([first, second]);

  assert.equal(h.sent.filter((message) => message.type === "client.stop_recording").length, 1);
  assert.equal(h.activities.filter((activity) => activity.label === "Recording stopped").length, 1);
  assert.equal(h.broadcasts.length, 1);
});

test("Stop cancels held UI preflight before it can send a start", async (t) => {
  stubManifest(t);
  fakeTimers(t);
  let releasePreflight: () => void = () => undefined;
  const preflightGate = new Promise<void>((resolve) => { releasePreflight = resolve; });
  let notePreflight: () => void = () => undefined;
  const preflightEntered = new Promise<void>((resolve) => { notePreflight = resolve; });
  const h = harness({
    initialState: async (timestamp) => {
      notePreflight();
      await preflightGate;
      return { timestamp };
    }
  });

  const starting = h.recording.start();
  await preflightEntered;
  const stopping = h.recording.stop(true);
  assert.equal(h.recording.stop(false), stopping, "crossing Stops share the preflight cancellation owner");
  releasePreflight();
  await Promise.all([starting, stopping]);

  assert.equal(h.recording.state(), "idle");
  assert.deepEqual(h.sent, [], "a safely cancelled preflight needs neither start nor stop on the wire");
  assert.equal(h.recorded.length, 0);
});

test("Start A then Stop then Start B detaches A and runs B only after Stop", async (t) => {
  stubManifest(t);
  const timers = fakeTimers(t);
  let preflightCount = 0;
  let releaseA: () => void = () => undefined;
  const heldA = new Promise<void>((resolve) => { releaseA = resolve; });
  let noteA: () => void = () => undefined;
  const aEntered = new Promise<void>((resolve) => { noteA = resolve; });
  const h = harness({
    initialState: async (timestamp) => {
      preflightCount += 1;
      if (preflightCount === 1) {
        noteA();
        await heldA;
      }
      return { timestamp };
    }
  });

  const startA = h.recording.start();
  await aEntered;
  const stopping = h.recording.stop(true);
  const startB = h.recording.start();
  assert.notEqual(startB, startA, "B owns a distinct public UI request");
  await settle();
  assert.equal(preflightCount, 1, "B waits behind Stop rather than entering preflight");
  assert.equal(h.sent.filter((message) => message.type === "client.start_recording").length, 0);

  releaseA();
  await Promise.all([startA, stopping]);
  await startB;
  const starts = h.sent.filter((message) => message.type === "client.start_recording");
  assert.equal(starts.length, 1, "only B reaches the client handshake");
  const recordingId = String(starts[0]?.payload.recordingId);
  await h.recording.beginAccepted(recordingId, "project-1");

  assert.equal(h.recording.recordingId(), recordingId);
  assert.deepEqual(h.recorded.map((entry) => entry.payload.metadata), [
    { recordingState: "started", recordingId }
  ]);
  assert.equal(timers.count(), 0);
});

test("Stop closes a pending client handshake once and a late acceptance cannot revive it", async (t) => {
  stubManifest(t);
  const timers = fakeTimers(t);
  const h = harness();
  await h.recording.start();
  const recordingId = String(h.sent[0]?.payload.recordingId);

  const stopping = h.recording.stop(true);
  assert.equal(h.recording.stop(true), stopping, "pending-handshake Stops are single-flight");
  await stopping;
  await h.recording.beginAccepted(recordingId, "project-1");

  assert.equal(h.recording.state(), "idle");
  assert.deepEqual(h.sent.map((message) => message.type), ["client.start_recording", "client.stop_recording"]);
  assert.equal(h.recorded.length, 0);
  assert.equal(timers.count(), 0, "cancelling the handshake removes its fallback window");
  assert.equal(h.labels().at(-1), "Recording start ignored");
});

test("Stop drains an in-flight retry send before placing its close", async (t) => {
  stubManifest(t);
  const timers = fakeTimers(t);
  let lookupCount = 0;
  let releaseRetryLookup: () => void = () => undefined;
  const retryLookupGate = new Promise<undefined>((resolve) => { releaseRetryLookup = () => resolve(undefined); });
  const h = harness({
    lookup: async () => {
      lookupCount += 1;
      return lookupCount === 1 ? undefined : retryLookupGate;
    }
  });
  await h.recording.start();
  h.recording.noteStartRefusal(STALE!);
  timers.fire(400);
  await settle();

  const stopping = h.recording.stop(true);
  await settle();
  assert.deepEqual(h.sent.map((message) => message.type), ["client.start_recording"], "the close waits behind the retry send");
  releaseRetryLookup();
  await stopping;

  assert.deepEqual(h.sent.map((message) => message.type), [
    "client.start_recording",
    "client.start_recording",
    "client.stop_recording"
  ]);
  assert.equal(h.recording.state(), "idle");
  assert.equal(timers.count(), 0);
});

test("Stop waits for a server start held in persistence, preserves its marker, then tears it down", async () => {
  let releasePersist: () => void = () => undefined;
  const persistGate = new Promise<void>((resolve) => { releasePersist = resolve; });
  let notePersist: () => void = () => undefined;
  const persistEntered = new Promise<void>((resolve) => { notePersist = resolve; });
  const h = harness({
    persist: async () => {
      notePersist();
      await persistGate;
    }
  });

  const starting = h.recording.beginAccepted("recording-server", "project-1");
  await persistEntered;
  const stopping = h.recording.stop(true);
  assert.equal(h.recording.stop(false), stopping);
  let stopSettled = false;
  void stopping.then(() => { stopSettled = true; });
  await settle();
  assert.equal(stopSettled, false, "Stop cannot settle ahead of the accepted start");
  assert.equal(h.recording.acceptsEvents(), false, "ordinary events are fenced during the crossing");

  releasePersist();
  await Promise.all([starting, stopping]);
  assert.equal(h.recording.state(), "idle");
  assert.deepEqual(h.recorded.map((entry) => entry.payload.metadata), [
    { recordingState: "started", recordingId: "recording-server" }
  ]);
  assert.deepEqual(h.sent.map((message) => message.type), ["client.stop_recording"]);
  assert.equal(h.labels().filter((label) => label === "Recording stopped").length, 1);
});

test("a UI start requested behind a Stop waiting on an accepted start runs only after teardown", async (t) => {
  stubManifest(t);
  fakeTimers(t);
  let releasePersist: () => void = () => undefined;
  const persistGate = new Promise<void>((resolve) => { releasePersist = resolve; });
  let holdServerStart = true;
  const h = harness({
    persist: async () => {
      if (holdServerStart) await persistGate;
    }
  });

  const serverStart = h.recording.beginAccepted("recording-server", "project-1");
  await settle();
  const stopping = h.recording.stop(false);
  const queuedUiStart = h.recording.start();
  await settle();
  assert.equal(h.sent.filter((message) => message.type === "client.start_recording").length, 0);

  holdServerStart = false;
  releasePersist();
  await Promise.all([serverStart, stopping, queuedUiStart]);
  const starts = h.sent.filter((message) => message.type === "client.start_recording");
  assert.equal(starts.length, 1, "the later UI request starts after the older accepted recording is stopped");
  const recordingId = String(starts[0]?.payload.recordingId);
  await h.recording.beginAccepted(recordingId, "project-2");
  assert.equal(h.recording.recordingId(), recordingId);
});

test("Stop waits for a server start held in tab discovery before closing it", async () => {
  let releaseTabs: () => void = () => undefined;
  const tabsGate = new Promise<TabDescriptor[]>((resolve) => {
    releaseTabs = () => resolve([{ tabId: 7, url: "https://shop.test/cart" }]);
  });
  const h = harness({ allTabs: () => tabsGate });

  const starting = h.recording.beginAccepted("recording-server", "project-1");
  await settle();
  const stopping = h.recording.stop(true);
  releaseTabs();
  await Promise.all([starting, stopping]);

  assert.equal(h.recording.state(), "idle");
  assert.equal(h.recorded.length, 1, "the accepted start publishes its one initial marker");
  assert.equal(h.sent.filter((message) => message.type === "client.stop_recording").length, 1);
});

test("a rejected pending start cannot strand or reject its crossing Stop", async (t) => {
  stubManifest(t);
  fakeTimers(t);
  let rejectStart: (error: Error) => void = () => undefined;
  const sendGate = new Promise<void>((_resolve, reject) => { rejectStart = reject; });
  const h = harness({
    send: async (type) => {
      if (type === "client.start_recording") await sendGate;
    }
  });

  const starting = h.recording.start();
  await settle();
  const stopping = h.recording.stop(true);
  rejectStart(new Error("start send failed"));
  await assert.rejects(starting, /start send failed/);
  await stopping;

  assert.equal(h.recording.state(), "idle");
  assert.deepEqual(h.sent.map((message) => message.type), ["client.start_recording", "client.stop_recording"]);
});

test("a new Stop can cancel UI work released behind an older Stop without deadlock", async () => {
  const navigation = new NavigationRecorder();
  let releaseLanding: () => void = () => undefined;
  const landingGate = new Promise<void>((resolve) => { releaseLanding = resolve; });
  const h = harness({ navigation });
  await h.recording.beginAccepted("recording-old", "project-1");
  navigation.schedule(7, "https://shop.test/account", () => landingGate);

  const oldStop = h.recording.stop(false);
  const uiStart = h.recording.start();
  let newStop: Promise<void> | undefined;
  const crossing = oldStop.then(async () => {
    newStop = h.recording.stop(true);
    await newStop;
  });
  releaseLanding();
  await Promise.all([oldStop, uiStart, crossing]);

  assert.ok(newStop, "the later Stop was installed");
  assert.equal(h.recording.state(), "idle");
  assert.equal(h.sent.filter((message) => message.type === "client.start_recording").length, 0);
});

test("the stop token is gone before the public stop promise settles", async () => {
  const navigation = new NavigationRecorder();
  let releaseLanding: () => void = () => undefined;
  const landingGate = new Promise<void>((resolve) => { releaseLanding = resolve; });
  const h = harness({ navigation });
  await h.recording.beginAccepted("recording-1", "project-1");
  navigation.schedule(7, "https://shop.test/account", () => landingGate);

  const stopping = h.recording.stop(false);
  const observed = stopping.then(() => {
    const idleStop = h.recording.stop(false);
    assert.notEqual(idleStop, stopping, "an idle stop does not find the completed operation still installed");
  });
  releaseLanding();
  await observed;
});

test("a server and UI stop crossing share whichever notification decision established the boundary", async () => {
  for (const firstNotifies of [false, true]) {
    const navigation = new NavigationRecorder();
    let releaseLanding: () => void = () => undefined;
    const landingGate = new Promise<void>((resolve) => { releaseLanding = resolve; });
    const h = harness({ navigation });
    await h.recording.beginAccepted(`recording-${String(firstNotifies)}`, "project-1");
    navigation.schedule(7, "https://shop.test/account", () => landingGate);

    const first = h.recording.stop(firstNotifies);
    const crossing = h.recording.stop(!firstNotifies);
    assert.equal(crossing, first);
    releaseLanding();
    await crossing;
    assert.equal(h.sent.filter((message) => message.type === "client.stop_recording").length, firstNotifies ? 1 : 0);
  }
});

test("simultaneous UI starts wait for an old drain, then create and begin one new recording", async (t) => {
  stubManifest(t);
  const timers = fakeTimers(t);
  const navigation = new NavigationRecorder();
  let releaseLanding: () => void = () => undefined;
  const landingGate = new Promise<void>((resolve) => { releaseLanding = resolve; });
  const callbackRecordingIds: Array<string | undefined> = [];
  const h = harness({ navigation });
  await h.recording.beginAccepted("recording-old", "project-1");
  navigation.schedule(7, "https://shop.test/account", async () => {
    await landingGate;
    callbackRecordingIds.push(h.recording.recordingId());
  });

  const stopping = h.recording.stop(false);
  const firstStart = h.recording.start();
  const secondStart = h.recording.start();
  assert.equal(firstStart, secondStart, "UI starts crossing the same Stop are single-flight before the handshake exists");
  await settle();
  assert.equal(h.sent.filter((message) => message.type === "client.start_recording").length, 0);

  releaseLanding();
  await stopping;
  await Promise.all([firstStart, secondStart]);
  const starts = h.sent.filter((message) => message.type === "client.start_recording");
  assert.equal(starts.length, 1);
  const newRecordingId = String(starts[0]?.payload.recordingId);
  await h.recording.beginAccepted(newRecordingId, "project-2");

  assert.deepEqual(callbackRecordingIds, ["recording-old"], "the old admitted callback settles before the new identity exists");
  assert.equal(h.recording.recordingId(), newRecordingId);
  assert.equal(h.labels().filter((label) => label === "Recording started").length, 2, "old and new each start once");
  assert.deepEqual(h.recorded.map((entry) => entry.payload.metadata), [
    { recordingState: "started", recordingId: "recording-old" },
    { recordingState: "started", recordingId: newRecordingId }
  ]);
  assert.equal(timers.count(), 0, "accepting the sole handshake closes its timer");
});

test("a server start wins while released UI preflight is held, with one new identity and no client start", async (t) => {
  stubManifest(t);
  fakeTimers(t);
  const navigation = new NavigationRecorder();
  let releaseDrain: () => void = () => undefined;
  const drainGate = new Promise<void>((resolve) => { releaseDrain = resolve; });
  let releasePreflight: () => void = () => undefined;
  const preflightGate = new Promise<void>((resolve) => { releasePreflight = resolve; });
  let notePreflight: () => void = () => undefined;
  const preflightEntered = new Promise<void>((resolve) => { notePreflight = resolve; });
  let releaseServerStart: () => void = () => undefined;
  const serverStartGate = new Promise<void>((resolve) => { releaseServerStart = resolve; });
  let noteServerStart: () => void = () => undefined;
  const serverStartEntered = new Promise<void>((resolve) => { noteServerStart = resolve; });
  const h = harness({
    navigation,
    initialState: async (timestamp) => {
      notePreflight();
      await preflightGate;
      return { timestamp };
    },
    persist: async (session) => {
      if (session.projectId !== "project-2") return;
      noteServerStart();
      await serverStartGate;
    }
  });
  await h.recording.beginAccepted("recording-old", "project-1");
  navigation.schedule(7, "https://shop.test/account", () => drainGate);

  const stopping = h.recording.stop(false);
  const uiStart = h.recording.start();
  const serverStart = h.recording.beginAccepted("recording-server", "project-2");
  releaseDrain();
  await stopping;
  await preflightEntered;
  await serverStartEntered;
  releasePreflight();
  await settle();
  assert.equal(h.sent.filter((message) => message.type === "client.start_recording").length, 0, "UI waits while the server identity owns starting");
  releaseServerStart();
  await serverStart;
  await uiStart;

  assert.equal(h.recording.recordingId(), "recording-server");
  assert.equal(h.sent.filter((message) => message.type === "client.start_recording").length, 0);
  assert.deepEqual(h.recorded.map((entry) => entry.payload.metadata), [
    { recordingState: "started", recordingId: "recording-old" },
    { recordingState: "started", recordingId: "recording-server" }
  ]);
});

test("a UI start wins before a distinct server start, with one client start and one new initial event", async (t) => {
  stubManifest(t);
  const timers = fakeTimers(t);
  const navigation = new NavigationRecorder();
  let releaseDrain: () => void = () => undefined;
  const drainGate = new Promise<void>((resolve) => { releaseDrain = resolve; });
  let releasePreflight: () => void = () => undefined;
  const preflightGate = new Promise<void>((resolve) => { releasePreflight = resolve; });
  let notePreflight: () => void = () => undefined;
  const preflightEntered = new Promise<void>((resolve) => { notePreflight = resolve; });
  const h = harness({
    navigation,
    initialState: async (timestamp) => {
      notePreflight();
      await preflightGate;
      return { timestamp };
    }
  });
  await h.recording.beginAccepted("recording-old", "project-1");
  navigation.schedule(7, "https://shop.test/account", () => drainGate);

  const stopping = h.recording.stop(false);
  const uiStart = h.recording.start();
  releaseDrain();
  await stopping;
  await preflightEntered;
  releasePreflight();
  await uiStart;
  const starts = h.sent.filter((message) => message.type === "client.start_recording");
  assert.equal(starts.length, 1);
  const uiRecordingId = String(starts[0]?.payload.recordingId);

  await h.recording.beginAccepted("recording-server", "project-2");
  assert.equal(h.recording.recordingId(), undefined, "a distinct server identity cannot displace the pending UI handshake");
  await h.recording.beginAccepted(uiRecordingId, "project-1");
  assert.equal(h.recording.recordingId(), uiRecordingId);
  assert.deepEqual(h.recorded.map((entry) => entry.payload.metadata), [
    { recordingState: "started", recordingId: "recording-old" },
    { recordingState: "started", recordingId: uiRecordingId }
  ]);
  assert.equal(timers.count(), 0);
});

test("a server start waits for a failing old stop, then keeps its initial tab event", async () => {
  let rejectStopSend: (error: Error) => void = () => undefined;
  const stopSendGate = new Promise<void>((_resolve, reject) => { rejectStopSend = reject; });
  const h = harness({
    send: async (type) => {
      if (type === "client.stop_recording") await stopSendGate;
    }
  });
  await h.recording.beginAccepted("recording-old", "project-1");
  const stopping = h.recording.stop(true);
  const stopFailure = assert.rejects(stopping, /old stop send failed/);
  await settle();
  assert.equal(h.recording.state(), "idle", "teardown precedes the held notifying send");

  const accepted = h.recording.beginAccepted("recording-new", "project-2");
  await settle();
  assert.equal(h.recording.recordingId(), undefined, "the new identity waits for public stop settlement");
  rejectStopSend(new Error("old stop send failed"));
  await stopFailure;
  await accepted;

  assert.equal(h.recording.recordingId(), "recording-new");
  assert.deepEqual(h.recorded.map((entry) => entry.payload.metadata), [
    { recordingState: "started", recordingId: "recording-old" },
    { recordingState: "started", recordingId: "recording-new" }
  ]);
});

test("a refusal crossing an active stop cannot mutate its state or install a block", async () => {
  assert.ok(NO_PROJECT);
  const navigation = new NavigationRecorder();
  let releaseLanding: () => void = () => undefined;
  const landingGate = new Promise<void>((resolve) => { releaseLanding = resolve; });
  const h = harness({ navigation });
  await h.recording.beginAccepted("recording-old", "project-1");
  navigation.schedule(7, "https://shop.test/account", () => landingGate);

  const stopping = h.recording.stop(false);
  h.recording.noteStartRefusal(NO_PROJECT!);
  assert.equal(h.recording.state(), "recording", "the stop owner keeps teardown state until its drain settles");
  assert.equal(h.recording.block(), undefined);
  assert.equal(h.labels().includes("Recording locked"), false);
  releaseLanding();
  await stopping;
  assert.equal(h.recording.state(), "idle");
});

test("a rejected landing still closes and notifies the recording, then reports the landing failure", async () => {
  const navigation = new NavigationRecorder();
  const h = harness({ navigation });
  await h.recording.beginAccepted("recording-1", "project-1");
  navigation.schedule(7, "https://shop.test/account", async () => {
    throw new Error("landing send failed");
  });

  await assert.rejects(h.recording.stop(true), /landing send failed/);
  assert.equal(h.recording.state(), "idle");
  assert.equal(h.sent.at(-1)?.type, "client.stop_recording", "a failed landing does not strand FluxIQ's recording open");
});
