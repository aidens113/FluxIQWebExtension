// Coverage of navigation-recorder.ts: which debounced navigations survive, and
// which of them are the landing of an executable click rather than a
// navigation in their own right. A landing names the click's sequence; a
// submit extends the window without replacing that click; a landing claims
// nothing, so a typed navigation afterwards behaves as it always did.

import assert from "node:assert/strict";
import { test } from "node:test";
import { NavigationRecorder } from "../navigation-recorder";

const TAB = 4;
const ACCOUNT = "https://shop.test/account";

function recorderAfterClick(sequence: number | undefined, at = 1_000): NavigationRecorder {
  const recorder = new NavigationRecorder();
  recorder.noteExplanatoryAction(TAB, at, { kind: "click", sequence });
  return recorder;
}

test("a page's own navigation inside an executable click's window is that click's landing", () => {
  const recorder = recorderAfterClick(7);
  assert.deepEqual(recorder.shouldRecord(TAB, ACCOUNT, 1_200, "page", undefined), { kind: "explained", explainedBy: 7 });
});

test("a page's own navigation with nothing to explain it is dropped", () => {
  const rows: Array<[label: string, recorder: NavigationRecorder, timestamp: number]> = [
    ["no click at all", new NavigationRecorder(), 1_200],
    ["a click that cannot be replayed", recorderAfterClick(undefined), 1_200],
    ["committed before the click", recorderAfterClick(7), 999],
    ["committed after the click's window closed", recorderAfterClick(7), 6_000]
  ];
  for (const [label, recorder, timestamp] of rows) {
    assert.deepEqual(recorder.shouldRecord(TAB, ACCOUNT, timestamp, "page", undefined), { kind: "drop" }, label);
  }
  assert.deepEqual(recorderAfterClick(7).shouldRecord(TAB + 1, ACCOUNT, 1_200, "page", undefined), { kind: "drop" }, "a click in another tab explains nothing here");
});

test("a submit extends the window and keeps the click it follows", () => {
  const recorder = recorderAfterClick(7);
  recorder.noteExplanatoryAction(TAB, 1_010, { kind: "submit" });
  // 6 005 is past the click's own window and inside the submit's.
  assert.deepEqual(recorder.shouldRecord(TAB, ACCOUNT, 6_005, "page", undefined), { kind: "explained", explainedBy: 7 });
});

test("a submit names nothing when no click is inside its window, and a later click replaces the earlier", () => {
  const stale = recorderAfterClick(7);
  stale.noteExplanatoryAction(TAB, 7_000, { kind: "submit" });
  assert.deepEqual(stale.shouldRecord(TAB, ACCOUNT, 7_100, "page", undefined), { kind: "drop" }, "a click 6 s before the submit caused nothing");

  const submitOnly = new NavigationRecorder();
  submitOnly.noteExplanatoryAction(TAB, 1_000, { kind: "submit" });
  assert.deepEqual(submitOnly.shouldRecord(TAB, ACCOUNT, 1_100, "page", undefined), { kind: "drop" }, "a submit is evidence, not a candidate");

  const replaced = recorderAfterClick(7);
  replaced.noteExplanatoryAction(TAB, 1_050, { kind: "click", sequence: 8 });
  assert.deepEqual(replaced.shouldRecord(TAB, ACCOUNT, 1_100, "page", undefined), { kind: "explained", explainedBy: 8 });

  const unreplayable = recorderAfterClick(7);
  unreplayable.noteExplanatoryAction(TAB, 1_050, { kind: "click", sequence: undefined });
  assert.deepEqual(unreplayable.shouldRecord(TAB, ACCOUNT, 1_100, "page", undefined), { kind: "drop" }, "the click that caused it cannot be replayed, and the earlier one did not cause it");
});

test("a landing claims nothing, and typed and other navigations keep their rules", () => {
  const recorder = recorderAfterClick(7);
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
  recorder.noteExplanatoryAction(TAB, startedAt - 10, { kind: "click", sequence: 7 });
  assert.deepEqual(recorder.shouldRecord(TAB, "https://shop.test/late", startedAt, "page", startedAt), { kind: "drop" }, "committed before recording started");
  recorder.noteExplanatoryAction(TAB, startedAt + 5, { kind: "click", sequence: 8 });
  assert.deepEqual(recorder.shouldRecord(TAB, ACCOUNT, startedAt + 10, "page", startedAt), { kind: "drop" }, "the tab's starting URL, inside the grace window");
});

test("a new recording forgets the last one's click", () => {
  const recorder = recorderAfterClick(7);
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
