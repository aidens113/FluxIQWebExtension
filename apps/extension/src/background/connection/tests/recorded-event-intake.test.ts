// Coverage of recorded-event-intake.ts: the funnel every recorded event passes
// through. A pointerdown and its click are one action; an executable action is
// counted and sent with the recording's id; passive evidence is not; and an
// event this module derives -- a navigation, a content-ready page -- re-enters
// through the facade's public path.

import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import type { ActivityEntry, RecordingEventPayload, RecordingState } from "../../../shared/protocol";
import type { ActivePage } from "../active-page";
import type { ActiveRecording } from "../active-recording";
import type { ContentAttachment } from "../content-attachment";
import { EventSequence } from "../event-sequence";
import type { NavigationRecorder } from "../navigation-recorder";
import { PointerClickFilter } from "../pointer-click-filter";
import { RecordedEventIntake, type RecordedEventIntakeDeps } from "../recorded-event-intake";
import type { RecordingEvidenceReporter } from "../recording-evidence";

// The click filter clears a suppression on a timer; keep it off the real clock.
function holdTimers(t: TestContext): void {
  t.mock.method(globalThis, "setTimeout", () => 0);
  t.mock.method(globalThis, "clearTimeout", () => undefined);
}

function harness(state: RecordingState = "recording") {
  let recordingState = state;
  let counted = 0;
  const sent: Array<{ type: string; payload: Record<string, unknown> }> = [];
  const evidenceKinds: string[] = [];
  const activities: Array<{ kind: string; label: string; tone: ActivityEntry["tone"] | undefined }> = [];
  const reentered: Array<{ payload: RecordingEventPayload; tabId: number | undefined; frameId: number | undefined }> = [];
  const recordingStates: Array<[number, boolean, number | undefined]> = [];
  const scheduled: string[] = [];

  const recording = {
    state: () => recordingState,
    startedAt: () => 0,
    recordingId: () => "recording-1",
    noteEvent: () => {
      counted += 1;
    }
  } as unknown as ActiveRecording;
  const evidence = {
    captureEventSnapshot: async () => ({ snapshot: undefined }),
    sendRecordingEvidence: async (payload: RecordingEventPayload) => {
      evidenceKinds.push(payload.kind);
    }
  } as unknown as RecordingEvidenceReporter;
  const navigation = {
    noteExplanatoryAction: () => undefined,
    schedule: (_tabId: number, url: string, record: () => void) => {
      scheduled.push(url);
      record();
    },
    shouldRecord: () => true
  } as unknown as NavigationRecorder;
  const attachment = {
    setRecordingState: async (tabId: number, recordingOn: boolean, frameId?: number) => {
      recordingStates.push([tabId, recordingOn, frameId]);
    }
  } as unknown as ContentAttachment;

  const deps: RecordedEventIntakeDeps = {
    send: (async (type: string, payload: Record<string, unknown>) => {
      sent.push({ type, payload });
    }) as RecordedEventIntakeDeps["send"],
    recording,
    page: { unsupported: () => undefined } as unknown as ActivePage,
    navigation,
    clicks: new PointerClickFilter(),
    sequence: new EventSequence(),
    evidence,
    attachment,
    sendToTab: (async () => undefined) as RecordedEventIntakeDeps["sendToTab"],
    onActivity: (kind, label, _detail, tone) => {
      activities.push({ kind, label, tone });
    },
    recordEvent: async (payload, tabId, frameId) => {
      reentered.push({ payload, tabId, frameId });
    }
  };

  return {
    intake: new RecordedEventIntake(deps),
    sent,
    evidenceKinds,
    activities,
    reentered,
    recordingStates,
    scheduled,
    counted: () => counted,
    stop: () => {
      recordingState = "idle";
    }
  };
}

function click(sourceEvent: string, sequence: number): RecordingEventPayload {
  return {
    kind: "dom.click",
    sequence,
    url: "https://shop.test/",
    title: "Shop",
    eventTimestampMs: 1_000 + sequence,
    element: { selector: "#buy", tagName: "button", text: "Buy" },
    metadata: { sourceEvent }
  } as RecordingEventPayload;
}

test("nothing is taken in while no recording is running", async () => {
  const h = harness("idle");
  await h.intake.accept(click("pointerdown", 1), 1, 0);
  assert.deepEqual(h.sent, []);
  assert.deepEqual(h.evidenceKinds, []);
  assert.equal(h.counted(), 0);
});

test("a pointerdown is recorded once, and the click that follows it is dropped", async (t) => {
  holdTimers(t);
  const h = harness();
  await h.intake.accept(click("pointerdown", 1), 1, 0);
  await h.intake.accept(click("click", 2), 1, 0);
  assert.deepEqual(h.sent.map((message) => message.type), ["client.recording_event"]);
  assert.equal(h.counted(), 1);

  await h.intake.accept(click("click", 3), 2, 0);
  assert.equal(h.sent.length, 2, "the same element in another tab is a different action");
});

test("an executable action is counted and carries the recording id; passive evidence is not", async (t) => {
  holdTimers(t);
  const h = harness();
  await h.intake.accept(click("click", 1), 1, 0);
  assert.equal(h.counted(), 1);
  assert.equal(h.sent.length, 1);
  assert.match(JSON.stringify(h.sent[0]?.payload), /"recording-1"/);
  assert.deepEqual(h.evidenceKinds, ["dom.click"]);
  assert.deepEqual(h.activities.map((activity) => activity.label), ["Click"]);

  await h.intake.accept({ kind: "content.ready", sequence: 2, url: "https://shop.test/", title: "Shop", eventTimestampMs: 2_000 } as RecordingEventPayload, 1, 0);
  assert.equal(h.counted(), 1);
  assert.equal(h.sent.length, 1, "content.ready is evidence, not a recorded action");
  assert.deepEqual(h.evidenceKinds, ["dom.click", "content.ready"]);
  assert.equal(h.activities.length, 1, "content.ready writes no activity");

  await h.intake.accept({ kind: "dom.mutation", sequence: 3, url: "https://shop.test/", title: "Shop", eventTimestampMs: 3_000 } as RecordingEventPayload, 1, 0);
  assert.equal(h.activities.at(-1)?.label, "Evidence: DOM changed");
});

test("a typed navigation and a content-ready page re-enter through the facade's public path", async () => {
  const h = harness();
  h.intake.noteNavigationCommitted({ tabId: 4, url: "https://shop.test/typed", timeStamp: 10, transitionType: "typed", frameId: 0 } as chrome.webNavigation.WebNavigationTransitionCallbackDetails);
  h.intake.noteNavigationCommitted({ tabId: 4, url: "https://shop.test/link", timeStamp: 11, transitionType: "link", frameId: 0 } as chrome.webNavigation.WebNavigationTransitionCallbackDetails);
  h.intake.noteHistoryStateUpdated({ tabId: 4, url: "https://shop.test/spa", timeStamp: 12, frameId: 0 } as chrome.webNavigation.WebNavigationFramedCallbackDetails);
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(h.scheduled, ["https://shop.test/typed", "https://shop.test/spa"], "a link navigation is explained by its click");
  assert.deepEqual(h.reentered.map((entry) => [entry.payload.kind, entry.payload.url, entry.payload.metadata, entry.tabId]), [
    ["browser.navigation", "https://shop.test/typed", { transition: "typed" }, 4],
    ["browser.navigation", "https://shop.test/spa", undefined, 4]
  ]);

  const ready = { kind: "content.ready", sequence: 9, url: "https://shop.test/", title: "Shop", eventTimestampMs: 9, snapshot: {} } as RecordingEventPayload;
  await h.intake.acceptContentReady(ready, 4, 2);
  assert.deepEqual(h.recordingStates, [[4, true, 2]], "the frame is told it is recording");
  assert.equal(h.reentered.at(-1)?.payload, ready);
  assert.equal(h.reentered.at(-1)?.frameId, 2);

  h.stop();
  h.intake.noteNavigationCommitted({ tabId: 4, url: "https://shop.test/after", timeStamp: 20, transitionType: "typed", frameId: 0 } as chrome.webNavigation.WebNavigationTransitionCallbackDetails);
  assert.equal(h.scheduled.length, 2, "nothing is scheduled once the recording stops");
});
