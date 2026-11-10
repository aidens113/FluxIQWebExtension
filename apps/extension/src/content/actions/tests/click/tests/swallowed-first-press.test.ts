// T1 coverage of a first press the page swallowed (t896, `click.ts`): a press
// whose only answer was a change in its section that came and went, after which
// the page settled exactly as it was (the settled look, t517), certainly did
// nothing, and is pressed once more inside the same command. Until t896 it
// failed as `web.action.no_effect` for Core to press once more, so every replay
// through local-classifieds' radius Apply, which swallows the first press after
// its select changes, carried a Core retry and could not stand on its record
// (`run-mwazisjn-ab645012`). social-network-feed's Post is the same press: it
// spins for 450 ms, turns back into Post and posts nothing; the second press
// posts.
//
// The rows hold four things, and each goes red against HEAD before t896:
// - a swallowed first press is one command with two presses, and succeeds;
// - a press made once more with any sign of landing is never pressed again;
// - both presses certainly ignored fail as `web.action.no_effect`
//   (`certainNoEffect`) after exactly two presses in that command, for Core to
//   make again under its first attempt and three retries (t528), each attempt
//   a fresh command pressing at most twice, every press after a certain-nothing
//   verdict;
// - the press made once more is the command's one extra press, counted against
//   the command (`command-presses.ts`): made after a layer was closed, it is not
//   looked at again.

import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { extraPressesMade, type ActionabilityReport, type PressSignal } from "../../../../action-runtime";
import { runWithRecovery, type RecoveryFault } from "../../../../action-runtime/recovery";
import type { BrowserActionCommand, BrowserActionResult } from "../../../../types";
import { clickAction } from "../../../click";
import type { ContentActionDependencies } from "../../../types";
import { click, CLICK, dependencies, fakeCheckWatch, fakeNoticeWatch, fakePage, fakeWatch, FIRST_PRESS, installMouseEvent, notPressable, PRESSABLE, SECOND_PRESS, type IgnoredRecord } from "..";

/** `NO_EFFECT_SETTLE_MS` in the verb. */
const SETTLE_MS = 1_500;
const BUTTON = { link: false, prevent: false } as const;
const HIT = "the point 10,20 landed on the target";
const PRESSED_AFTER_SETTLED = "the first press changed the page only for a moment and left it exactly as before, so it was pressed once more";

test("a swallowed first press -- Post spins and turns back, posting nothing -- is pressed once more in the same command, and the press that posts is never pressed again", async (t) => {
  const { result, command, events, unchangedAsked } = await click(t, BUTTON, undefined, CLICK, undefined, undefined, 1_000, { seen: ["change"], settledUnchanged: true, secondSeen: ["change", "request"] });
  assert.equal(result.status, "succeeded");
  assert.equal(result.failure, undefined, "no failure, so Core makes no retry of it");
  assert.deepEqual(events, [...FIRST_PRESS, ...SECOND_PRESS], "two presses in one command, never a third");
  assert.deepEqual(unchangedAsked, [SETTLE_MS], "a press made once more that began a request was answered, and is not looked at again");
  assert.equal(extraPressesMade(command), 1, "the press made once more is the command's one extra press");
  assert.deepEqual(result.validation, { status: "passed", expected: "the click lands on the target or something inside it", actual: `${HIT}; ${PRESSED_AFTER_SETTLED}` });
});

test("a swallowed Apply whose second press leaves a lasting change passes after that press is looked at, pressed twice in all", async (t) => {
  const { result, events, unchangedAsked } = await click(t, BUTTON, undefined, CLICK, undefined, undefined, 1_000, { seen: ["change"], settledUnchanged: true, secondSeen: ["change"], secondSettledUnchanged: false });
  assert.equal(result.status, "succeeded");
  assert.deepEqual(events, [...FIRST_PRESS, ...SECOND_PRESS]);
  assert.deepEqual(unchangedAsked, [SETTLE_MS, SETTLE_MS], "a second change that came and went would be no more an answer than the first");
});

test("a press made once more with any sign of landing -- a request, a navigation, a focus move -- is never pressed again", async (t) => {
  for (const signal of ["request", "navigation", "focus"] as PressSignal[]) {
    const { result, command, events, unchangedAsked } = await click(t, BUTTON, undefined, CLICK, undefined, undefined, 1_000, { seen: ["change"], settledUnchanged: true, secondSeen: [signal], secondSettledUnchanged: true });
    assert.equal(result.status, "succeeded", signal);
    assert.equal(result.failure, undefined, signal);
    assert.deepEqual(events, [...FIRST_PRESS, ...SECOND_PRESS], `${signal}: two presses, never a third`);
    assert.deepEqual(unchangedAsked, [SETTLE_MS], `${signal}: an answered press is not looked at again`);
    assert.equal(extraPressesMade(command), 1, signal);
  }
});

const SETTLED_TWICE_ACTUAL = `${HIT}; ${PRESSED_AFTER_SETTLED}, and that press too changed the page only for a moment and left it exactly as before: no request, no navigation, no focus move, nothing outside the control's section`;

test("both presses certainly ignored fail as no effect, certain, after exactly two presses in that command, for Core's ordinary retries", async (t) => {
  const { result, command, events, unchangedAsked } = await click(t, BUTTON, undefined, CLICK, undefined, undefined, 1_000, { seen: ["change"], settledUnchanged: true, secondSeen: ["change"], secondSettledUnchanged: true });
  assert.equal(result.status, "failed");
  assert.deepEqual(result.failure, {
    category: "action_failed",
    code: "web.action.no_effect",
    retryable: true,
    stage: "execution",
    expected: "the page answers the press",
    actual: SETTLED_TWICE_ACTUAL,
    effect: "unacted",
    certainNoEffect: true
  });
  assert.deepEqual(events, [...FIRST_PRESS, ...SECOND_PRESS], "exactly two presses in this command, never a third");
  assert.deepEqual(unchangedAsked, [SETTLE_MS, SETTLE_MS], "each press is made only after a certain-nothing verdict on the one before");
  assert.equal(extraPressesMade(command), 1, "the command's one extra press is spent");
});

test("a press made once more that the page answered only with its notice fails as the page reporting it failed; with no sign at all, as not observed", async (t) => {
  const notice = await click(t, BUTTON, undefined, CLICK, undefined, undefined, 1_000, { seen: ["change"], settledUnchanged: true, secondSeen: ["change"], secondSettledUnchanged: "announced" });
  assert.equal(notice.result.status, "failed");
  assert.equal(notice.result.failure?.code, "web.action.page_reported_failure");
  assert.equal(notice.result.failure?.certainNoEffect, true);
  assert.equal(notice.result.validation.status === "failed" ? notice.result.validation.actual : "", `${HIT}; ${PRESSED_AFTER_SETTLED}, and the page answered that press with nothing but a notice in one of its own status or alert regions`);
  assert.deepEqual(notice.events, [...FIRST_PRESS, ...SECOND_PRESS]);
  // No sign at all is not certain: the watch that saw nothing does not look outside the section. The builder reports it as not observed.
  const silent = await click(t, BUTTON, undefined, CLICK, undefined, undefined, 1_000, { seen: ["change"], settledUnchanged: true, secondSeen: [] });
  assert.equal(silent.result.status, "failed");
  assert.equal(silent.result.failure, undefined);
  assert.equal(silent.result.validation.status === "failed" ? silent.result.validation.actual : "", `${HIT}; ${PRESSED_AFTER_SETTLED}, and it ignored that press: no request, no change inside the control or its section, no navigation and no focus move`);
  assert.deepEqual(silent.events, [...FIRST_PRESS, ...SECOND_PRESS]);
  assert.deepEqual(silent.unchangedAsked, [SETTLE_MS], "a press with no sign at all has nothing to settle back");
});

test("a first press that came to nothing on a control swapped for a pressable copy is pressed once more on the copy, in the same command", async (t) => {
  const { result, ignored, unchangedAsked } = await click(t, BUTTON, undefined, CLICK, undefined, undefined, 1_000, { seen: ["change"], settledUnchanged: true, replaced: "copy" });
  assert.equal(result.status, "succeeded");
  assert.equal(result.failure, undefined);
  assert.equal(ignored.made, 2, "pressed twice: the second on the copy");
  assert.deepEqual(unchangedAsked, [SETTLE_MS, SETTLE_MS]);
});

// The same press inside the in-page recovery (`action-runtime/recovery/`), as `actions/execute.ts` runs it: a
// first press that came to nothing whose control a layer then covered is refused as covered, the recovery closes
// the layer and runs the click again with the same command, and that run's press is the one extra press.

/** What one recovering click did. */
type Recovering = { result: BrowserActionResult; cleared: RecoveryFault[]; presses: number; looked: number };

/** A click inside the recovery loop: each press answered with `answers[i]` and its settled look with `unchanged[i]`, the gate with `gate` in turn. */
async function recovering(t: TestContext, answers: PressSignal[][], unchanged: boolean[], gate: ActionabilityReport[]): Promise<Recovering> {
  installMouseEvent(t);
  const page = fakePage(BUTTON);
  let presses = 0;
  let looked = 0;
  const ignored: { make: ContentActionDependencies["watchIgnoredPress"]; record: IgnoredRecord } = {
    record: { made: 0, settledWith: [], stopped: 0 },
    make: () => {
      const index = presses;
      const seen = answers[index] ?? ["change"];
      presses += 1;
      return {
        settle: async (windowMs) => ({ seen: [...seen], afterMs: seen.length > 0 ? 4 : windowMs }),
        settleUnchanged: async () => {
          looked += 1;
          return unchanged[index] ?? false;
        },
        stop: () => undefined
      };
    }
  };
  let looks = 0;
  const deps = dependencies(page.element, fakeWatch(undefined, page.events).make, fakeNoticeWatch(undefined, page.events), fakeCheckWatch(undefined, page.events), ignored, true, "covered", () => gate[looks++] ?? PRESSABLE);
  const action: BrowserActionCommand = { ...CLICK };
  const cleared: RecoveryFault[] = [];
  const close = (fault: RecoveryFault): number => {
    cleared.push(fault);
    return 1;
  };
  const { result } = await runWithRecovery(action, 1_000, () => clickAction(action, deps, 1_000), async () => undefined, () => 1_000, close, () => false);
  return { result, cleared, presses, looked };
}

const COVERED = notPressable("covered");

test("a first press that came to nothing and a layer then covered: the layer is closed, and the press made after it is the command's only extra press and is not looked at again", async (t) => {
  const { result, cleared, presses, looked } = await recovering(t, [["change"], []], [true], [PRESSABLE, COVERED, PRESSABLE, PRESSABLE]);
  assert.deepEqual(cleared, ["obstructed_target"], "the layer was closed before the click ran again");
  assert.equal(presses, 2, "pressed once more after the layer was closed, never a third time");
  assert.equal(looked, 1, "the press made after the layer was closed is not looked at again");
  assert.equal(result.status, "failed");
  assert.equal(result.failure, undefined, "ignored outright too, it fails as not observed (the builder's code), not as certain");
});

test("a press made once more after a swallowed first press, whose control is then gone or disabled, was answered and passes", async (t) => {
  for (const againAs of ["disabled", "hidden"] as const) {
    const { result, presses } = await recovering(t, [["change"], ["change"]], [true, true], [PRESSABLE, PRESSABLE, notPressable(againAs)]);
    assert.equal(result.status, "succeeded", againAs);
    assert.equal(presses, 2, againAs);
  }
});
