// T1 coverage of the robot-check watch (`robot-check-watch.ts`): which page
// changes after a press are a robot check the person must answer, which one
// cleared by itself, and that a press that puts no check up is released with
// the rate-limit window. The page is injected as a probe answering the page
// reading over time; what a real page reads as a check is
// `challenge-evidence.test.ts`'s.

import assert from "node:assert/strict";
import { test } from "node:test";
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

test("a press that puts no check up is released when the window closes", async () => {
  const startedAt = Date.now();
  const found = await watchRobotCheck(pressedElement(), page(undefined, () => undefined)).settle(120, 15_000);
  const took = Date.now() - startedAt;
  assert.equal(found, undefined);
  assert.ok(took >= 100 && took < 400, `released after ${took} ms`);
});

test("a press whose control leaves the document is released at once, as the rate-limit watch releases it", async () => {
  const startedAt = Date.now();
  const found = await watchRobotCheck(pressedElement(false), page(undefined, () => undefined)).settle(2_000, 15_000);
  assert.equal(found, undefined);
  assert.ok(Date.now() - startedAt < 200);
});

test("a check only a person can answer, put up by the press, ends the watch at once", async () => {
  const found = await watchRobotCheck(pressedElement(), page(undefined, () => "person_only")).settle(500, 15_000);
  assert.equal(found?.outcome, "person_only");
  assert.ok((found?.afterMs ?? 99) < 50);
});

test("a check that says it is checking and then asks the person is the person's: company-website's quote form", async () => {
  // "Checking you are human..." at once, then "Confirm you are human" 300 ms on.
  const found = await watchRobotCheck(pressedElement(), page(undefined, (ms) => (ms < 300 ? "self_clearing" : "person_only"))).settle(100, 15_000);
  assert.equal(found?.outcome, "person_only");
  assert.ok((found?.waitedMs ?? 0) >= 250, `followed for ${found?.waitedMs} ms`);
});

test("a check that says it is checking and then goes away cleared by itself, and the watch followed it past the window", async () => {
  const found = await watchRobotCheck(pressedElement(), page(undefined, (ms) => (ms < 400 ? "self_clearing" : undefined))).settle(100, 15_000);
  assert.equal(found?.outcome, "cleared");
  assert.ok((found?.waitedMs ?? 0) >= 350);
});

test("a check that says it is checking and never clears is not cleared once the wait runs out", async () => {
  const found = await watchRobotCheck(pressedElement(), page(undefined, () => "self_clearing")).settle(100, 300);
  assert.equal(found?.outcome, "not_cleared");
  assert.ok((found?.waitedMs ?? 0) >= 300);
});

test("a check already on the page before the press is not the press's answer", async () => {
  const found = await watchRobotCheck(pressedElement(), page("person_only", () => "person_only")).settle(100, 15_000);
  assert.equal(found, undefined);
});

test("a self-clearing check already up that turns into one only a person can answer is the press's answer", async () => {
  const found = await watchRobotCheck(pressedElement(), page("self_clearing", () => "person_only")).settle(100, 15_000);
  assert.equal(found?.outcome, "person_only");
});

test("stop is safe to call more than once, and after settle", async () => {
  const watch = watchRobotCheck(pressedElement(), page(undefined, () => undefined));
  await watch.settle(0, 15_000);
  watch.stop();
  watch.stop();
});
