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

test("nothing the overlay adds of its own is a raw id: fallback headlines, step counts", () => {
  const rawId = /\b[a-z]+\.[a-z_]+/u;
  for (const [phase, appearance] of Object.entries(ACTIVITY_PHASE_APPEARANCE)) assert.doesNotMatch(appearance.name, rawId, phase);
  for (const outcome of ["done", "failed", "waiting", null] as const) {
    const view = activityOverlayView(display({ headline: "", detail: null, outcome, working: outcome === null }), "expanded");
    for (const text of [view?.headline ?? "", view?.detail ?? "", view?.step ?? ""]) assert.doesNotMatch(text, rawId, String(outcome));
  }
});
