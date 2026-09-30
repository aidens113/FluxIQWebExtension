// What the overlay says for a paced display, without a DOM: the headline, the
// detail and the step as the background paced them, a mark and colour that
// follow the unit of work rather than Core's phase, and which preference
// shows what.

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
    settled: false
  });
});

test("the mark and colour follow the unit of work, not Core's phase of the moment", () => {
  for (const phase of ["thinking", "exploring", "verifying", "building"] as const) {
    const view = activityOverlayView(display({ subjectKind: "build", activityId: "build:b", headline: "Building your Flow", phase, step: null }), "expanded");
    assert.equal(view?.accent, ACTIVITY_PHASE_APPEARANCE.building.accent, phase);
    assert.equal(view?.mark, "pulse", phase);
  }
});

test("settled displays: done and failed fade, waiting for the person does not", () => {
  const done = activityOverlayView(display({ working: false, outcome: "done", headline: "Run finished", step: null }), "expanded");
  assert.deepEqual([done?.mark, done?.accent, done?.settled], ["check", ACTIVITY_PHASE_APPEARANCE.done.accent, true]);
  const failed = activityOverlayView(display({ working: false, outcome: "failed", headline: "Run failed" }), "expanded");
  assert.deepEqual([failed?.mark, failed?.settled, failed?.step], ["cross", true, ""], "a settled view shows no step");
  const waiting = activityOverlayView(display({ working: false, outcome: "waiting", headline: "Waiting for you" }), "expanded");
  assert.deepEqual([waiting?.mark, waiting?.accent, waiting?.settled], ["attention", ACTIVITY_PHASE_APPEARANCE.waiting_permission.accent, false]);
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
  assert.equal(view?.settled, false, "waiting for the person does not fade");
});
