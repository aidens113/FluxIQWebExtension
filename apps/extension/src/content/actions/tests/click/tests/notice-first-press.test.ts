// T1 coverage of a first press the page answered with nothing but its own
// notice (t898, `click.ts`): company-website's Show more people swallows the
// first press after every load and shows only a "Loading more people" line in
// its `role="status"` region. The settled look answers `"announced"` only when
// no request, navigation or focus move came at any point, nothing outside the
// control's section changed but notice regions, and the section settled exactly
// as before (`ignored-press/settled-look.ts`), so the press certainly did
// nothing (`web.action.page_reported_failure` is `certainNoEffect`). Until t898
// it failed at once for Core to press again, and every replay of a Flow through
// that button carried a Core retry. It is now pressed once more in the same
// command, as a press that settled exactly as it was is (t896).
//
// The rows hold:
// - a notice-only first press, answered on the second press, is one command
//   with two presses, and succeeds;
// - answered with nothing but a notice again, or settled exactly as before, it
//   fails as `web.action.page_reported_failure`, certain, after exactly two
//   presses: the failure the first press itself was until t898;
// - a first press with any sign it landed is never pressed again;
// - a first press the page ignored outright is pressed once more as before.

import assert from "node:assert/strict";
import { test } from "node:test";
import { extraPressesMade, type PressSignal } from "../../../../action-runtime";
import { click, CLICK, FIRST_PRESS, SECOND_PRESS } from "..";

/** `NO_EFFECT_SETTLE_MS` in the verb. */
const SETTLE_MS = 1_500;
const BUTTON = { link: false, prevent: false } as const;
const PLAIN = { link: false, prevent: false, plain: true } as const;
const HIT = "the point 10,20 landed on the target";
const PRESSED_AFTER_NOTICE = "the page answered the first press with nothing but a notice in one of its own status or alert regions and left everything else exactly as before, so it was pressed once more";
const NOTICE = { seen: ["change"] as PressSignal[], settledUnchanged: "announced" as const };

test("Show more people answered only with a loading notice is pressed once more in the same command, and the press that loads is never pressed again", async (t) => {
  const { result, command, events, unchangedAsked } = await click(t, BUTTON, undefined, CLICK, undefined, undefined, 1_000, { ...NOTICE, secondSeen: ["change", "request"] });
  assert.equal(result.status, "succeeded");
  assert.equal(result.failure, undefined, "no failure, so Core makes no retry of it");
  assert.deepEqual(events, [...FIRST_PRESS, ...SECOND_PRESS], "two presses in one command, never a third");
  assert.deepEqual(unchangedAsked, [SETTLE_MS], "a press made once more that began a request was answered, and is not looked at again");
  assert.equal(extraPressesMade(command), 1, "the press made once more is the command's one extra press");
  assert.deepEqual(result.validation, { status: "passed", expected: "the click lands on the target or something inside it", actual: `${HIT}; ${PRESSED_AFTER_NOTICE}` });
});

test("a second press whose change stayed passes after it is looked at, pressed twice in all", async (t) => {
  const { result, events, unchangedAsked } = await click(t, BUTTON, undefined, CLICK, undefined, undefined, 1_000, { ...NOTICE, secondSeen: ["change"], secondSettledUnchanged: false });
  assert.equal(result.status, "succeeded");
  assert.deepEqual(events, [...FIRST_PRESS, ...SECOND_PRESS]);
  assert.deepEqual(unchangedAsked, [SETTLE_MS, SETTLE_MS]);
});

const NOTICE_TWICE_ACTUAL = `${HIT}; ${PRESSED_AFTER_NOTICE}, and the page answered that press too with nothing but a notice in one of its own status or alert regions; the control can still be pressed`;

test("a notice-only press answered with nothing but a notice again fails as the page reporting it failed, certain, after exactly two presses", async (t) => {
  for (const behaviour of [BUTTON, PLAIN]) {
    const said = behaviour === PLAIN ? "plain" : "button";
    const { result, command, events, unchangedAsked } = await click(t, behaviour, undefined, CLICK, undefined, undefined, 1_000, { ...NOTICE, secondSeen: ["change"], secondSettledUnchanged: "announced" });
    assert.equal(result.status, "failed", said);
    assert.deepEqual(result.failure, {
      category: "action_failed",
      code: "web.action.page_reported_failure",
      retryable: true,
      stage: "execution",
      expected: "the page answers the press",
      actual: NOTICE_TWICE_ACTUAL,
      effect: "unacted",
      certainNoEffect: true
    }, said);
    assert.deepEqual(events, [...FIRST_PRESS, ...SECOND_PRESS], `${said}: exactly two presses in this command, never a third`);
    assert.deepEqual(unchangedAsked, [SETTLE_MS, SETTLE_MS], `${said}: each press made only after a certain-nothing verdict on the one before`);
    assert.equal(extraPressesMade(command), 1, said);
  }
});

test("a notice-only press whose second press left the page exactly as before, the notice still standing, fails the same way on any control", async (t) => {
  for (const behaviour of [BUTTON, PLAIN]) {
    const said = behaviour === PLAIN ? "plain" : "button";
    const { result, events } = await click(t, behaviour, undefined, CLICK, undefined, undefined, 1_000, { ...NOTICE, secondSeen: ["change"], secondSettledUnchanged: true });
    assert.equal(result.status, "failed", said);
    assert.equal(result.failure?.code, "web.action.page_reported_failure", said);
    assert.equal(result.failure?.certainNoEffect, true, said);
    assert.equal(result.failure?.actual, `${HIT}; ${PRESSED_AFTER_NOTICE}, and that press too left the page exactly as before, its notice regions aside: no request, no navigation, no focus move, nothing outside the control's section; the control can still be pressed`, said);
    assert.deepEqual(events, [...FIRST_PRESS, ...SECOND_PRESS], said);
  }
});

test("a notice-only press whose second press showed no sign at all fails as not observed, which is not certain", async (t) => {
  const { result, events, unchangedAsked } = await click(t, BUTTON, undefined, CLICK, undefined, undefined, 1_000, { ...NOTICE, secondSeen: [] });
  assert.equal(result.status, "failed");
  assert.equal(result.failure, undefined, "the builder reports it as not observed: the watch that saw nothing does not look outside the section");
  assert.equal(result.validation.status === "failed" ? result.validation.actual : "", `${HIT}; ${PRESSED_AFTER_NOTICE}, and it ignored that press: no request, no change inside the control or its section, no navigation and no focus move`);
  assert.deepEqual(events, [...FIRST_PRESS, ...SECOND_PRESS]);
  assert.deepEqual(unchangedAsked, [SETTLE_MS]);
});

test("a first press with any sign it landed -- a request, a navigation, a focus move, a lasting change -- is never pressed again, whatever notice came with it", async (t) => {
  for (const signal of ["request", "navigation", "focus"] as PressSignal[]) {
    const { result, command, events, unchangedAsked } = await click(t, BUTTON, undefined, CLICK, undefined, undefined, 1_000, { seen: ["change", signal], settledUnchanged: "announced" });
    assert.equal(result.status, "succeeded", signal);
    assert.deepEqual(events, FIRST_PRESS, `${signal}: pressed once`);
    assert.deepEqual(unchangedAsked, [], `${signal}: an answered press is not looked at again`);
    assert.equal(extraPressesMade(command), 0, signal);
  }
  // The settled look found the section or the page changed and staying changed: answered.
  const lasting = await click(t, BUTTON, undefined, CLICK, undefined, undefined, 1_000, { seen: ["change"], settledUnchanged: false });
  assert.equal(lasting.result.status, "succeeded");
  assert.deepEqual(lasting.events, FIRST_PRESS);
  assert.equal(extraPressesMade(lasting.command), 0);
});

test("a notice-only press whose control a layer then covered is refused as covered, for the recovery to close it, as a press that settled as it was is", async (t) => {
  const { result, command, events } = await click(t, BUTTON, undefined, CLICK, undefined, undefined, 1_000, { ...NOTICE, pressableAgain: false, againAs: "covered" });
  assert.equal(result.status, "failed");
  assert.equal(result.failure?.code, "web.target.not_actionable");
  assert.deepEqual(events, FIRST_PRESS);
  assert.equal(extraPressesMade(command), 1, "the recovery's run of the click is the press made once more");
});

test("a first press the page ignored outright is pressed once more as before", async (t) => {
  const { result, events, unchangedAsked } = await click(t, BUTTON, undefined, CLICK, undefined, undefined, 1_000, { seen: [], secondSeen: ["change"] });
  assert.equal(result.status, "succeeded");
  assert.deepEqual(events, [...FIRST_PRESS, ...SECOND_PRESS]);
  assert.deepEqual(unchangedAsked, [], "a press with no sign at all has nothing to settle back");
  assert.equal(result.validation.status === "passed" ? result.validation.actual : "", `${HIT}; the page ignored the first press, so it was pressed once more`);
});
