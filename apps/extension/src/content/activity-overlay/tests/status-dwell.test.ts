// Coverage of status-dwell.ts on its own: only a change of words waits for the
// dwell; a take-down, a change of mode, and a status back to the words already
// up apply at once. How the dwell paces a stream of statuses on the page is in
// overlay.test.ts.

import assert from "node:assert/strict";
import test from "node:test";

import { STATUS_DWELL_MS, StatusDwell } from "../status-dwell";
import type { ActivityOverlayView } from "../overlay-view";
import { withFakeClock } from "./fake-clock";

function view(overrides: Partial<ActivityOverlayView> = {}): ActivityOverlayView {
  return { mode: "expanded", mark: "pulse", accent: "#f5b94a", headline: "Building your Flow", detail: "One", step: "", fades: false, ...overrides };
}

test("the dwell holds only a change of words: a take-down and a change of mode apply at once", () => {
  withFakeClock((clock) => {
    const drawn: Array<ActivityOverlayView | null> = [];
    const dwell = new StatusDwell((next) => drawn.push(next));
    dwell.show(view());
    clock.advance(10);
    dwell.show(view({ mode: "collapsed" }));
    assert.equal(drawn.length, 2, "a mode change with the same words is drawn at once");
    dwell.show(view({ mode: "collapsed", detail: "Two" }));
    assert.equal(drawn.length, 2, "new words wait");
    dwell.show(null);
    assert.deepEqual(drawn.at(-1), null, "a take-down is at once");
    assert.equal(clock.pending(), 0, "and nothing waiting is drawn after it");
    dwell.show(view({ detail: "Three" }));
    assert.equal(drawn.at(-1)?.detail, "Three", "after a take-down the next status shows at once");
  });
});

test("a status back to the words already up cancels the one waiting, so nothing flashes", () => {
  withFakeClock((clock) => {
    const drawn: Array<ActivityOverlayView | null> = [];
    const dwell = new StatusDwell((next) => drawn.push(next));
    dwell.show(view({ detail: "Deciding the next step" }));
    clock.advance(100);
    dwell.show(view({ detail: "Clicking “Close chat”" }));
    clock.advance(100);
    dwell.show(view({ detail: "Deciding the next step" }));
    clock.advance(STATUS_DWELL_MS * 3);
    assert.deepEqual(drawn.map((entry) => entry?.detail), ["Deciding the next step", "Deciding the next step"]);
  });
});

test("the dwell reads a short line and allows at most two changes of words in any three seconds, the Lab's flicker window", () => {
  assert.ok(STATUS_DWELL_MS >= 700, `${STATUS_DWELL_MS} ms reads a three-to-five-word line`);
  // Three changes in a 3 s window read as flickering (packages/test-runner/src/run-scenario/ui-review/count-overlay-changes.ts).
  assert.ok(STATUS_DWELL_MS > 1_500, `${STATUS_DWELL_MS} ms keeps any 3 s to two changes of words`);
  assert.ok(STATUS_DWELL_MS <= 2_000, `${STATUS_DWELL_MS} ms does not leave a stale line up for long`);
});

// Lane D's moment 3 (run-murdouox-c5294247): three changes of words in three
// seconds at the background's 1.2 s pace, which the Lab reads as flickering.
test("status updates at the background's 1.2 s pace change the words at most twice in any three seconds, and end on the last", () => {
  withFakeClock((clock) => {
    const start = Date.now();
    const changes: number[] = [];
    const drawn: string[] = [];
    const dwell = new StatusDwell((next) => { if (next) { changes.push(Date.now() - start); drawn.push(next.detail); } });
    for (let index = 0; index < 8; index += 1) {
      dwell.show(view({ detail: `Line ${index}` }));
      clock.advance(1_200);
    }
    clock.advance(STATUS_DWELL_MS * 2);
    for (const at of changes) {
      const inWindow = changes.filter((other) => other >= at && other <= at + 3_000).length;
      assert.ok(inWindow <= 2, `${inWindow} changes within 3 s from ${at} ms: ${changes.join(", ")}`);
    }
    assert.equal(drawn.at(-1), "Line 7", "the last status is drawn");
  });
});

// D7 of the run-murwd8le-79e735a8 UI review: the person pressed Continue a
// moment after the ask appeared, and the overlay went on saying "Waiting for
// you" -- held back by the dwell -- while the panel had moved on.
test("waiting for the person begins and ends at once: the person is never kept waiting by the dwell", () => {
  withFakeClock((clock) => {
    const drawn: Array<ActivityOverlayView | null> = [];
    const dwell = new StatusDwell((next) => drawn.push(next));
    dwell.show(view({ detail: "Deciding the next step" }));
    clock.advance(100);
    const waiting = view({ mark: "attention", accent: "#f7d354", headline: "Waiting for you: answer in the FluxIQ panel", detail: "FluxIQ needs you: complete the check on this page, then press Continue." });
    dwell.show(waiting);
    assert.equal(drawn.at(-1)?.headline, waiting.headline, "the ask is drawn the moment it comes");
    clock.advance(300);
    dwell.show(view({ headline: "Fixing your Flow", detail: "" }));
    assert.equal(drawn.at(-1)?.headline, "Fixing your Flow", "the answer is taken the moment it is given");
    assert.equal(clock.pending(), 0);
  });
});
