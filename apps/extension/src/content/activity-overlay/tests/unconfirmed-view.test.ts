// A run that finished with its result not confirmed gets a neutral mark, chosen by the
// display's typed `unconfirmed` field: no tick, no cross, and it stays on the page.

import assert from "node:assert/strict";
import test from "node:test";
import type { ActivityDisplay } from "../../../shared/activity";
import { ACTIVITY_PHASE_APPEARANCE, ACTIVITY_UNCONFIRMED_APPEARANCE } from "../phase-appearance";
import { activityOverlayView } from "../overlay-view";

function finished(overrides: Partial<ActivityDisplay> = {}): ActivityDisplay {
  return {
    activityId: "run:run-1",
    subjectKind: "run",
    phase: "done",
    headline: "Run finished",
    detail: null,
    step: null,
    working: false,
    outcome: "done",
    sequence: 9,
    ...overrides
  };
}

test("an unconfirmed finish has the neutral mark and does not fade", () => {
  const view = activityOverlayView(finished({ unconfirmed: true, headline: "Run finished, result not confirmed" }), "expanded");
  assert.deepEqual([view?.mark, view?.accent, view?.fades], [ACTIVITY_UNCONFIRMED_APPEARANCE.mark, ACTIVITY_UNCONFIRMED_APPEARANCE.accent, false]);
  assert.notEqual(view?.mark, "check");
  assert.notEqual(view?.mark, "cross");
  assert.notEqual(view?.accent, ACTIVITY_PHASE_APPEARANCE.done.accent);
});

test("the field decides, not the words: a plain finish keeps its tick whatever it says", () => {
  const view = activityOverlayView(finished({ headline: "Run finished, result not confirmed" }), "expanded");
  assert.deepEqual([view?.mark, view?.fades], ["check", true]);
});
