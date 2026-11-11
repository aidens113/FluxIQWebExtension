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
// **A target the page has not shown yet is waited on while the page works (t903).** A
// target refused as not shown, with nothing scrolled, was waited on the ladder meant for a
// dismissed dialog to finish leaving -- about 1.35 s -- whatever the page was doing. A replay
// that reached company-website's "Show more people" 0.7 s after the page loaded gave up while
// the page was still loading its people behind skeleton cards, and the button showed 4.4 s in
// (E1, `replay-first-press-failure.md`). Now that wait follows the page's own evidence that it
// is working (`../reveal/page-work.ts`): the loop looks again while the page shows work, tries
// as soon as the target shows or the work stops, and stops when a look finds the page showing
// no work and the target still absent -- waiting then cannot bring it. Its only other bound is
// the command's own budget (`budget.ts`, `pageWorkBudgetRemainingMs`), never a fixed ladder.
//
// The pause is injected rather than taken from a global so a test can drive four
// attempts in no time at all and still assert what was waited.

import { WEB_AUTOMATION_FAILURE_CODES } from "@fluxiq-web-extension/domain/client";
import type { BrowserActionCommand, BrowserActionResult } from "../../types";
import { clearableLayerOverPage, clearInterference } from "../interference";
import { CLEAN_RECOVERY_ACCOUNT, type RecoveryAccount, type RecoveryOutcome } from "./account";
import { pageWorkBudgetRemainingMs, recoveryBackoffMs, recoveryBudgetRemainingMs } from "./budget";
import { faultMayHideBehindLayer, faultNeedsInterference, recoverableFault, type RecoveryFault } from "./fault";
import { refusedControl, refusedControlChanging, type RefusedControlState } from "./refused-control";
import { PAGE_WORK_LOOK_MS, revealUnshownTarget, watchUnshownTargetWork, type PageWork } from "../reveal";

/** One execution's answer, and the account of what reaching it cost. */
export type RecoveredExecution = {
  result: BrowserActionResult;
  account: RecoveryAccount;
};

/** How the loop pauses between attempts. Replaced in tests; never called with a non-positive wait. */
export type RecoveryPause = (ms: number) => Promise<void>;

/**
 * What the loop does to the page between attempts, for a fault waiting alone
 * cannot fix. Answers how many layers it cleared.
 *
 * Injected so this file stays free of the DOM and runs whole under `node:test`,
 * and defaulted rather than demanded so the defence is on for the one caller
 * without that caller having to remember it -- which is the defect this whole
 * directory was written against.
 */
export type RecoveryIntervention = (fault: RecoveryFault) => number;

/**
 * Whether a wall the intervention could clear stands over the page now. Asked
 * only for a missing target (`faultMayHideBehindLayer`), which is usually late
 * rather than walled off, so the loop presses for it only on a yes -- and the
 * intervention for that fault presses walls alone (t656). Injected and
 * defaulted for the reason `RecoveryIntervention` is.
 */
export type RecoveryLayerProbe = () => boolean;

/**
 * The scroll toward a target the attempt refused as not shown, made between
 * attempts as a person would make it (`../reveal/`). Answers whether the page
 * moved. Injected and defaulted for the reason `RecoveryIntervention` is.
 */
export type RecoveryReveal = (result: BrowserActionResult) => boolean;

/**
 * The watch over the page's work toward a target the attempt refused as not shown
 * (`../reveal/page-work.ts`); `undefined` for any other refusal. Injected and defaulted for the
 * reason `RecoveryIntervention` is.
 */
export type RecoveryPageWork = (result: BrowserActionResult) => PageWork | undefined;

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
  now: () => number = Date.now,
  intervene: RecoveryIntervention = (fault) => clearInterference(undefined, faultMayHideBehindLayer(fault) ? "walls" : "any"),
  layerOverPage: RecoveryLayerProbe = () => clearableLayerOverPage(),
  reveal: RecoveryReveal = revealUnshownTarget,
  pageWork: RecoveryPageWork = watchUnshownTargetWork
): Promise<RecoveredExecution> {
  const absorbed: RecoveryFault[] = [];
  let waitedMs = 0;
  let attempts = 0;
  let dismissed = 0;
  let revealed = 0;
  // The disabled control the previous attempt was refused at, while the
  // attempts in a row keep being refused that way; `NOT_SEEN` otherwise.
  let disabledBefore: RefusedControlState | undefined | typeof NOT_SEEN = NOT_SEEN;
  // Whether the fault absorbed last was that first look and nothing more.
  let looked = false;
  for (;;) {
    attempts += 1;
    const result = await attempt();
    const fault = recoverableFault(result, action);
    if (fault === undefined) return { result, account: account(attempts, absorbed, waitedMs, dismissed, revealed, result) };
    if (fault === "disabled_target") {
      // A control the gate refused as disabled is waited at only while it shows
      // it is changing (`refused-control.ts`). The first such refusal is given
      // one look, a tick long (`budget.ts`); a control that looked the same at
      // that look, and does not say it is busy, is simply disabled, and its
      // refusal is the answer. That look absorbed nothing -- it found the
      // refusal was not transient -- so it leaves the account, and the page's
      // refusal is reported as the verb wrote it. A control that was changing
      // and then stopped was waited at for real, so this last refusal joins the
      // account as the budget's end does below: the defence was reached and was
      // not enough, and the outcome says `exhausted`, never `recovered`.
      const control = refusedControl(result);
      if (disabledBefore !== NOT_SEEN && !refusedControlChanging(disabledBefore, control)) {
        if (looked) absorbed.pop();
        else absorbed.push(fault);
        return { result, account: account(attempts, absorbed, waitedMs, dismissed, revealed, result) };
      }
      looked = disabledBefore === NOT_SEEN;
      disabledBefore = control;
    } else {
      disabledBefore = NOT_SEEN;
      looked = false;
    }
    // A target not shown yet is waited on while the page works toward it (header); every other
    // fault keeps its ladder.
    const work = fault === "obstructed_target" ? pageWork(result) : undefined;
    const allowedMs = work !== undefined ? positive(pageWorkBudgetRemainingMs(action, startedAt, now())) : recoveryBackoffMs(fault, absorbed.length, action, startedAt, now());
    if (allowedMs === undefined) {
      // The fault was one this loop absorbs and there was no budget left to
      // absorb it with. It is recorded as absorbed all the same: what a reader
      // needs to know is that the defence was reached and was not enough, which
      // an account showing no fault at all would hide.
      absorbed.push(fault);
      return { result, account: account(attempts, absorbed, waitedMs, dismissed, revealed, result) };
    }
    absorbed.push(fault);
    // Clear first, then wait, then run the verb again. A dialog does not leave
    // because it was waited at, so a loop that only paused would spend its whole
    // ladder and report the refusal it started with; and the pause after the
    // press is what gives the layer time to finish leaving before the target is
    // hit-tested again.
    //
    // A missing target is cleared for too, but only when a clearable wall is
    // there, and then only walls are pressed: a page that draws the target once
    // its consent wall is answered never draws it while the loop merely waits
    // (`fault.ts`), and no target waits behind a popover -- least of all one an
    // earlier step of the run opened, which no clearing presses (t656,
    // `interference/clearable-layers.ts`).
    if (faultNeedsInterference(fault) || (faultMayHideBehindLayer(fault) && layerOverPage())) dismissed += intervene(fault);
    // A target refused as not shown is scrolled toward before the next attempt
    // -- the end of where it would be drawn, so a lazy list's sentinel or a
    // scroll listener fires -- after any layer was cleared, so the scroll is
    // made on the page as the next attempt will meet it. Every attempt may
    // scroll again: a list that loads a batch per scroll needs several. A
    // scroll that moved the page waits on the reveal ladder, which has as many
    // rungs as the one it replaces (`budget.ts`), so the bound on attempts is
    // unchanged; one that moved nothing woke nothing, and the wait is as before.
    const scrolled = fault === "obstructed_target" && reveal(result);
    if (scrolled) revealed += 1;
    const revealMs = scrolled ? recoveryBackoffMs(fault, absorbed.length - 1, action, startedAt, now(), true) : undefined;
    if (work !== undefined && revealMs === undefined) {
      const waited = await waitOnPageWork(work, pause, () => pageWorkBudgetRemainingMs(action, startedAt, now()));
      waitedMs += waited.ms;
      // The page showed no work and the target is still absent: waiting cannot bring it. The
      // defence looked and was not enough, and its account follows the reason, as it always has
      // for a hidden target (`record.ts`).
      if (!waited.worked && !waited.shown) {
        return { result, account: account(attempts, absorbed, waitedMs, dismissed, revealed, result) };
      }
      if (pageWorkBudgetRemainingMs(action, startedAt, now()) <= 0) {
        return { result, account: account(attempts, absorbed, waitedMs, dismissed, revealed, result) };
      }
      continue;
    }
    const backoffMs = revealMs ?? allowedMs;
    waitedMs += backoffMs;
    await pause(backoffMs);
    // A clipped pause can land exactly on the command deadline, and a real
    // scheduler can resume later than requested. In either case the last page
    // result is the honest answer; dispatching another verb would start work
    // after the timeout Core gave this command.
    if ((work !== undefined ? pageWorkBudgetRemainingMs(action, startedAt, now()) : recoveryBudgetRemainingMs(action, startedAt, now())) <= 0) {
      return { result, account: account(attempts, absorbed, waitedMs, dismissed, revealed, result) };
    }
  }
}

/** No disabled refusal at the previous attempt, so the next one is a first and is given its look. */
const NOT_SEEN = Symbol("no disabled refusal at the previous attempt");

function account(attempts: number, absorbed: readonly RecoveryFault[], waitedMs: number, dismissed: number, revealed: number, last: BrowserActionResult): RecoveryAccount {
  if (absorbed.length === 0) return attempts === 1 ? CLEAN_RECOVERY_ACCOUNT : { attempts, absorbed: [], waitedMs, dismissed, outcome: "clean" };
  const found: RecoveryAccount = { attempts, absorbed: [...absorbed], waitedMs, dismissed, outcome: outcomeOf(attempts, absorbed.length) };
  // A different refusal can mean the target disappeared, not that scrolling revealed it.
  if (revealed > 0) found.reveal = { scrolls: revealed, shown: last.status === "succeeded" };
  return found;
}

/**
 * Recovered when the last attempt was not itself a fault this loop absorbed:
 * one absorbed fault per attempt that faulted, so a run of N attempts that
 * absorbed N faults never recovered, and one that absorbed N-1 did.
 */
function outcomeOf(attempts: number, absorbed: number): RecoveryOutcome {
  return absorbed < attempts ? "recovered" : "exhausted";
}

/**
 * Waits while the page shows it is working toward the target (header): a look every
 * `PAGE_WORK_LOOK_MS`, ending when the target shows, when a look finds no work, or when the
 * command's budget is spent. Says how long it waited, whether the page showed work at any look,
 * and whether the target showed.
 */
async function waitOnPageWork(work: PageWork, pause: RecoveryPause, remainingMs: () => number): Promise<{ ms: number; worked: boolean; shown: boolean }> {
  let ms = 0;
  let worked = false;
  for (;;) {
    const step = Math.min(PAGE_WORK_LOOK_MS, remainingMs());
    if (step <= 0) return { ms, worked, shown: false };
    await pause(step);
    ms += step;
    if (work.shown()) return { ms, worked, shown: true };
    if (!work.working()) return { ms, worked, shown: false };
    worked = true;
  }
}

/** A positive time, or `undefined` for none left. */
function positive(ms: number): number | undefined {
  return ms > 0 ? ms : undefined;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
