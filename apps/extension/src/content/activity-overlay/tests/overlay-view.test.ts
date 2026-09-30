// What the overlay says for an activity event, without a DOM. How it looks
// and stays out of the page's way is the content harness's
// (`e2e/content/tests/activity-overlay/tests/activity-overlay.spec.ts`).

import assert from "node:assert/strict";
import test from "node:test";
import type { ClientGatewayActivity } from "../../../shared/activity";
import { ACTIVITY_PHASE_APPEARANCE } from "../phase-appearance";
import { activityOverlayView } from "../overlay-view";

function activity(overrides: Partial<ClientGatewayActivity> = {}): ClientGatewayActivity {
  return {
    activityId: "run-1",
    sequence: 4,
    subject: { kind: "run", id: "run-1", projectId: "project-1" },
    phase: "running",
    label: "Running step 2 of 5: Open the cart",
    at: "2026-09-29T10:00:00.000Z",
    ...overrides
  };
}

test("an expanded view carries the phase, Core's sentence, the step and the latest detail title", () => {
  const view = activityOverlayView(activity({
    step: { index: 2, count: 5, nodeId: "n2", label: "Open the cart" },
    detail: { kind: "step", title: "Open the cart", status: "started", ref: "n2" }
  }), "expanded");
  assert.deepEqual(view, {
    mode: "expanded",
    phaseName: "Running",
    accent: ACTIVITY_PHASE_APPEARANCE.running.accent,
    mark: "pulse",
    label: "Running step 2 of 5: Open the cart",
    step: "Step 2 of 5",
    stepShort: "2/5",
    detail: "Open the cart",
    final: false
  });
});

test("nothing is shown for no activity or a hidden overlay", () => {
  assert.equal(activityOverlayView(null, "expanded"), null);
  assert.equal(activityOverlayView(activity(), "hidden"), null);
});

test("collapsed keeps the same words and says it is a pill", () => {
  const view = activityOverlayView(activity({ step: { index: 1, count: 3 } }), "collapsed");
  assert.equal(view?.mode, "collapsed");
  assert.equal(view?.phaseName, "Running");
  assert.equal(view?.stepShort, "1/3");
});

test("a loop that runs past the flow's count says the step plainly, never an impossible fraction", () => {
  const view = activityOverlayView(activity({ step: { index: 7, count: 5 } }), "expanded");
  assert.equal(view?.step, "Step 7");
  assert.equal(view?.stepShort, "7");
  assert.equal(activityOverlayView(activity({ step: { index: 0, count: 5 } }), "expanded")?.step, undefined);
});

test("settled phases get a still glyph, and a final event is marked to fade", () => {
  assert.equal(activityOverlayView(activity({ phase: "done", final: true }), "expanded")?.mark, "check");
  assert.equal(activityOverlayView(activity({ phase: "done", final: true }), "expanded")?.final, true);
  assert.equal(activityOverlayView(activity({ phase: "failed", final: true }), "expanded")?.mark, "cross");
  assert.equal(activityOverlayView(activity({ phase: "waiting_permission" }), "expanded")?.phaseName, "Waiting for you");
});

test("a phase this build does not know is shown neutrally rather than dropped", () => {
  const view = activityOverlayView(activity({ phase: "summarising" as ClientGatewayActivity["phase"] }), "expanded");
  assert.equal(view?.phaseName, "Working");
  assert.equal(view?.mark, "pulse");
});

test("a runaway sentence is bounded and whitespace collapsed; an empty one falls back to the phase name", () => {
  const long = activityOverlayView(activity({ label: `  ${"x".repeat(400)}\n` }), "expanded");
  assert.equal(long?.label.length, 160);
  assert.ok(long?.label.endsWith("…"));
  assert.equal(activityOverlayView(activity({ label: "   " }), "expanded")?.label, "Running");
});

/** WCAG relative luminance of an sRGB colour. */
function luminance([r, g, b]: readonly number[]): number {
  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r!) + 0.7152 * channel(g!) + 0.0722 * channel(b!);
}

function contrast(left: readonly number[], right: readonly number[]): number {
  const [light, dark] = [luminance(left), luminance(right)].sort((a, b) => b - a) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}

test("every phase accent reads at 4.5:1 on the card, over a white page and a black one", () => {
  // The card is rgba(22, 24, 31, 0.94) (`overlay.ts`), composited over the page.
  const card = (page: number) => [22, 24, 31].map((channel) => channel * 0.94 + page * 0.06);
  for (const [phase, appearance] of Object.entries(ACTIVITY_PHASE_APPEARANCE)) {
    const accent = [1, 3, 5].map((offset) => Number.parseInt(appearance.accent.slice(offset, offset + 2), 16));
    for (const page of [255, 0]) {
      const ratio = contrast(accent, card(page));
      assert.ok(ratio >= 4.5, `${phase} is ${ratio.toFixed(2)}:1 over a ${page ? "white" : "black"} page`);
    }
  }
});
