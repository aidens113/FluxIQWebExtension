// The bound, asserted as numbers. A defence that turns a fast failure into a
// long hang makes live runs worse, not better, so the worst case is a test
// rather than a claim in a comment.

import assert from "node:assert/strict";
import test from "node:test";
import { RECOVERY_BLIP_BACKOFF_MS, RECOVERY_BUDGET_MS, RECOVERY_TARGET_BACKOFF_MS, recoveryBackoffLadder, recoveryBackoffMs } from "../budget";
import type { BrowserActionCommand } from "../../../types";

function command(timeoutMs?: number): BrowserActionCommand {
  return { commandId: "c1", actionType: "web.dom.click", ...(timeoutMs === undefined ? {} : { timeoutMs }) } as unknown as BrowserActionCommand;
}

const sum = (ladder: readonly number[]): number => ladder.reduce((total, ms) => total + ms, 0);

test("waiting for a page to draw a target is the long ladder, and everything else is the short one", () => {
  assert.deepEqual([...recoveryBackoffLadder("target_absent")], [250, 500, 1_000, 2_000]);
  for (const fault of ["output_not_observed", "page_changed", "timeout", "action_failed"] as const) {
    assert.deepEqual([...recoveryBackoffLadder(fault)], [250, 500], `${fault} is waited on the page ladder`);
  }
});

test("the deliberate waiting a command can be charged is 3750 ms at most, and 750 ms for a blip", () => {
  assert.equal(sum(RECOVERY_TARGET_BACKOFF_MS), 3_750);
  assert.equal(sum(RECOVERY_BLIP_BACKOFF_MS), 750);
  assert.ok(sum(RECOVERY_TARGET_BACKOFF_MS) < RECOVERY_BUDGET_MS, "the ladder must fit inside the budget or its last rung is always clipped");
});

test("a retry past the end of the ladder is refused", () => {
  assert.equal(recoveryBackoffMs("target_absent", RECOVERY_TARGET_BACKOFF_MS.length, command(), 0, 0), undefined);
  assert.equal(recoveryBackoffMs("action_failed", RECOVERY_BLIP_BACKOFF_MS.length, command(), 0, 0), undefined);
});

test("each retry is offered its own rung while the budget holds", () => {
  assert.deepEqual(
    RECOVERY_TARGET_BACKOFF_MS.map((_, absorbed) => recoveryBackoffMs("target_absent", absorbed, command(), 0, 0)),
    [250, 500, 1_000, 2_000]
  );
});

test("the budget is measured from the command's start, so four attempts cost one budget and not four", () => {
  assert.equal(recoveryBackoffMs("target_absent", 0, command(), 0, RECOVERY_BUDGET_MS - 1), 1);
  assert.equal(recoveryBackoffMs("target_absent", 0, command(), 0, RECOVERY_BUDGET_MS), undefined);
  assert.equal(recoveryBackoffMs("target_absent", 0, command(), 0, RECOVERY_BUDGET_MS + 10_000), undefined);
});

test("a command that named its own timeout is never exceeded, which is what stops a verb's own wait being doubled", () => {
  // The extraction read and the two waits spend `timeoutMs` themselves, so by
  // the time they fail there is nothing left and the first retry is refused.
  assert.equal(recoveryBackoffMs("timeout", 0, command(2_000), 0, 2_000), undefined);
  assert.equal(recoveryBackoffMs("timeout", 0, command(2_000), 0, 2_400), undefined);
  // A verb that failed fast inside a short timeout still gets one attempt rather
  // than none, clipped to what is left: too much rather than nothing.
  assert.equal(recoveryBackoffMs("target_absent", 0, command(300), 0, 10), 250);
  assert.equal(recoveryBackoffMs("target_absent", 0, command(200), 0, 10), 190);
});

test("an unreadable timeout is treated as naming none, never as leaving no budget", () => {
  for (const timeoutMs of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(recoveryBackoffMs("target_absent", 0, command(timeoutMs), 0, 0), 250, `timeoutMs ${String(timeoutMs)} switched the defence off`);
  }
});
