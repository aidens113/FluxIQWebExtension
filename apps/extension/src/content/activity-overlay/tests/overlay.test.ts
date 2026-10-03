// Coverage of overlay.ts: a display older than the one drawn for the same unit
// of work -- a paced send overtaken by the at-once answer to a new document --
// is not drawn over the newer one; and statuses that arrive faster than a
// person reads are held back (status-dwell.ts): each line stays up for the
// dwell, the newest waiting one is shown, the last always reaches the page,
// and the overlay never leaves the page while work goes on.
//
// The overlay is one per content script, so its state carries from test to
// test: each test ends by taking the overlay down, which resets it.

import assert from "node:assert/strict";
import test from "node:test";

import { ACTIVITY_MESSAGES, type ActivityContentMessage, type ActivityDisplay } from "../../../shared/activity";
import { showActivityOverlay } from "../overlay";
import { withFakeClock } from "./fake-clock";
import { withFakeDom, type FakeNode } from "./fake-dom";

/** The shortest a line may stay up (the brief's floor); the dwell itself is pinned in status-dwell.test.ts. */
const SHORTEST_READABLE_MS = 700;
/** The longest the dwell may hold a line back. */
const LONGEST_DWELL_MS = 1_600;

function message(sequence: number, detail: string, overrides: Partial<ActivityDisplay> = {}): ActivityContentMessage {
  const display: ActivityDisplay = {
    activityId: "build:dwell",
    subjectKind: "build",
    phase: "thinking",
    headline: "Building your Flow",
    detail,
    step: null,
    working: true,
    outcome: null,
    sequence,
    ...overrides
  };
  return { type: ACTIVITY_MESSAGES.content, activity: null, display, overlay: "expanded", topFrameOnly: true };
}

test("rapid statuses are shown no faster than the dwell, the newest waiting one wins, and the last is never dropped", () => {
  withFakeClock((clock) => withFakeDom((dom) => {
    showActivityOverlay(takeDown());
    const host = () => dom.documentElement.children[0] as FakeNode | undefined;
    const text = () => host()?.shadow?.textContent ?? "";
    const drawnAt: Array<{ at: number; text: string }> = [];
    const sample = () => {
      if (drawnAt.at(-1)?.text !== text()) drawnAt.push({ at: clock.now(), text: text() });
    };

    showActivityOverlay(message(1, "Clicking “Friends” — done"));
    sample();
    const first = host();
    assert.ok(text().includes("Clicking “Friends” — done"), "the first status shows at once");

    // Five statuses inside 400 ms, as a busy build sends them.
    for (const [index, detail] of ["Deciding the next step", "Clicking “Close chat”", "Deciding the next step", "Reading the list", "Clicking “Confirm”"].entries()) {
      clock.advance(80);
      showActivityOverlay(message(index + 2, detail));
      sample();
      assert.ok(text().includes("Clicking “Friends” — done"), `still the first line at ${clock.now()} ms`);
    }
    for (let at = clock.now(); at < 4_000; at += 50) {
      clock.advance(50);
      sample();
    }
    assert.ok(text().includes("Clicking “Confirm”"), "the newest status is the one left on the page");
    assert.deepEqual(drawnAt.map((entry) => entry.text.replace("Building your Flow", "")), ["Clicking “Friends” — done", "Clicking “Confirm”"], "the overtaken statuses were never flashed");
    for (let index = 1; index < drawnAt.length; index += 1) {
      assert.ok(drawnAt[index]!.at - drawnAt[index - 1]!.at >= SHORTEST_READABLE_MS, `line ${index} stayed up for the dwell`);
    }
    assert.equal(host(), first, "the overlay never left the page while the work went on");
    showActivityOverlay(takeDown());
  }));
});

test("a settled status that arrives inside the dwell waits for it and is then shown, never dropped", () => {
  withFakeClock((clock) => withFakeDom((dom) => {
    showActivityOverlay(takeDown());
    const text = () => (dom.documentElement.children[0] as FakeNode | undefined)?.shadow?.textContent ?? "";
    showActivityOverlay(message(1, "Testing the Flow so far", { activityId: "build:settle" }));
    clock.advance(100);
    showActivityOverlay(message(2, "", { activityId: "build:settle", headline: "Flow ready", working: false, outcome: "done" }));
    assert.ok(text().includes("Testing the Flow so far"));
    clock.advance(LONGEST_DWELL_MS);
    assert.ok(text().includes("Flow ready"), "the final status reached the page");
    showActivityOverlay(takeDown());
  }));
});

function takeDown(): ActivityContentMessage {
  return { ...message(0, ""), display: null };
}

test("an older display of the same work is ignored; a new unit of work or a take-down always applies", () => {
  withFakeClock((clock) => withFakeDom((dom) => {
    showActivityOverlay(takeDown());
    const text = () => (dom.documentElement.children[0] as FakeNode | undefined)?.shadow?.textContent ?? "";
    showActivityOverlay(message(5, "Newer sentence", { activityId: "build:b1" }));
    showActivityOverlay(message(3, "Older sentence", { activityId: "build:b1" }));
    clock.advance(LONGEST_DWELL_MS);
    assert.ok(text().includes("Newer sentence"));
    showActivityOverlay(message(1, "A new build", { activityId: "build:b2" }));
    clock.advance(LONGEST_DWELL_MS);
    assert.ok(text().includes("A new build"));
    showActivityOverlay(takeDown());
    assert.equal(dom.documentElement.children.length, 0);
  }));
});

