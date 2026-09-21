// Coverage of navigation-recorder.ts: which debounced navigations survive, and
// which of them are the landing of an executable click rather than a
// navigation in their own right. A landing names the click by its sequence and
// by the event id it was recorded under; a submit extends the window without
// replacing that click; a landing claims nothing, so a typed navigation
// afterwards behaves as it always did.

import assert from "node:assert/strict";
import { test } from "node:test";
import { NavigationRecorder, type RecordedClick } from "../navigation-recorder";

const TAB = 4;
const ACCOUNT = "https://shop.test/account";

function recordedClick(sequence: number, at = 1_000): RecordedClick {
  return { sequence, eventId: `web.${sequence}.${at}` };
}

function recorderAfterClick(recorded: RecordedClick | undefined, at = 1_000): NavigationRecorder {
  const recorder = new NavigationRecorder();
  recorder.noteExplanatoryAction(TAB, at, { kind: "click", recorded });
  return recorder;
}

test("a page's own navigation inside an executable click's window is that click's landing", () => {
  const recorder = recorderAfterClick(recordedClick(7));
  assert.deepEqual(recorder.shouldRecord(TAB, ACCOUNT, 1_200, "page", undefined), { kind: "explained", click: { sequence: 7, eventId: "web.7.1000" } });
});

test("a page's own navigation with nothing to explain it is dropped", () => {
  const rows: Array<[label: string, recorder: NavigationRecorder, timestamp: number]> = [
    ["no click at all", new NavigationRecorder(), 1_200],
    ["a click that cannot be replayed", recorderAfterClick(undefined), 1_200],
    ["committed before the click", recorderAfterClick(recordedClick(7)), 999],
    ["committed after the click's window closed", recorderAfterClick(recordedClick(7)), 6_000]
  ];
  for (const [label, recorder, timestamp] of rows) {
    assert.deepEqual(recorder.shouldRecord(TAB, ACCOUNT, timestamp, "page", undefined), { kind: "drop" }, label);
  }
  assert.deepEqual(recorderAfterClick(recordedClick(7)).shouldRecord(TAB + 1, ACCOUNT, 1_200, "page", undefined), { kind: "drop" }, "a click in another tab explains nothing here");
});

test("a submit extends the window and keeps the click it follows", () => {
  const recorder = recorderAfterClick(recordedClick(7));
  recorder.noteExplanatoryAction(TAB, 1_010, { kind: "submit" });
  // 6 005 is past the click's own window and inside the submit's.
  assert.deepEqual(recorder.shouldRecord(TAB, ACCOUNT, 6_005, "page", undefined), { kind: "explained", click: { sequence: 7, eventId: "web.7.1000" } });
});

test("a submit names nothing when no click is inside its window, and a later click replaces the earlier", () => {
  const stale = recorderAfterClick(recordedClick(7));
  stale.noteExplanatoryAction(TAB, 7_000, { kind: "submit" });
  assert.deepEqual(stale.shouldRecord(TAB, ACCOUNT, 7_100, "page", undefined), { kind: "drop" }, "a click 6 s before the submit caused nothing");

  const submitOnly = new NavigationRecorder();
  submitOnly.noteExplanatoryAction(TAB, 1_000, { kind: "submit" });
  assert.deepEqual(submitOnly.shouldRecord(TAB, ACCOUNT, 1_100, "page", undefined), { kind: "drop" }, "a submit is evidence, not a candidate");

  const replaced = recorderAfterClick(recordedClick(7));
  replaced.noteExplanatoryAction(TAB, 1_050, { kind: "click", recorded: recordedClick(8, 1_050) });
  assert.deepEqual(replaced.shouldRecord(TAB, ACCOUNT, 1_100, "page", undefined), { kind: "explained", click: { sequence: 8, eventId: "web.8.1050" } });

  const unreplayable = recorderAfterClick(recordedClick(7));
  unreplayable.noteExplanatoryAction(TAB, 1_050, { kind: "click", recorded: undefined });
  assert.deepEqual(unreplayable.shouldRecord(TAB, ACCOUNT, 1_100, "page", undefined), { kind: "drop" }, "the click that caused it cannot be replayed, and the earlier one did not cause it");
});

// A content script counts from zero in every document, so the click on the
// page a landing reached can reuse the sequence of the click that led there.
test("two clicks that share a sequence are told apart by their event ids", () => {
  const recorder = recorderAfterClick(recordedClick(7, 1_000));
  const first = recorder.shouldRecord(TAB, ACCOUNT, 1_200, "page", undefined);
  recorder.noteExplanatoryAction(TAB, 9_000, { kind: "click", recorded: recordedClick(7, 9_000) });
  const second = recorder.shouldRecord(TAB, "https://shop.test/orders", 9_200, "page", undefined);
  assert.deepEqual(first, { kind: "explained", click: { sequence: 7, eventId: "web.7.1000" } });
  assert.deepEqual(second, { kind: "explained", click: { sequence: 7, eventId: "web.7.9000" } });
});

test("a landing claims nothing, and typed and other navigations keep their rules", () => {
  const recorder = recorderAfterClick(recordedClick(7));
  assert.equal(recorder.shouldRecord(TAB, ACCOUNT, 1_200, "page", undefined).kind, "explained");
  assert.equal(recorder.hasRecordedTab(TAB), false, "the landing is evidence about a click, not the tab's own navigation");
  assert.deepEqual(recorder.shouldRecord(TAB, "https://shop.test/spa", 1_300, "other", undefined), { kind: "drop" }, "an untyped change a click explains is dropped");
  assert.deepEqual(recorder.shouldRecord(TAB, ACCOUNT, 1_400, "typed", undefined), { kind: "navigation" }, "a typed navigation is intentional even inside the window");
  assert.deepEqual(recorder.shouldRecord(TAB, ACCOUNT, 7_000, "typed", undefined), { kind: "drop" }, "the same URL twice is recorded once");
  assert.deepEqual(recorder.shouldRecord(TAB, "https://shop.test/other", 7_000, "other", undefined), { kind: "navigation" }, "outside the window an untyped change is a navigation");
});

test("setup navigation is dropped even when a click would explain it", () => {
  const startedAt = Date.now();
  const recorder = new NavigationRecorder();
  recorder.seedRecordingTab(TAB, ACCOUNT, startedAt);
  recorder.noteExplanatoryAction(TAB, startedAt - 10, { kind: "click", recorded: recordedClick(7, startedAt - 10) });
  assert.deepEqual(recorder.shouldRecord(TAB, "https://shop.test/late", startedAt, "page", startedAt), { kind: "drop" }, "committed before recording started");
  recorder.noteExplanatoryAction(TAB, startedAt + 5, { kind: "click", recorded: recordedClick(8, startedAt + 5) });
  assert.deepEqual(recorder.shouldRecord(TAB, ACCOUNT, startedAt + 10, "page", startedAt), { kind: "drop" }, "the tab's starting URL, inside the grace window");
});

test("a new recording forgets the last one's click", () => {
  const recorder = recorderAfterClick(recordedClick(7));
  recorder.clearRecordingTabs();
  assert.deepEqual(recorder.shouldRecord(TAB, ACCOUNT, 1_200, "page", undefined), { kind: "drop" });
});

test("a burst of commits in one tab records only the last, once the debounce settles", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const recorder = new NavigationRecorder();
  const recorded: string[] = [];
  recorder.schedule(TAB, "https://shop.test/account", () => recorded.push("first"));
  t.mock.timers.tick(200);
  recorder.schedule(TAB, "https://shop.test/sign-in", () => recorded.push("redirect"));
  t.mock.timers.tick(249);
  assert.deepEqual(recorded, [], "the second commit restarted the debounce");
  t.mock.timers.tick(1);
  assert.deepEqual(recorded, ["redirect"]);
});

test("flush runs the latest pending callback immediately and awaits it", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const recorder = new NavigationRecorder();
  const recorded: string[] = [];
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  recorder.schedule(TAB, ACCOUNT, () => recorded.push("replaced"));
  recorder.schedule(TAB, "https://shop.test/sign-in", async () => {
    recorded.push("started");
    await gate;
    recorded.push("settled");
  });

  const flushing = recorder.flush();
  assert.deepEqual(recorded, ["started"], "flush does not wait for the debounce timer");
  let settled = false;
  void flushing.then(() => { settled = true; });
  await Promise.resolve();
  assert.equal(settled, false, "the callback's asynchronous send still holds the flush");
  release();
  await flushing;
  assert.deepEqual(recorded, ["started", "settled"], "the replaced callback never runs");
});

test("flush waits for a callback already running when stop begins", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const recorder = new NavigationRecorder();
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let callbackSettled = false;
  recorder.schedule(TAB, ACCOUNT, async () => {
    await gate;
    callbackSettled = true;
  });
  t.mock.timers.tick(250);

  const flushing = recorder.flush();
  await Promise.resolve();
  assert.equal(callbackSettled, false);
  release();
  await flushing;
  assert.equal(callbackSettled, true);
});

test("a rejected callback is reported once after all navigation work settles", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const recorder = new NavigationRecorder();
  const sent: string[] = [];
  recorder.schedule(TAB, ACCOUNT, async () => {
    sent.push("attempted");
    throw new Error("landing send failed");
  });

  await assert.rejects(recorder.flush(), /landing send failed/);
  assert.deepEqual(sent, ["attempted"]);
  await recorder.flush();
});

test("a timer-fired rejected callback is retained safely until flush observes it", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const recorder = new NavigationRecorder();
  recorder.schedule(TAB, ACCOUNT, async () => {
    throw new Error("timer-fired landing failed");
  });

  t.mock.timers.tick(250);
  await Promise.resolve();
  await Promise.resolve();
  await assert.rejects(recorder.flush(), /timer-fired landing failed/);
  await recorder.flush();
});

test("flush re-drains navigation scheduled while an admitted callback settles", async () => {
  const recorder = new NavigationRecorder();
  const recorded: string[] = [];
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  recorder.schedule(TAB, ACCOUNT, async () => {
    recorded.push("first-started");
    await gate;
    recorder.schedule(TAB + 1, "https://shop.test/orders", () => recorded.push("second"));
    recorded.push("first-settled");
  });

  const flushing = recorder.flush();
  release();
  await flushing;
  assert.deepEqual(recorded, ["first-started", "first-settled", "second"]);
});

test("a stale cleared timer cannot displace the pending callback that replaced it", async (t) => {
  const timers: Array<() => void> = [];
  t.mock.method(globalThis, "setTimeout", ((callback: () => void) => {
    timers.push(callback);
    return timers.length as unknown as ReturnType<typeof setTimeout>;
  }) as typeof setTimeout);
  t.mock.method(globalThis, "clearTimeout", (() => undefined) as typeof clearTimeout);
  const recorder = new NavigationRecorder();
  const recorded: string[] = [];
  recorder.schedule(TAB, ACCOUNT, () => recorded.push("stale"));
  recorder.schedule(TAB, "https://shop.test/sign-in", () => recorded.push("current"));

  timers[0]?.();
  assert.deepEqual(recorded, [], "the stale timer does not run or delete its replacement");
  timers[1]?.();
  await Promise.resolve();
  assert.deepEqual(recorded, ["current"]);
});

test("clearing recording tabs cancels pending work from the prior recording", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const recorder = new NavigationRecorder();
  const recorded: string[] = [];
  recorder.schedule(TAB, ACCOUNT, () => recorded.push("old recording"));
  recorder.clearRecordingTabs();
  t.mock.timers.tick(250);
  await recorder.flush();
  assert.deepEqual(recorded, []);
});

test("clearing recording tabs isolates already-running work from the next recording", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const recorder = new NavigationRecorder();
  let rejectOld: (error: Error) => void = () => undefined;
  const oldGate = new Promise<void>((_resolve, reject) => { rejectOld = reject; });
  recorder.schedule(TAB, ACCOUNT, () => oldGate);
  t.mock.timers.tick(250);
  recorder.clearRecordingTabs();
  const recorded: string[] = [];
  recorder.schedule(TAB, "https://shop.test/new", () => recorded.push("new recording"));

  await recorder.flush();
  assert.deepEqual(recorded, ["new recording"], "the prior callback does not hold the new flush open");
  rejectOld(new Error("old recording failed late"));
  await Promise.resolve();
  await recorder.flush();
});

// Lane E, local-classifieds: "Allow all cookies", then the search typed and run
// with Enter 700 ms later. The search page the key press reached used to be
// recorded as the cookie click's landing, and the replayed cookie click then
// failed for not arriving there.
test("a later action ends a click's window: what commits after it is not that click's landing", () => {
  const recorder = recorderAfterClick(recordedClick(7));
  recorder.noteExplanatoryAction(TAB, 1_400, { kind: "action" });
  assert.deepEqual(recorder.shouldRecord(TAB, "https://shop.test/search/", 1_700, "page", undefined), { kind: "drop" }, "the page's own navigation after the key press is nobody's landing");
  assert.deepEqual(recorder.shouldRecord(TAB, "https://shop.test/search/?q=bike", 1_800, "other", undefined), { kind: "navigation" }, "a history update after it is recorded as it would be with no click before it");
});

test("a navigation is judged by the action in force when it committed, not by the latest one", () => {
  const recorder = recorderAfterClick(recordedClick(7));
  recorder.noteExplanatoryAction(TAB, 1_300, { kind: "action" });
  // Committed at 1 200, before the key press at 1 300, and judged only once the debounce settled after it.
  assert.deepEqual(recorder.shouldRecord(TAB, ACCOUNT, 1_200, "page", undefined), { kind: "explained", click: { sequence: 7, eventId: "web.7.1000" } });

  const later = recorderAfterClick(recordedClick(7));
  later.noteExplanatoryAction(TAB, 1_300, { kind: "click", recorded: recordedClick(8, 1_300) });
  assert.deepEqual(later.shouldRecord(TAB, ACCOUNT, 1_200, "page", undefined), { kind: "explained", click: { sequence: 7, eventId: "web.7.1000" } }, "a click after the commit does not take the landing either");
});

test("a submit that follows a later action keeps no click", () => {
  const recorder = recorderAfterClick(recordedClick(7));
  recorder.noteExplanatoryAction(TAB, 1_300, { kind: "action" });
  recorder.noteExplanatoryAction(TAB, 1_310, { kind: "submit" });
  assert.deepEqual(recorder.shouldRecord(TAB, ACCOUNT, 1_500, "page", undefined), { kind: "drop" }, "Enter in a field submits its form with no click");
});
