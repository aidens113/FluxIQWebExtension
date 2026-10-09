// What the overlay says for a paced display, without a DOM: the headline, the
// detail and the step as the background paced them, a mark and colour that
// follow the unit of work rather than Core's phase, and which preference
// shows what. Every word comes from the display, which the background words
// (`shared/activity/wording.ts`); the real build is checked end to end
// in `background/activity/tests/activity-replay.test.ts`.

import assert from "node:assert/strict";
import test from "node:test";
import type { ActivityDisplay } from "../../../shared/activity";
import { ACTIVITY_PHASE_APPEARANCE } from "../phase-appearance";
import { activityOverlayView } from "../overlay-view";

function display(overrides: Partial<ActivityDisplay> = {}): ActivityDisplay {
  return {
    activityId: "run:run-1",
    subjectKind: "run",
    phase: "running",
    headline: "Running your Flow",
    detail: "Running step 2 of 5: Open the cart",
    step: { index: 2, count: 5 },
    working: true,
    outcome: null,
    sequence: 4,
    ...overrides
  };
}

test("an expanded view carries the headline, Core's sentence and the step", () => {
  assert.deepEqual(activityOverlayView(display(), "expanded"), {
    mode: "expanded",
    mark: "pulse",
    accent: ACTIVITY_PHASE_APPEARANCE.running.accent,
    headline: "Running your Flow",
    detail: "Running step 2 of 5: Open the cart",
    step: "Step 2 of 5",
    fades: false
  });
});

test("the mark and colour follow the unit of work, not Core's phase of the moment", () => {
  for (const phase of ["thinking", "exploring", "verifying", "building"] as const) {
    const view = activityOverlayView(display({ subjectKind: "build", activityId: "build:b", headline: "Building your Flow", phase, step: null }), "expanded");
    assert.equal(view?.accent, ACTIVITY_PHASE_APPEARANCE.building.accent, phase);
    assert.equal(view?.mark, "pulse", phase);
  }
});

test("only done fades: a failure stays on the page, and so does waiting for the person", () => {
  const done = activityOverlayView(display({ working: false, outcome: "done", headline: "Run finished", step: null }), "expanded");
  assert.deepEqual([done?.mark, done?.accent, done?.fades], ["check", ACTIVITY_PHASE_APPEARANCE.done.accent, true]);
  const failed = activityOverlayView(display({ working: false, outcome: "failed", headline: "Run failed" }), "expanded");
  assert.deepEqual([failed?.mark, failed?.fades, failed?.step], ["cross", false, ""], "a failure does not fade, and a settled view shows no step");
  const waiting = activityOverlayView(display({ working: false, outcome: "waiting", headline: "Waiting for you: finish the check on the page" }), "expanded");
  assert.deepEqual([waiting?.mark, waiting?.accent, waiting?.fades], ["attention", ACTIVITY_PHASE_APPEARANCE.waiting_permission.accent, false]);
});

test("the headline is never drawn again as the detail line", () => {
  const echoes: Array<[string, string]> = [
    ["Run finished", "Run finished"],
    ["Building your Flow", "Building the Flow"],
    ["Waiting for you: finish the check on the page", "Waiting for you"],
    ["Build failed", "build failed."]
  ];
  for (const [headline, detail] of echoes) assert.equal(activityOverlayView(display({ headline, detail }), "expanded")?.detail, "", detail);
  const adds = activityOverlayView(display({ headline: "Build failed", detail: "Build failed: no list was found" }), "expanded");
  assert.equal(adds?.detail, "Build failed: no list was found", "a detail that adds something stays");
});

test("a step past the flow's count is said plainly", () => {
  assert.equal(activityOverlayView(display({ step: { index: 7, count: 5 } }), "expanded")?.step, "Step 7");
  assert.equal(activityOverlayView(display({ step: { index: 3, count: 0 } }), "expanded")?.step, "Step 3");
  assert.equal(activityOverlayView(display({ step: null }), "expanded")?.step, "");
});

test("collapsed is the small pill; hidden and no display take the overlay out", () => {
  assert.equal(activityOverlayView(display(), "collapsed")?.mode, "collapsed");
  assert.equal(activityOverlayView(display(), "hidden"), null);
  assert.equal(activityOverlayView(null, "expanded"), null);
});

test("no detail is an empty line, and a misbehaving sender's long text is bounded", () => {
  assert.equal(activityOverlayView(display({ detail: null }), "expanded")?.detail, "");
  assert.equal(activityOverlayView(display({ detail: "x".repeat(500) }), "expanded")?.detail.length, 160);
  assert.equal(activityOverlayView(display({ headline: "   " }), "expanded")?.headline, ACTIVITY_PHASE_APPEARANCE.running.name);
});

// U-4 of the run-muw60j7c-bb7c9a62 UI review: "trying another w…", "the check found the…".
test("a line longer than the overlay's bound is cut where a word ends", () => {
  const words = Array.from({ length: 40 }, (_, index) => `word${index}`).join(" ");
  const detail = activityOverlayView(display({ detail: words }), "expanded")!.detail;
  assert.ok(detail.length <= 160 && detail.endsWith("…"), detail);
  assert.ok(words.startsWith(`${detail.slice(0, -1)} `), `"${detail}" ends inside a word`);
});

test("nothing the overlay adds of its own is a raw id: fallback headlines, step counts", () => {
  const rawId = /\b[a-z]+\.[a-z_]+/u;
  for (const [phase, appearance] of Object.entries(ACTIVITY_PHASE_APPEARANCE)) assert.doesNotMatch(appearance.name, rawId, phase);
  for (const outcome of ["done", "failed", "waiting", null] as const) {
    const view = activityOverlayView(display({ headline: "", detail: null, outcome, working: outcome === null }), "expanded");
    for (const text of [view?.headline ?? "", view?.detail ?? "", view?.step ?? ""]) assert.doesNotMatch(text, rawId, String(outcome));
  }
});

test("a build waiting at a robot check shows Core's ask as its sentence, under 'Waiting for you', and stays up", () => {
  // Core's person-needed ask (t197) arrives as phase `waiting_permission` with
  // the ask's text as its label; the pacer makes that the display's detail.
  const ask = "FluxIQ needs you: complete the check on this page, then press Continue.";
  const view = activityOverlayView(display({
    activityId: "build:b", subjectKind: "build", phase: "waiting_permission", headline: "Waiting for you",
    detail: ask, step: null, working: false, outcome: "waiting"
  }), "expanded");
  assert.equal(view?.headline, "Waiting for you");
  assert.equal(view?.detail, ask, "the whole ask fits the line: nothing is cut");
  assert.equal(view?.mark, "attention");
  assert.equal(view?.fades, false, "waiting for the person does not fade");
});

test("a run held for the person is drawn as paused, never fades, and says how to let it go on", () => {
  const paused = activityOverlayView(display({ working: false, outcome: "waiting", phase: "paused", headline: "Paused: your turn on the page", detail: null, step: { index: 3, count: 5 } }), "expanded");
  assert.deepEqual(paused, {
    mode: "expanded",
    mark: "attention",
    accent: ACTIVITY_PHASE_APPEARANCE.paused.accent,
    headline: "Paused: your turn on the page",
    detail: "Open FluxIQ and press Hand back",
    step: "",
    fades: false
  });
  assert.equal(ACTIVITY_PHASE_APPEARANCE.paused.name, "Paused");
  const running = activityOverlayView(display({ phase: "paused" }), "expanded");
  assert.equal(running?.detail, "Running step 2 of 5: Open the cart", "only a held run, not a stray phase on working display, takes the paused words");
});
