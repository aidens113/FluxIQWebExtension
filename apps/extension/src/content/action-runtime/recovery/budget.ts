// What a defence is allowed to cost, in wall clock, and who pays it.
//
// A defence with no bound is a worse product than no defence. A page fault that
// used to fail in ten milliseconds and now hangs for two minutes turns a live
// run's whole budget into waiting, and the run reports a timeout instead of the
// diagnosis it would have had. So the cost is stated as a number here, capped
// here, and measured from the moment the command started rather than from the
// moment a retry was decided -- because otherwise each attempt starts the clock
// again and four attempts cost four budgets.
//
// **Two ladders, because the two fault classes are not waiting for the same
// thing.** A target that is not there yet is waiting for the *page*, and the
// page's own timings are what set the number: the list reads that failed on
// 2026-09-25 gave up at 2.0 to 2.6 s against content that arrived at 4.6 s, so a
// defence that stops before the evidence says the page arrives is not a defence.
// That class gets 250, 500, 1000 and 2000 ms -- 3.75 s, geometric, so a page that
// draws late is caught without four attempts' worth of latency being spent on one
// that never will.
//
// Every other transient fault is a *blip*: a navigation race, a detached node, a
// browser API that threw once. Those either clear immediately or are not going to
// clear, and 3.75 s spent on a frame that has already gone is 3.75 s a live run
// does not get back. That class gets 250 and 500 ms and then answers honestly.
//
// **The worst case, stated.** Waiting is bounded at 3.75 s for a target and
// 0.75 s for a blip, and a retry is started only while the elapsed time is still
// inside `RECOVERY_BUDGET_MS`, so the last attempt may begin at 4.99 s and run
// for as long as the verb takes. The bound is therefore `RECOVERY_BUDGET_MS` plus
// one attempt of the verb -- about five seconds of added wall clock in the worst
// case, a second in the blip case, and zero for a verb that already spent the
// command's time.
//
// **A command that names its own timeout is never exceeded.** `timeoutMs` is
// what Core passed down from the node, and a verb that already used it has no
// budget left: the elapsed check then refuses the first retry outright. That is
// what makes this compose with the verbs that wait internally -- the two waits,
// and the list read's own render window -- instead of doubling them. It is also
// why nothing here needs to know which verbs those are.

import type { BrowserActionCommand } from "../../types";
import type { RecoveryFault } from "./fault";

/** The pauses between attempts while waiting for a target the page has not drawn. */
export const RECOVERY_TARGET_BACKOFF_MS: readonly number[] = Object.freeze([250, 500, 1_000, 2_000]);

/** The pauses between attempts after a transient blip, which either clears at once or will not clear. */
export const RECOVERY_BLIP_BACKOFF_MS: readonly number[] = Object.freeze([250, 500]);

/** The whole defence's wall-clock budget, measured from the command's start. */
export const RECOVERY_BUDGET_MS = 5_000;

/** The ladder a fault is waited on: the page's for a target, the short one for everything else. */
export function recoveryBackoffLadder(fault: RecoveryFault): readonly number[] {
  return fault === "target_absent" ? RECOVERY_TARGET_BACKOFF_MS : RECOVERY_BLIP_BACKOFF_MS;
}

/**
 * How long to wait before the next attempt, or `undefined` when there must not
 * be one.
 *
 * `absorbed` is how many faults have been absorbed so far, so it indexes the
 * ladder: the first retry waits 250 ms, and a retry past the ladder's end is
 * refused. Mixed faults index one ladder by the other's count, which can only
 * ever shorten the defence -- the safe direction, and the one that keeps this a
 * single monotone counter rather than a ledger per fault word.
 *
 * A wait is shortened to whatever is left of the budget rather than refused.
 * The loop re-checks this budget after the pause: reaching the deadline, or a
 * scheduler overshoot, returns the last page result without dispatching a new
 * action after its timeout.
 */
export function recoveryBackoffMs(
  fault: RecoveryFault,
  absorbed: number,
  action: BrowserActionCommand,
  startedAt: number,
  now: number
): number | undefined {
  const backoff = recoveryBackoffLadder(fault)[absorbed];
  if (backoff === undefined) return undefined;
  const left = recoveryBudgetRemainingMs(action, startedAt, now);
  if (left <= 0) return undefined;
  return Math.min(backoff, left);
}

/** Time still available before either the defence or command deadline closes. */
export function recoveryBudgetRemainingMs(action: BrowserActionCommand, startedAt: number, now: number): number {
  return Math.min(RECOVERY_BUDGET_MS, commandBudgetMs(action)) - (now - startedAt);
}

/**
 * The command's own budget: the node's timeout when it named one, and unbounded
 * when it did not, in which case `RECOVERY_BUDGET_MS` is the only cap.
 *
 * A non-positive or unreadable value is treated as "named none" rather than as
 * "no budget": a malformed timeout is an authoring slip, and refusing every
 * defence because of one is the shape of failure this whole file exists to stop.
 */
function commandBudgetMs(action: BrowserActionCommand): number {
  const timeoutMs = action.timeoutMs;
  if (typeof timeoutMs !== "number" || !Number.isFinite(timeoutMs) || timeoutMs <= 0) return Number.POSITIVE_INFINITY;
  return timeoutMs;
}
