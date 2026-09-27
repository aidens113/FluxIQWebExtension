// The loop: run the verb, and when the page faulted in a way waiting can fix,
// wait and run it again.
//
// **Why this is the seam.** Every verb in `actions/` resolves its target in the
// first millisecond the command arrives and acts on it at once. Nothing between
// the command and the page waits for anything unless the *model* authored a wait
// node, which is the defect the user named: the runtime was defensive only where
// a model remembered to make it so. Wrapping the dispatcher, rather than each
// verb, is what makes the defence unconditional -- a verb added tomorrow gets it
// with no line of its own, and a node the model wrote with the least parameters
// it could gets exactly what a carefully written one gets.
//
// **A retry is a re-resolution, which is the point.** The attempt is a closure
// over the dispatcher, so attempt two calls the verb afresh, and the verb calls
// `resolveTarget` afresh against the document as it now is. A target that had
// not been drawn yet is found; a target that moved is re-scored from scratch; an
// element reference that went stale cannot survive, because no reference is
// carried between attempts. There is no separate "re-acquire the handle" path
// for the same reason: this loop holds no handle.
//
// **What it does not do.** It does not lengthen a verb's own wait, or second-guess
// one. A verb that waited and timed out has spent the command's `timeoutMs`, and
// `budget.ts` then refuses the retry on the elapsed check -- so the extraction
// read's render window, measured and settled on 2026-09-25, is neither doubled
// nor re-litigated here.
//
// The pause is injected rather than taken from a global so a test can drive four
// attempts in no time at all and still assert what was waited.

import type { BrowserActionCommand, BrowserActionResult } from "../../types";
import { CLEAN_RECOVERY_ACCOUNT, type RecoveryAccount, type RecoveryOutcome } from "./account";
import { recoveryBackoffMs, recoveryBudgetRemainingMs } from "./budget";
import { recoverableFault, type RecoveryFault } from "./fault";

/** One execution's answer, and the account of what reaching it cost. */
export type RecoveredExecution = {
  result: BrowserActionResult;
  account: RecoveryAccount;
};

/** How the loop pauses between attempts. Replaced in tests; never called with a non-positive wait. */
export type RecoveryPause = (ms: number) => Promise<void>;

/**
 * Runs `attempt` until it answers with something retrying cannot improve, or
 * until the budget is spent, and reports the last answer with the account.
 *
 * The result reported is always an attempt's own result, never a synthesized
 * one: a defence that ran out of budget must hand back the failure the page
 * actually produced, so the diagnosis a repair reads is the page's and not this
 * loop's.
 */
export async function runWithRecovery(
  action: BrowserActionCommand,
  startedAt: number,
  attempt: () => Promise<BrowserActionResult>,
  pause: RecoveryPause = sleep,
  now: () => number = Date.now
): Promise<RecoveredExecution> {
  const absorbed: RecoveryFault[] = [];
  let waitedMs = 0;
  let attempts = 0;
  for (;;) {
    attempts += 1;
    const result = await attempt();
    const fault = recoverableFault(result, action);
    if (fault === undefined) return { result, account: account(attempts, absorbed, waitedMs) };
    const backoffMs = recoveryBackoffMs(fault, absorbed.length, action, startedAt, now());
    if (backoffMs === undefined) {
      // The fault was one this loop absorbs and there was no budget left to
      // absorb it with. It is recorded as absorbed all the same: what a reader
      // needs to know is that the defence was reached and was not enough, which
      // an account showing no fault at all would hide.
      absorbed.push(fault);
      return { result, account: account(attempts, absorbed, waitedMs) };
    }
    absorbed.push(fault);
    waitedMs += backoffMs;
    await pause(backoffMs);
    // A clipped pause can land exactly on the command deadline, and a real
    // scheduler can resume later than requested. In either case the last page
    // result is the honest answer; dispatching another verb would start work
    // after the timeout Core gave this command.
    if (recoveryBudgetRemainingMs(action, startedAt, now()) <= 0) {
      return { result, account: account(attempts, absorbed, waitedMs) };
    }
  }
}

function account(attempts: number, absorbed: readonly RecoveryFault[], waitedMs: number): RecoveryAccount {
  if (absorbed.length === 0) return attempts === 1 ? CLEAN_RECOVERY_ACCOUNT : { attempts, absorbed: [], waitedMs, outcome: "clean" };
  return { attempts, absorbed: [...absorbed], waitedMs, outcome: outcomeOf(attempts, absorbed.length) };
}

/**
 * Recovered when the last attempt was not itself a fault this loop absorbed:
 * one absorbed fault per attempt that faulted, so a run of N attempts that
 * absorbed N faults never recovered, and one that absorbed N-1 did.
 */
function outcomeOf(attempts: number, absorbed: number): RecoveryOutcome {
  return absorbed < attempts ? "recovered" : "exhausted";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
