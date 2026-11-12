// T1 coverage of the click verb's settled look (`click.ts`,
// `action-runtime/ignored-press/settled-look.ts`): a first press the page
// answered for a moment and then left as it was certainly did nothing (t517),
// and is pressed once more in the same command (t896, whose rows are
// `swallowed-first-press.test.ts`); one it answered only with its own notice
// is pressed once more the same way (t743, t898); a press answered by anything
// lasting passes.
// Moved out of `actions/tests/click.test.ts` on 2026-10-20; the faked page and
// watches are `actions/tests/click/`'s.

import assert from "node:assert/strict";
import { test } from "node:test";
import type { ActionabilityRejectionCode, PressSignal } from "../../../../action-runtime";
import { click, CLICK, FIRST_PRESS, SECOND_PRESS } from "..";

// A press that certainly did nothing (t517): social-network-feed's Post spins on its first press and turns back,
// posting nothing. The settled look (`ignored-press/settled-look.ts`) decides, and such a press is pressed once more
// in the same command (t896). Take the look out of `clickAction` and the first row below goes red.
const SETTLE_MS = 1_500; // `NO_EFFECT_SETTLE_MS` in the verb

test("a button that shows a brief busy state and then reverts, leaving the page as it was, is pressed once more, never handed to Core as no effect", async (t) => {
  const { result, events, unchangedAsked } = await click(t, { link: false, prevent: false }, undefined, CLICK, undefined, undefined, 1_000, { seen: ["change"], settledUnchanged: true });
  assert.equal(result.status, "succeeded");
  assert.equal(result.failure, undefined);
  assert.deepEqual(events, [...FIRST_PRESS, ...SECOND_PRESS], "the press made once more is the click's own, in the same command");
  assert.deepEqual(unchangedAsked, [SETTLE_MS, SETTLE_MS]);
});

test("a press whose answer stayed on the page passes as before, after the settled look", async (t) => {
  const { result, events, unchangedAsked } = await click(t, { link: false, prevent: false }, undefined, CLICK, undefined, undefined, 1_000, { seen: ["change"], settledUnchanged: false });
  assert.equal(result.status, "succeeded");
  assert.deepEqual(events, FIRST_PRESS);
  assert.deepEqual(unchangedAsked, [SETTLE_MS]);
});

test("a press answered by a request, a navigation or a focus move is never looked at again: it was answered", async (t) => {
  for (const signal of ["request", "navigation", "focus"] as PressSignal[]) {
    const { result, unchangedAsked } = await click(t, { link: false, prevent: false }, undefined, CLICK, undefined, undefined, 1_000, { seen: ["change", signal], settledUnchanged: true });
    assert.equal(result.status, "succeeded", signal);
    assert.deepEqual(unchangedAsked, [], signal);
  }
});

test("no command control is held to an answer, and a control now disabled or gone once settled was answered", async (t) => {
  const plain = await click(t, { link: false, prevent: false, plain: true }, undefined, CLICK, undefined, undefined, 1_000, { seen: ["change"], settledUnchanged: true });
  assert.equal(plain.result.status, "succeeded");
  assert.deepEqual(plain.events, FIRST_PRESS);
  // Looked at since t743, for a notice that may answer any control; an unchanged page alone fails none but a command control.
  assert.deepEqual(plain.unchangedAsked, [SETTLE_MS]);
  for (const againAs of ["disabled", "hidden"] as ActionabilityRejectionCode[]) {
    const { result, events } = await click(t, { link: false, prevent: false }, undefined, CLICK, undefined, undefined, 1_000, { seen: ["change"], settledUnchanged: true, pressableAgain: false, againAs });
    assert.equal(result.status, "succeeded", againAs);
    assert.deepEqual(events, FIRST_PRESS, againAs);
  }
  // A press that certainly did nothing is no more answered by a layer than one with no sign at all (t476, t896):
  // refused as covered, for the recovery to close the layer and make the press once more.
  const covered = await click(t, { link: false, prevent: false }, undefined, CLICK, undefined, undefined, 1_000, { seen: ["change"], settledUnchanged: true, pressableAgain: false, againAs: "covered" });
  assert.equal(covered.result.status, "failed");
  assert.equal(covered.result.failure?.code, "web.target.not_actionable");
  assert.deepEqual(covered.events, FIRST_PRESS);
});

// A widget that swaps its button for an identical copy and ignores the first press after a change (t878,
// run-mw4foote-9cbea70e: an Apply in a location panel). The pressed control is gone, but the command names a
// pressable copy in the same place and the page settled exactly as it was: nothing happened, and the press is made
// once more on the copy, in the same command (t896). Measure the detached control instead and the first row goes red.
test("a press whose control was swapped for a pressable copy, on a page settled exactly as it was, is pressed once more on the copy", async (t) => {
  const { result, ignored, unchangedAsked } = await click(t, { link: false, prevent: false }, undefined, CLICK, undefined, undefined, 1_000, { seen: ["change"], settledUnchanged: true, replaced: "copy" });
  assert.equal(result.status, "succeeded");
  assert.equal(result.failure, undefined);
  assert.equal(ignored.made, 2, "the second press is the click's own, on the copy");
  assert.deepEqual(unchangedAsked, [SETTLE_MS, SETTLE_MS]);
});

test("a press whose control was swapped for a copy and whose page changed landed, and is never pressed again", async (t) => {
  const { result, events } = await click(t, { link: false, prevent: false }, undefined, CLICK, undefined, undefined, 1_000, { seen: ["change"], settledUnchanged: false, replaced: "copy" });
  assert.equal(result.status, "succeeded");
  assert.equal(result.failure, undefined);
  assert.deepEqual(events, FIRST_PRESS);
});

test("a control gone with no copy the command names was answered by whatever removed it, and passes", async (t) => {
  const { result, events } = await click(t, { link: false, prevent: false }, undefined, CLICK, undefined, undefined, 1_000, { seen: ["change"], settledUnchanged: true, replaced: "gone" });
  assert.equal(result.status, "succeeded");
  assert.deepEqual(events, FIRST_PRESS);
});

// A press the page answered with nothing but its own notice (t743): a library's Reserve button whose first press
// shows a busy state, reverts, and puts an error in a status region, reserving nothing. The settled look answers
// "announced": as certain as a page settled exactly as it was, so since t898 the press is made once more in the same
// command, on any control, and only a second press that comes to nothing again fails, as PAGE_REPORTED_FAILURE
// (`notice-first-press.test.ts`). Never a success on the first press, so never a landed act.
const PRESSED_AFTER_NOTICE = "the page answered the first press with nothing but a notice in one of its own status or alert regions and left everything else exactly as before, so it was pressed once more";

test("a Reserve press the page answered only with its own notice is pressed once more in the same command, and passes on the press the page answers", async (t) => {
  const { result, events, unchangedAsked } = await click(t, { link: false, prevent: false }, undefined, CLICK, undefined, undefined, 1_000, { seen: ["change"], settledUnchanged: "announced" });
  assert.equal(result.status, "succeeded");
  assert.equal(result.failure, undefined, "no failure, so Core makes no retry of it");
  assert.deepEqual(events, [...FIRST_PRESS, ...SECOND_PRESS], "the press made once more is the click's own");
  assert.deepEqual(unchangedAsked, [SETTLE_MS, SETTLE_MS]);
  assert.equal(result.validation.status === "passed" ? result.validation.actual : "", `the point 10,20 landed on the target; ${PRESSED_AFTER_NOTICE}`);
});

test("a control that is not a command control, answered only with the page's notice, is pressed once more the same way", async (t) => {
  const { result, events, unchangedAsked } = await click(t, { link: false, prevent: false, plain: true }, undefined, CLICK, undefined, undefined, 1_000, { seen: ["change"], settledUnchanged: "announced" });
  assert.equal(result.status, "succeeded");
  assert.deepEqual(events, [...FIRST_PRESS, ...SECOND_PRESS]);
  assert.deepEqual(unchangedAsked, [SETTLE_MS, SETTLE_MS]);
});

test("a press answered by a request or a lasting change is a success whatever notice came with it: the look is never asked or answers false", async (t) => {
  for (const signal of ["request", "navigation", "focus"] as PressSignal[]) {
    const { result, unchangedAsked } = await click(t, { link: false, prevent: false }, undefined, CLICK, undefined, undefined, 1_000, { seen: ["change", signal], settledUnchanged: "announced" });
    assert.equal(result.status, "succeeded", signal);
    assert.deepEqual(unchangedAsked, [], signal);
  }
  const stayed = await click(t, { link: false, prevent: false }, undefined, CLICK, undefined, undefined, 1_000, { seen: ["change"], settledUnchanged: false });
  assert.equal(stayed.result.status, "succeeded");
});

test("a control gone or disabled after the notice was answered by whatever removed it, and passes, pressed once", async (t) => {
  for (const againAs of ["disabled", "hidden"] as ActionabilityRejectionCode[]) {
    const { result, events } = await click(t, { link: false, prevent: false }, undefined, CLICK, undefined, undefined, 1_000, { seen: ["change"], settledUnchanged: "announced", pressableAgain: false, againAs });
    assert.equal(result.status, "succeeded", againAs);
    assert.deepEqual(events, FIRST_PRESS, againAs);
  }
});

test("the press the click made once more is never handed to Core to press a third time", async (t) => {
  const { result, events, unchangedAsked } = await click(t, { link: false, prevent: false }, undefined, CLICK, undefined, undefined, 1_000, { seen: [], secondSeen: ["change"], settledUnchanged: true });
  assert.equal(result.status, "succeeded");
  assert.deepEqual(events, [...FIRST_PRESS, ...SECOND_PRESS]);
  assert.deepEqual(unchangedAsked, [], "only a first press is looked at again");
});

test("a command's own timeout shortens the settled look's window, and never lengthens it", async (t) => {
  const shorter = await click(t, { link: false, prevent: false }, undefined, { ...CLICK, timeoutMs: 600 }, undefined, undefined, 1_000, { seen: ["change"] });
  assert.deepEqual(shorter.unchangedAsked, [600]);
});
