// Coverage of overlay.ts: the overlay draws the background's paced display as
// it arrives, as the panel's status row does, so the two say the same thing at
// the same moment (the pace itself is pinned in background/activity/tests/
// pacer.test.ts); a display older than the one drawn for the same unit of work
// -- a paced send overtaken by the at-once answer to a new document -- is not
// drawn over the newer one; the overlay never leaves the page while work goes
// on; a display marked as the model's words (`kind: "thought"`) keeps the
// action line up; and the starting status gives way to the first activity.
//
// The overlay is one per content script, so its state carries from test to
// test: each test ends by taking the overlay down, which resets it.

import assert from "node:assert/strict";
import test from "node:test";

import { ACTIVITY_MESSAGES, type ActivityContentMessage, type ActivityDisplay } from "../../../shared/activity";
import { showActivityOverlay } from "../overlay";
import { withFakeClock } from "./fake-clock";
import { withFakeDom, type FakeNode } from "./fake-dom";

function message(sequence: number, detail: string, overrides: Partial<ActivityDisplay> = {}): ActivityContentMessage {
  const display: ActivityDisplay = {
    activityId: "build:overlay",
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

function takeDown(): ActivityContentMessage {
  return { ...message(0, ""), display: null };
}

// D7 of the t174 UI review of run-musp8nz1-dbd3905a (moments 3 and 4, 00006):
// the panel's status row said "Deciding the next step" while the overlay still
// said "Clicking “Get coupons”" for most of a second, because the overlay held
// each line back for a dwell of its own on top of the background's pace. Both
// surfaces draw the one paced display, so the overlay draws it as it comes.
test("the overlay draws each display as it arrives, as the panel's status row does", () => {
  withFakeClock(() => withFakeDom((dom) => {
    showActivityOverlay(takeDown());
    const text = () => (dom.documentElement.children[0] as FakeNode | undefined)?.shadow?.textContent ?? "";
    showActivityOverlay(message(1, "Clicking “Get coupons”", { activityId: "build:same" }));
    showActivityOverlay(message(2, "Deciding the next step", { activityId: "build:same" }));
    assert.ok(text().includes("Deciding the next step"), `the overlay says what the panel says: ${text()}`);
    showActivityOverlay(takeDown());
  }));
});

test("the overlay stays on the page while the work goes on, and a settled status is drawn at once", () => {
  withFakeClock((clock) => withFakeDom((dom) => {
    showActivityOverlay(takeDown());
    const host = () => dom.documentElement.children[0] as FakeNode | undefined;
    const text = () => host()?.shadow?.textContent ?? "";
    showActivityOverlay(message(1, "Clicking “Friends”", { activityId: "build:settle" }));
    const first = host();
    for (const [index, detail] of ["Deciding the next step", "Clicking “Close chat”", "Reading the list"].entries()) {
      clock.advance(1_600);
      showActivityOverlay(message(index + 2, detail, { activityId: "build:settle" }));
      assert.ok(text().includes(detail), detail);
      assert.equal(host(), first, "the overlay never left the page while the work went on");
    }
    showActivityOverlay(message(9, "", { activityId: "build:settle", headline: "Flow ready", working: false, outcome: "done" }));
    assert.ok(text().includes("Flow ready"), "the final status reached the page");
    showActivityOverlay(takeDown());
  }));
});

test("an older display of the same work is ignored; a new unit of work or a take-down always applies", () => {
  withFakeClock(() => withFakeDom((dom) => {
    showActivityOverlay(takeDown());
    const text = () => (dom.documentElement.children[0] as FakeNode | undefined)?.shadow?.textContent ?? "";
    showActivityOverlay(message(5, "Newer sentence", { activityId: "build:b1" }));
    showActivityOverlay(message(3, "Older sentence", { activityId: "build:b1" }));
    assert.ok(text().includes("Newer sentence"));
    showActivityOverlay(message(1, "A new build", { activityId: "build:b2" }));
    assert.ok(text().includes("A new build"));
    showActivityOverlay(takeDown());
    assert.equal(dom.documentElement.children.length, 0);
  }));
});

// D6 and D13 of the run-musp4h2f-72e8ed99 UI review: the overlay showed a
// refusal's prose ("That step has no such value to make vary; ... so this was
// not done: adding the pape…") and the model's reason for its next press
// ("Store chooser is open; I'll press …") while the page had already changed.
// The overlay says the phase and the current action only: a thought row's
// words never reach it, the action line up stays, and the action that follows
// is not held back behind words that were never the action.
test("a thought's prose -- a refusal or the model's reason -- never reaches the overlay; the action line stays and the next action shows at once", () => {
  withFakeClock((clock) => withFakeDom((dom) => {
    showActivityOverlay(takeDown());
    const text = () => (dom.documentElement.children[0] as FakeNode | undefined)?.shadow?.textContent ?? "";
    // The display as a background that marked it a thought, but still carrying the words, sends it.
    const thought = (sequence: number, words: string): ActivityContentMessage => ({
      ...message(sequence, words, { activityId: "build:prose", kind: "thought" }),
      activity: thoughtEvent(sequence, words)
    });
    showActivityOverlay(message(1, "Deciding the next step", { activityId: "build:prose" }));
    clock.advance(2_000);
    const refusal = "That step has no such value to make vary; and a repeat goes on what is done to each item, after the list it repeats over, so this was not done: adding the paper towels";
    showActivityOverlay(thought(2, refusal));
    clock.advance(2_000);
    assert.ok(!text().includes("no such value"), `no refusal prose on the page: ${text()}`);
    assert.ok(text().includes("Deciding the next step"), "the action line up stays");
    showActivityOverlay(thought(3, "Store chooser is open; I'll press \"Set as my store\" for Millbrook Crossing Supercenter to switch the pickup store."));
    assert.ok(!text().includes("Store chooser is open"), "no model reason on the page");
    clock.advance(100);
    showActivityOverlay(message(4, "Clicking “Set as my store”", { activityId: "build:prose" }));
    assert.ok(text().includes("Clicking “Set as my store”"), "the action shows at once: the thought held nothing back");
    showActivityOverlay(takeDown());
  }));
});

test("the display's kind decides, never the raw event riding along: an action is drawn, a thought is not, whatever event the gate passed", () => {
  withFakeClock((clock) => withFakeDom((dom) => {
    showActivityOverlay(takeDown());
    const text = () => (dom.documentElement.children[0] as FakeNode | undefined)?.shadow?.textContent ?? "";
    const deciding = { ...message(1, "Deciding the next step", { activityId: "build:own", kind: "action" }), activity: { ...thoughtEvent(1, ""), detail: { kind: "thought" as const, title: "Deciding the next step", status: "started" as const } } };
    showActivityOverlay(deciding);
    assert.ok(text().includes("Deciding the next step"));
    clock.advance(2_000);
    showActivityOverlay({ ...message(2, "Clicking “Add to cart”", { activityId: "build:own", kind: "action" }), activity: thoughtEvent(3, "A newer reason") });
    assert.ok(text().includes("Clicking “Add to cart”"), "the activity riding along is a newer event, so it says nothing of this display");
    clock.advance(2_000);
    // The four-a-second gate passed a newer raw event than the display was built from (w7's residual).
    showActivityOverlay({ ...message(4, "Because the cart is next.", { activityId: "build:own", kind: "thought" }), activity: { ...thoughtEvent(5, ""), detail: { kind: "tool" as const, title: "Clicking “Checkout”", status: "started" as const, ref: "core.run_node" } } });
    clock.advance(2_000);
    assert.ok(!text().includes("Because the cart is next."), `a thought display is never drawn as status: ${text()}`);
    assert.ok(text().includes("Clicking “Add to cart”"), "the action line up stays");
    showActivityOverlay(takeDown());
  }));
});

// D14: the starting status the background puts up on send is drawn at once, and Core's first activity replaces it.
test("the starting status is drawn at once and gives way to the build's first activity", () => {
  withFakeClock((clock) => withFakeDom((dom) => {
    showActivityOverlay(takeDown());
    const text = () => (dom.documentElement.children[0] as FakeNode | undefined)?.shadow?.textContent ?? "";
    showActivityOverlay(message(0, "", { activityId: "starting:1", headline: "Starting…", detail: null, kind: "starting" }));
    assert.ok(text().includes("Starting…"), "on the page from the send");
    clock.advance(1_000);
    showActivityOverlay(message(1, "Reading your request", { activityId: "build:first", kind: "action" }));
    clock.advance(2_000);
    assert.ok(text().includes("Building your Flow") && text().includes("Reading your request"), text());
    assert.ok(!text().includes("Starting…"));
    showActivityOverlay(takeDown());
  }));
});

function thoughtEvent(sequence: number, words: string): NonNullable<ActivityContentMessage["activity"]> {
  return {
    activityId: "build:prose",
    sequence,
    subject: { kind: "build", id: "prose", projectId: "p" },
    phase: "building",
    label: "Didn't change the Flow",
    detail: { kind: "thought", title: "Didn't change the Flow", text: words, status: "failed" },
    at: "2026-10-03T18:04:26.000Z"
  };
}
