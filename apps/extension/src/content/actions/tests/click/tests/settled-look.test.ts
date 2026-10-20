// T1 coverage of the click verb's settled look (`click.ts`,
// `action-runtime/ignored-press/settled-look.ts`): a first press the page
// answered for a moment and then left as it was fails as certainly without
// effect (t517), and one it answered only with its own notice fails as the page
// reporting it failed (t743); a press answered by anything lasting passes.
// Moved out of `actions/tests/click.test.ts` on 2026-10-20; the faked page and
// watches are `actions/tests/click/`'s.

import assert from "node:assert/strict";
import { test } from "node:test";
import type { ActionabilityRejectionCode, PressSignal } from "../../../../action-runtime";
import { click, CLICK, FIRST_PRESS, SECOND_PRESS } from "..";

// A press that certainly did nothing (t517): social-network-feed's Post spins on its first press and turns back,
// posting nothing. The settled look (`ignored-press/settled-look.ts`) decides, and such a press fails as NO_EFFECT,
// marked certainNoEffect, for Core to make once more. Take the look out of `clickAction` and the first row goes red.
const SETTLE_MS = 1_500; // `NO_EFFECT_SETTLE_MS` in the verb

test("a button that shows a brief busy state and then reverts, leaving the page as it was, fails as certainly without effect", async (t) => {
  const { result, events, unchangedAsked } = await click(t, { link: false, prevent: false }, undefined, CLICK, undefined, undefined, 1_000, { seen: ["change"], settledUnchanged: true });
  assert.equal(result.status, "failed");
  assert.deepEqual(events, FIRST_PRESS, "the click itself presses once: the press made once more is Core's");
  assert.deepEqual(unchangedAsked, [SETTLE_MS]);
  assert.deepEqual(result.failure, {
    category: "action_failed",
    code: "web.action.no_effect",
    retryable: true,
    stage: "execution",
    expected: "the page answers the press",
    actual: "the point 10,20 landed on the target; the page changed only for a moment, and once it settled nothing on it had changed: no request, no navigation, no focus move, nothing outside the control's section, and the section exactly as before the press; the control can still be pressed",
    effect: "unacted",
    certainNoEffect: true
  });
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

test("no command control is held to an answer, and a control no longer pressable once settled was answered", async (t) => {
  const plain = await click(t, { link: false, prevent: false, plain: true }, undefined, CLICK, undefined, undefined, 1_000, { seen: ["change"], settledUnchanged: true });
  assert.equal(plain.result.status, "succeeded");
  // Looked at since t743, for a notice that may answer any control; an unchanged page alone fails none but a command control.
  assert.deepEqual(plain.unchangedAsked, [SETTLE_MS]);
  for (const againAs of ["disabled", "hidden", "covered"] as ActionabilityRejectionCode[]) {
    const { result } = await click(t, { link: false, prevent: false }, undefined, CLICK, undefined, undefined, 1_000, { seen: ["change"], settledUnchanged: true, pressableAgain: false, againAs });
    assert.equal(result.status, "succeeded", againAs);
  }
});

// A press the page answered with nothing but its own notice (t743): a library's Reserve button whose first press
// shows a busy state, reverts, and puts an error in a status region, reserving nothing. The settled look answers
// "announced", and the press fails as PAGE_REPORTED_FAILURE, unacted and certain, for Core to make again under its
// ordinary retries -- never a success, so never a landed act. Take the branch out of `clickAction` and these go red.
const NOTICE_ONLY_ACTUAL = "the point 10,20 landed on the target; once the page settled, the press had brought nothing but a notice in one of the page's own status or alert regions: no request, no navigation, no focus move, nothing else outside the control's section, and the control and its section exactly as before the press; the control can still be pressed";

test("a Reserve press the page answered only with its own notice fails as the page reporting it failed, pressed once, for Core to make again", async (t) => {
  const { result, events, unchangedAsked } = await click(t, { link: false, prevent: false }, undefined, CLICK, undefined, undefined, 1_000, { seen: ["change"], settledUnchanged: "announced" });
  assert.equal(result.status, "failed");
  assert.deepEqual(events, FIRST_PRESS, "the click itself presses once: the next press is Core's retry");
  assert.deepEqual(unchangedAsked, [SETTLE_MS]);
  assert.deepEqual(result.failure, {
    category: "action_failed",
    code: "web.action.page_reported_failure",
    retryable: true,
    stage: "execution",
    expected: "the page carries the press out",
    actual: NOTICE_ONLY_ACTUAL,
    effect: "unacted",
    certainNoEffect: true
  });
});

test("a control that is not a command control, answered only with the page's notice, fails the same way", async (t) => {
  const { result, unchangedAsked } = await click(t, { link: false, prevent: false, plain: true }, undefined, CLICK, undefined, undefined, 1_000, { seen: ["change"], settledUnchanged: "announced" });
  assert.equal(result.status, "failed");
  assert.equal(result.failure?.code, "web.action.page_reported_failure");
  assert.deepEqual(unchangedAsked, [SETTLE_MS]);
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

test("a control gone or disabled after the notice was answered by whatever removed it, and passes", async (t) => {
  for (const againAs of ["disabled", "hidden"] as ActionabilityRejectionCode[]) {
    const { result } = await click(t, { link: false, prevent: false }, undefined, CLICK, undefined, undefined, 1_000, { seen: ["change"], settledUnchanged: "announced", pressableAgain: false, againAs });
    assert.equal(result.status, "succeeded", againAs);
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
