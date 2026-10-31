// T1 coverage of the robot-check watch (`robot-check-watch.ts`): which page
// changes after a press are a robot check the person must answer, which one
// cleared by itself, and that a press that puts no check up is released with
// the rate-limit window. The page is injected as a probe answering the page
// reading over time; what a real page reads as a check is
// `challenge-evidence.test.ts`'s.

import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import type { RobotCheckKind } from "../../challenge-evidence";
import { watchRobotCheck, type RobotCheckProbe } from "../robot-check-watch";

/** A pressed element that stays in the document unless told otherwise, with no window to listen on. */
function pressedElement(connected = true): Element & { isConnected: boolean } {
  return { isConnected: connected, ownerDocument: undefined } as unknown as Element & { isConnected: boolean };
}

/**
 * A page whose reading changes over time: `before` is what it read when the
 * watch was made, and `after(ms)` what it reads `ms` after the press.
 */
function page(before: RobotCheckKind | undefined, after: (sincePressMs: number) => RobotCheckKind | undefined): RobotCheckProbe {
  let pressedAt: number | undefined;
  return {
    read: () => {
      if (pressedAt === undefined) {
        pressedAt = Date.now();
        return before;
      }
      return after(Date.now() - pressedAt);
    }
  };
}

/** Advance the watch's clock and drain promise continuations without waiting on real time. */
function clock(t: TestContext): (milliseconds: number) => Promise<void> {
  t.mock.timers.enable({ apis: ["Date", "setTimeout", "setInterval"], now: 1_000 });
  return async (milliseconds) => {
    t.mock.timers.tick(milliseconds);
    await Promise.resolve();
  };
}

test("a press that puts no check up is released when the window closes", async (t) => {
  const advance = clock(t);
  let settled = false;
  let reads = 0;
  const found = watchRobotCheck(pressedElement(), { read: () => {
    reads++;
    return undefined;
  } }).settle(120, 15_000).then((result) => {
    settled = true;
    return result;
  });
  await advance(119);
  assert.equal(settled, false, "the watch must cover the whole window");
  await advance(1);
  assert.equal(settled, true, "release at the boundary, before the 150 ms poll");
  assert.equal(await found, undefined);
  const closedReads = reads;
  await advance(15_000);
  assert.equal(reads, closedReads, "the released watch must stop polling");
});

test("a press whose control leaves the document is released at once, as the rate-limit watch releases it", async (t) => {
  clock(t);
  const startedAt = Date.now();
  const found = await watchRobotCheck(pressedElement(false), page(undefined, () => undefined)).settle(2_000, 15_000);
  assert.equal(found, undefined);
  assert.equal(Date.now(), startedAt);
});

test("a check only a person can answer, put up by the press, ends the watch at once", async (t) => {
  clock(t);
  const found = await watchRobotCheck(pressedElement(), page(undefined, () => "person_only")).settle(500, 15_000);
  assert.ok(found);
  assert.equal(found.outcome, "person_only");
  assert.equal(found.afterMs, 0);
});

test("a check that says it is checking and then asks the person is the person's: company-website's quote form", async (t) => {
  const advance = clock(t);
  // "Checking you are human..." at once, then "Confirm you are human" 300 ms on.
  const pending = watchRobotCheck(pressedElement(), page(undefined, (ms) => (ms < 300 ? "self_clearing" : "person_only"))).settle(100, 15_000);
  await advance(150);
  await advance(150);
  const found = await pending;
  assert.ok(found);
  assert.equal(found.outcome, "person_only");
  assert.equal(found.waitedMs, 300);
});

test("a check that says it is checking and then goes away cleared by itself, and the watch followed it past the window", async (t) => {
  const advance = clock(t);
  const pending = watchRobotCheck(pressedElement(), page(undefined, (ms) => (ms < 400 ? "self_clearing" : undefined))).settle(100, 15_000);
  await advance(150);
  await advance(150);
  await advance(150);
  const found = await pending;
  assert.ok(found);
  assert.equal(found.outcome, "cleared");
  assert.equal(found.waitedMs, 450);
});

test("a check that says it is checking and never clears is not cleared once the wait runs out", async (t) => {
  const advance = clock(t);
  let settled = false;
  const pending = watchRobotCheck(pressedElement(), page(undefined, () => "self_clearing")).settle(100, 300).then((result) => {
    settled = true;
    return result;
  });
  await advance(299);
  assert.equal(settled, false, "a seen check must be followed for the allowed wait");
  await advance(1);
  const found = await pending;
  assert.ok(found);
  assert.equal(found.outcome, "not_cleared");
  assert.equal(found.waitedMs, 300);
});

test("a check already on the page before the press is not the press's answer", async (t) => {
  const advance = clock(t);
  const found = watchRobotCheck(pressedElement(), page("person_only", () => "person_only")).settle(100, 15_000);
  await advance(100);
  assert.equal(await found, undefined);
});

test("a self-clearing check already up that turns into one only a person can answer is the press's answer", async (t) => {
  clock(t);
  const found = await watchRobotCheck(pressedElement(), page("self_clearing", () => "person_only")).settle(100, 15_000);
  assert.equal(found?.outcome, "person_only");
});

test("stop is safe to call more than once, and after settle", async (t) => {
  clock(t);
  const watch = watchRobotCheck(pressedElement(), page(undefined, () => undefined));
  await watch.settle(0, 15_000);
  watch.stop();
  watch.stop();
});
