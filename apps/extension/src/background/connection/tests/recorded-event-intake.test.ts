// Coverage of recorded-event-intake.ts: the funnel every recorded event passes
// through. A pointerdown and its click are one action, and a second press of the
// same control is a second, however soon it comes; an executable action is
// counted and sent with the recording's id; passive evidence is not; an event
// this module derives -- a navigation, a content-ready page -- re-enters
// through the facade's public path; and the navigation a click caused goes out
// as a non-executable recording event naming that click.

import assert from "node:assert/strict";
import { test } from "node:test";
import { WEB_AUTOMATION_EVENTS, WEB_AUTOMATION_INPUT_IDS } from "@fluxiq-web-extension/domain/client";
import type { ActivityEntry, RecordingEventPayload, RecordingState } from "../../../shared/protocol";
import type { ActivePage } from "../active-page";
import type { ActiveRecording } from "../active-recording";
import type { ContentAttachment } from "../content-attachment";
import { EventSequence } from "../event-sequence";
import { NavigationRecorder, type NavigationOrigin, type NavigationVerdict } from "../navigation-recorder";
import { PointerClickFilter } from "../pointer-click-filter";
import { RecordedEventIntake, type RecordedEventIntakeDeps } from "../recorded-event-intake";
import type { RecordingEvidenceReporter } from "../recording-evidence";
import { ScriptedNavigationIntent } from "../scripted-navigation/index";

type HarnessOptions = {
  // A real recorder, for the rows that exercise its policy end to end. Without
  // one, a stub schedules synchronously and records every navigation.
  readonly navigation?: NavigationRecorder;
  // Send a derived event back into this intake, as the facade does.
  readonly reenter?: boolean;
  readonly claimScriptedCommit?: (details: chrome.webNavigation.WebNavigationTransitionCallbackDetails, intake: RecordedEventIntake) => boolean;
  readonly sendGate?: Promise<void>;
};

function harness(state: RecordingState = "recording", options: HarnessOptions = {}) {
  let recordingState = state;
  let acceptingEvents = state === "recording";
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
    acceptsEvents: () => recordingState === "recording" && acceptingEvents,
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
    },
    noteRecordedTab: () => undefined
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
      await options.sendGate;
    }) as RecordedEventIntakeDeps["send"],
    recording,
    page: { unsupported: () => undefined } as unknown as ActivePage,
    navigation,
    scriptedNavigation: {
      claimCommit: (details: chrome.webNavigation.WebNavigationTransitionCallbackDetails) => options.claimScriptedCommit?.(details, intake as RecordedEventIntake) ?? false
    } as never,
    clicks: new PointerClickFilter(),
    sequence: new EventSequence(),
    evidence,
    attachment,
    sendToTab: (async () => undefined) as RecordedEventIntakeDeps["sendToTab"],
    onActivity: (kind, label, _detail, tone) => {
      activities.push({ kind, label, tone });
    },
    recordEvent: async (payload, tabId, frameId, admittedNavigation) => {
      reentered.push({ payload, tabId, frameId });
      if (options.reenter) await intake?.accept(payload, tabId, frameId, admittedNavigation);
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
      acceptingEvents = false;
    },
    fence: () => {
      acceptingEvents = false;
    }
  };
}

function click(sourceEvent: string, sequence: number, eventTimestampMs = 1_000 + sequence): RecordingEventPayload {
  return {
    kind: "dom.click",
    sequence,
    url: "https://shop.test/",
    title: "Shop",
    eventTimestampMs,
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
  readonly eventId?: string;
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

// --- A press and the click it produces (P3) ----------------------------------

function sentEventIds(h: ReturnType<typeof harness>): Array<string | undefined> {
  return h.sent.map((message) => (message.payload as SentRecordingEvent).eventId);
}

test("a pointerdown and its click record one action, the press", async () => {
  const h = harness();
  await h.intake.accept(click("pointerdown", 1), 1, 0);
  await h.intake.accept(click("click", 2), 1, 0);
  assert.deepEqual(h.sent.map((message) => message.type), ["client.recording_event"]);
  assert.deepEqual(sentEventIds(h), ["web.1.1001"]);
  assert.equal(h.counted(), 1);

  await h.intake.accept(click("click", 3), 2, 0);
  assert.equal(h.sent.length, 2, "the same element in another tab is a different action");
});

// W14's shape: Add section pressed twice, 253 ms apart on the Flow lane. The
// timestamps are 250 ms apart and no clock is mocked, so a filter that held a
// signature for a fixed window would still be holding it.
test("two pointerdown-click pairs on the same unmoved control 250 ms apart record two actions", async () => {
  const h = harness();
  await h.intake.accept(click("pointerdown", 1, 37_451), 4, 0);
  await h.intake.accept(click("click", 2, 37_530), 4, 0);
  await h.intake.accept(click("pointerdown", 3, 37_701), 4, 0);
  await h.intake.accept(click("click", 4, 37_780), 4, 0);
  assert.equal(h.counted(), 2);
  assert.deepEqual(sentEventIds(h), ["web.1.37451", "web.3.37701"], "each press, and neither click");
});

test("a click with no pointerdown records one action", async () => {
  const h = harness();
  await h.intake.accept(click("click", 1), 4, 0);
  assert.equal(h.counted(), 1);
  assert.deepEqual(sentEventIds(h), ["web.1.1001"]);
});

test("an executable action is counted and carries the recording id; passive evidence is not", async () => {
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

test("an owned commit has first refusal and re-enters once as typed, whatever its browser label", async () => {
  for (const transitionType of ["typed", "link", "auto_bookmark", "reload"]) {
    const h = harness("recording", {
      reenter: true,
      claimScriptedCommit: (details, intake) => {
        void intake.recordScriptedNavigation(details.tabId, "http://127.0.0.1:4173/final", details.timeStamp);
        return true;
      }
    });
    h.intake.noteNavigationCommitted(commit("http://127.0.0.1:4173/final", transitionType, 20));
    await settle();
    assert.deepEqual(h.reentered.map((entry) => [entry.payload.kind, entry.payload.metadata, entry.tabId]), [
      ["browser.navigation", { transition: "typed" }, 4]
    ]);
    assert.equal(h.counted(), 1);
    assert.equal(h.sent.length, 1, `${transitionType} is not also classified by the ordinary path`);
  }
});

test("the composed intent acknowledgement waits for the intake gateway send", async () => {
  let releaseSend: () => void = () => undefined;
  const sendGate = new Promise<void>(resolve => { releaseSend = resolve; });
  const h = harness("recording", { reenter: true, sendGate });
  let debounce: (() => void) | undefined;
  const intent = new ScriptedNavigationIntent({
    recordingState: () => "recording",
    activeTabId: () => 4,
    recordNavigation: (tabId, url, timestamp) => h.intake.recordScriptedNavigation(tabId, url, timestamp),
    createId: () => "intent-composed",
    setTimer: (callback, delayMs) => { if (delayMs === 250) debounce = callback; return delayMs as unknown as ReturnType<typeof setTimeout>; },
    clearTimer: () => undefined
  });
  assert.deepEqual(intent.arm("http://127.0.0.1:4173/final"), { ok: true, intentId: "intent-composed" });
  assert.equal(intent.claimCommit(commit("http://127.0.0.1:4173/final", "link", 20)), true);
  debounce?.();
  const acknowledgement = intent.await("intent-composed");
  let settled = false;
  void acknowledgement.then(() => { settled = true; });
  await settle();
  assert.equal(settled, false);
  assert.equal(h.sent.at(-1)?.type, "client.recording_event");
  releaseSend();
  assert.deepEqual(await acknowledgement, { ok: true, intentId: "intent-composed" });
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

test("a stop fence refuses fresh content and navigation while draining an already-scheduled navigation", async () => {
  const navigation = new NavigationRecorder();
  const h = harness("recording", { navigation, reenter: true });
  h.intake.noteNavigationCommitted(commit("https://shop.test/already-admitted", "typed", 10));
  h.fence();

  await h.intake.accept(click("pointerdown", 2), 4, 0);
  await h.intake.acceptContentReady({
    kind: "content.ready", sequence: 3, url: "https://shop.test/late", title: "Late", eventTimestampMs: 12
  } as RecordingEventPayload, 4, 0);
  h.intake.noteNavigationCommitted(commit("https://shop.test/not-admitted", "typed", 13));
  await navigation.flush();

  assert.deepEqual(h.scheduled, [], "the injected recorder owns scheduling in this row");
  assert.deepEqual(h.recordingStates, [], "late content-ready performs no recording attachment work");
  assert.equal(h.counted(), 1, "only the navigation admitted before the fence is recorded");
  assert.deepEqual(h.sent.map((message) => (message.payload as SentRecordingEvent).payload?.url), ["https://shop.test/already-admitted"]);
  assert.deepEqual(h.evidenceKinds, ["browser.navigation"]);
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
  const clicked = h.sent[0]?.payload as SentRecordingEvent;
  const landing = h.sent[1]?.payload as SentRecordingEvent;
  assert.equal(landing.eventType, WEB_AUTOMATION_EVENTS.pageNavigated);
  assert.equal(landing.payload?.url, "https://shop.test/account");
  assert.equal(landing.metadata?.transition, "explained");
  assert.equal(landing.metadata?.explainedBy, 7, "the click's sequence, not the submit's");
  assert.equal(clicked.eventId, "web.7.1007");
  assert.equal(landing.metadata?.explainedByEventId, clicked.eventId, "the event id the click itself was sent under");
  assert.equal("inputId" in (landing.metadata ?? {}), false, "never executable");
  assert.equal(landing.recordingId, "recording-1");
  assert.equal(JSON.stringify(h.sent).includes("secret-token"), false, "the query never crosses");
  assert.equal(JSON.stringify(h.sent).includes("welcome"), false, "the hash never crosses");
  assert.equal(h.counted(), 1, "only the click is an executable action");
  assert.deepEqual(h.evidenceKinds, ["dom.click", "dom.submit", "browser.navigation"]);
});

// The page a landing reached has its own content script, counting from zero, so
// its first click can carry the same sequence as the click that led there.
test("two clicks that share a sequence are told apart by the event id each landing names", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const h = harness("recording", { navigation: new NavigationRecorder(), reenter: true });
  await h.intake.accept(click("pointerdown", 7), 4, 0);
  h.intake.noteNavigationCommitted(commit("https://shop.test/account", "link", 1_500));
  t.mock.timers.tick(250);
  await settle();
  await h.intake.accept({
    ...click("pointerdown", 7),
    url: "https://shop.test/account",
    eventTimestampMs: 9_007,
    element: { selector: "#orders", tagName: "a", text: "Orders" }
  } as RecordingEventPayload, 4, 0);
  h.intake.noteNavigationCommitted(commit("https://shop.test/orders", "link", 9_500));
  t.mock.timers.tick(250);
  await settle();

  const events = h.sent.map((message) => message.payload as SentRecordingEvent);
  assert.deepEqual(events.map((event) => event.eventType), [
    WEB_AUTOMATION_EVENTS.elementClicked,
    WEB_AUTOMATION_EVENTS.pageNavigated,
    WEB_AUTOMATION_EVENTS.elementClicked,
    WEB_AUTOMATION_EVENTS.pageNavigated
  ]);
  assert.deepEqual([events[1]?.metadata?.explainedBy, events[3]?.metadata?.explainedBy], [7, 7], "the sequence alone cannot tell the clicks apart");
  assert.notEqual(events[0]?.eventId, events[2]?.eventId);
  assert.equal(events[1]?.metadata?.explainedByEventId, events[0]?.eventId, "the first landing names the first click");
  assert.equal(events[3]?.metadata?.explainedByEventId, events[2]?.eventId, "the second landing names the second click");
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

// --- A tab switch or close (P4) -----------------------------------------------
//
// The tab recorder hands these to the facade, which brings them here. They take
// the executable branch a click takes -- counted once, sent with an input id --
// while the recording-start marker, the same kind with no `tab`, stays evidence.

function tabEvent(sequence: number, fields: Partial<RecordingEventPayload>): RecordingEventPayload {
  return { kind: "browser.tab", sequence, url: "https://shop.test/orders", title: "", eventTimestampMs: 5_000 + sequence, ...fields } as RecordingEventPayload;
}

type SentTabEvent = SentRecordingEvent & { readonly payload?: { readonly tab?: unknown } };

test("a recorded tab switch and close are each counted once and sent with their input ids; the recording-start marker is neither", async () => {
  const h = harness();
  await h.intake.accept(tabEvent(1, { metadata: { recordingState: "started", recordingId: "recording-1" } }));
  assert.equal(h.counted(), 0);
  assert.equal(h.sent.length, 0, "the marker is evidence");

  await h.intake.accept(tabEvent(2, { tab: { operation: "switch", urlPath: "/orders/17" } }), 7);
  await h.intake.accept(tabEvent(3, { tab: { operation: "close" } }));
  assert.equal(h.counted(), 2);
  const events = h.sent.map((message) => message.payload as SentTabEvent);
  assert.deepEqual(h.sent.map((message) => message.type), ["client.recording_event", "client.recording_event"]);
  assert.deepEqual(events.map((event) => event.eventType), [WEB_AUTOMATION_EVENTS.tabStateChanged, WEB_AUTOMATION_EVENTS.tabStateChanged]);
  assert.deepEqual(events.map((event) => event.metadata?.inputId), [WEB_AUTOMATION_INPUT_IDS.tabSwitched, WEB_AUTOMATION_INPUT_IDS.tabClosed]);
  assert.deepEqual(events.map((event) => event.payload?.tab), [{ operation: "switch", urlPath: "/orders/17" }, { operation: "close" }]);
  assert.deepEqual(events.map((event) => event.recordingId), ["recording-1", "recording-1"]);
  assert.deepEqual(h.evidenceKinds, ["browser.tab", "browser.tab", "browser.tab"]);
});

test("a tab switch that names no path is evidence, not an action", async () => {
  const h = harness();
  await h.intake.accept(tabEvent(1, { tab: { operation: "switch" } }), 7);
  assert.equal(h.counted(), 0);
  assert.deepEqual(h.sent, []);
});

// Lane E, local-classifieds: the cookie banner's button, then Enter in the
// search box, whose handler sets `location.href`. The browser reports that as
// the page's own `link` commit, inside the click's five-second window.
test("a key press after a click takes the navigation it causes away from that click", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const h = harness("recording", { navigation: new NavigationRecorder(), reenter: true });
  await h.intake.accept(click("pointerdown", 7, 1_000), 4, 0);
  await h.intake.accept({ kind: "dom.keydown", sequence: 8, url: "https://shop.test/", title: "Shop", eventTimestampMs: 1_700, key: "Enter", element: { selector: "#q", tagName: "input", inputType: "search" } } as RecordingEventPayload, 4, 0);
  h.intake.noteNavigationCommitted(commit("https://shop.test/search/?q=bike", "link", 1_900));
  t.mock.timers.tick(250);
  await settle();

  assert.equal(h.counted(), 2, "the click and the key press are both actions");
  assert.equal(h.sent.length, 2, "and nothing else is sent: no landing");
  assert.equal(h.sent.some((message) => (message.payload as SentRecordingEvent).metadata?.transition === "explained"), false, "the search page is not the click's landing");
});
