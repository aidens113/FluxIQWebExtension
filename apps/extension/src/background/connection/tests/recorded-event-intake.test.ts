// Coverage of recorded-event-intake.ts: the funnel every recorded event passes
// through. A pointerdown and its click are one action; an executable action is
// counted and sent with the recording's id; passive evidence is not; an event
// this module derives -- a navigation, a content-ready page -- re-enters
// through the facade's public path; and the navigation a click caused goes out
// as a non-executable recording event naming that click.

import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { WEB_AUTOMATION_EVENTS } from "@fluxiq-web-extension/domain/client";
import type { ActivityEntry, RecordingEventPayload, RecordingState } from "../../../shared/protocol";
import type { ActivePage } from "../active-page";
import type { ActiveRecording } from "../active-recording";
import type { ContentAttachment } from "../content-attachment";
import { EventSequence } from "../event-sequence";
import { NavigationRecorder, type NavigationOrigin, type NavigationVerdict } from "../navigation-recorder";
import { PointerClickFilter } from "../pointer-click-filter";
import { RecordedEventIntake, type RecordedEventIntakeDeps } from "../recorded-event-intake";
import type { RecordingEvidenceReporter } from "../recording-evidence";

// The click filter clears a suppression on a timer; keep it off the real clock.
function holdTimers(t: TestContext): void {
  t.mock.method(globalThis, "setTimeout", () => 0);
  t.mock.method(globalThis, "clearTimeout", () => undefined);
}

type HarnessOptions = {
  // A real recorder, for the rows that exercise its policy end to end. Without
  // one, a stub schedules synchronously and records every navigation.
  readonly navigation?: NavigationRecorder;
  // Send a derived event back into this intake, as the facade does.
  readonly reenter?: boolean;
};

function harness(state: RecordingState = "recording", options: HarnessOptions = {}) {
  let recordingState = state;
  let counted = 0;
  const sent: Array<{ type: string; payload: Record<string, unknown> }> = [];
  const evidenceKinds: string[] = [];
  const activities: Array<{ kind: string; label: string; tone: ActivityEntry["tone"] | undefined }> = [];
  const reentered: Array<{ payload: RecordingEventPayload; tabId: number | undefined; frameId: number | undefined }> = [];
  const recordingStates: Array<[number, boolean, number | undefined]> = [];
  const scheduled: string[] = [];
  const classified: Array<[url: string, origin: NavigationOrigin]> = [];

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
  const navigation = options.navigation ?? {
    noteExplanatoryAction: () => undefined,
    schedule: (_tabId: number, url: string, record: () => void) => {
      scheduled.push(url);
      record();
    },
    shouldRecord: (_tabId: number, url: string, _timestamp: number, origin: NavigationOrigin): NavigationVerdict => {
      classified.push([url, origin]);
      return { kind: "navigation" };
    }
  } as unknown as NavigationRecorder;
  const attachment = {
    setRecordingState: async (tabId: number, recordingOn: boolean, frameId?: number) => {
      recordingStates.push([tabId, recordingOn, frameId]);
    }
  } as unknown as ContentAttachment;

  let intake: RecordedEventIntake | undefined;
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
      if (options.reenter) await intake?.accept(payload, tabId, frameId);
    }
  };
  intake = new RecordedEventIntake(deps);

  return {
    intake,
    sent,
    evidenceKinds,
    activities,
    reentered,
    recordingStates,
    scheduled,
    classified,
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

function commit(url: string, transitionType: string, timeStamp: number, frameId = 0, tabId = 4): chrome.webNavigation.WebNavigationTransitionCallbackDetails {
  return { tabId, url, timeStamp, transitionType, frameId } as chrome.webNavigation.WebNavigationTransitionCallbackDetails;
}

// Lets a debounced navigation's re-entry, and the sends it awaits, finish.
async function settle(): Promise<void> {
  for (let turn = 0; turn < 10; turn += 1) await new Promise((resolve) => setImmediate(resolve));
}

type SentRecordingEvent = {
  readonly eventType?: string;
  readonly recordingId?: string;
  readonly payload?: { readonly url?: string };
  readonly metadata?: Record<string, unknown>;
};

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

test("only a top frame's commit is scheduled: a link or submit as the page's own, and never a reload", async () => {
  const h = harness();
  h.intake.noteNavigationCommitted(commit("https://shop.test/typed", "typed", 10));
  h.intake.noteNavigationCommitted(commit("https://shop.test/link", "link", 11));
  h.intake.noteNavigationCommitted(commit("https://shop.test/posted", "form_submit", 12));
  h.intake.noteNavigationCommitted(commit("https://shop.test/reloaded", "reload", 13));
  h.intake.noteNavigationCommitted(commit("https://shop.test/frame-link", "link", 14, 3));
  h.intake.noteNavigationCommitted(commit("https://shop.test/frame", "auto_subframe", 15, 3));
  h.intake.noteNavigationCommitted(commit("https://shop.test/bookmark", "auto_bookmark", 16));
  h.intake.noteHistoryStateUpdated({ tabId: 4, url: "https://shop.test/spa", timeStamp: 17, frameId: 0 } as chrome.webNavigation.WebNavigationFramedCallbackDetails);
  await settle();
  assert.deepEqual(h.classified, [
    ["https://shop.test/typed", "typed"],
    ["https://shop.test/link", "page"],
    ["https://shop.test/posted", "page"],
    ["https://shop.test/bookmark", "other"],
    ["https://shop.test/spa", "other"]
  ]);
});

test("a typed navigation and a content-ready page re-enter through the facade's public path", async () => {
  const h = harness();
  h.intake.noteNavigationCommitted(commit("https://shop.test/typed", "typed", 10));
  h.intake.noteHistoryStateUpdated({ tabId: 4, url: "https://shop.test/spa", timeStamp: 12, frameId: 0 } as chrome.webNavigation.WebNavigationFramedCallbackDetails);
  await settle();
  assert.deepEqual(h.scheduled, ["https://shop.test/typed", "https://shop.test/spa"]);
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
  h.intake.noteNavigationCommitted(commit("https://shop.test/after", "typed", 20));
  assert.equal(h.scheduled.length, 2, "nothing is scheduled once the recording stops");
});

// --- A click's landing (W19, design E1) --------------------------------------
//
// The auth-gate shape: a submit button fires `click` and then `submit`, and the
// page's script navigates, which Chrome reports as a top-frame `link` commit.

test("a click's landing goes out as a non-executable recording event naming the click, with no query or hash", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const h = harness("recording", { navigation: new NavigationRecorder(), reenter: true });
  await h.intake.accept(click("pointerdown", 7), 4, 0);
  await h.intake.accept({ kind: "dom.submit", sequence: 8, url: "https://shop.test/", title: "Shop", eventTimestampMs: 1_010, element: { selector: "#sign-in", tagName: "form" } } as RecordingEventPayload, 4, 0);
  h.intake.noteNavigationCommitted(commit("https://shop.test/account?session=secret-token#welcome", "link", 1_500));
  t.mock.timers.tick(250);
  await settle();

  assert.deepEqual(h.sent.map((message) => message.type), ["client.recording_event", "client.recording_event"], "the click, then its landing");
  const landing = h.sent[1]?.payload as SentRecordingEvent;
  assert.equal(landing.eventType, WEB_AUTOMATION_EVENTS.pageNavigated);
  assert.equal(landing.payload?.url, "https://shop.test/account");
  assert.equal(landing.metadata?.transition, "explained");
  assert.equal(landing.metadata?.explainedBy, 7, "the click's sequence, not the submit's");
  assert.equal("inputId" in (landing.metadata ?? {}), false, "never executable");
  assert.equal(landing.recordingId, "recording-1");
  assert.equal(JSON.stringify(h.sent).includes("secret-token"), false, "the query never crosses");
  assert.equal(JSON.stringify(h.sent).includes("welcome"), false, "the hash never crosses");
  assert.equal(h.counted(), 1, "only the click is an executable action");
  assert.deepEqual(h.evidenceKinds, ["dom.click", "dom.submit", "browser.navigation"]);
});

test("an iframe loading on the landing page does not displace the landing", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const h = harness("recording", { navigation: new NavigationRecorder(), reenter: true });
  await h.intake.accept(click("pointerdown", 7), 4, 0);
  h.intake.noteNavigationCommitted(commit("https://shop.test/account", "link", 1_500));
  h.intake.noteNavigationCommitted(commit("https://ads.test/banner", "auto_subframe", 1_520, 2));
  t.mock.timers.tick(250);
  await settle();
  assert.equal(h.sent.length, 2);
  assert.equal((h.sent[1]?.payload as SentRecordingEvent).payload?.url, "https://shop.test/account");
});

test("a subframe's link, a reload, an unexplained link, and a click nothing can replay send nothing", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const h = harness("recording", { navigation: new NavigationRecorder(), reenter: true });
  await h.intake.accept(click("pointerdown", 7), 4, 0);
  const settleDebounce = () => t.mock.timers.tick(250);

  h.intake.noteNavigationCommitted(commit("https://shop.test/frame", "link", 1_100, 3));
  settleDebounce();
  h.intake.noteNavigationCommitted(commit("https://shop.test/", "reload", 1_200));
  settleDebounce();
  h.intake.noteNavigationCommitted(commit("https://shop.test/elsewhere", "link", 1_300, 0, 5));
  settleDebounce();
  h.intake.noteNavigationCommitted(commit("https://shop.test/late", "link", 6_100));
  settleDebounce();
  await h.intake.accept({ kind: "dom.click", sequence: 9, url: "https://shop.test/", title: "Shop", eventTimestampMs: 7_000, metadata: { sourceEvent: "click" } } as RecordingEventPayload, 6, 0);
  h.intake.noteNavigationCommitted(commit("https://shop.test/unreplayable", "link", 7_100, 0, 6));
  settleDebounce();
  await settle();

  assert.deepEqual(h.sent.map((message) => message.type), ["client.recording_event"], "only the click itself");
  assert.deepEqual(h.reentered, [], "no navigation was derived");
});
