// What the execution absorbed, in counts and closed words.
//
// A defence nobody can see is a defence nobody can trust, and this repository
// has been bitten by that twice in one week: the list wait's reason was computed
// and thrown away, so a seventeen-hour-old regression survived ten live attempts
// and was found in the end by arithmetic on durations
// (`docs/working/language-driven-flow-loop-plan/reports/t143-why-the-read-returns-nothing.md`);
// and a resolved column's assumption was computed and dropped at the last hop
// (t155). A fault silently absorbed is the same defect wearing a friendlier
// face -- a run that now passes on the second attempt looks exactly like a run
// that passed on the first, so nothing can tell a page that got slower from a
// product that got better.
//
// **The shape follows the extraction read's account, deliberately.**
// `domain/src/actions/extraction/summary.ts` admits counts, flags and words from
// closed sets and nothing read off the page, which is what lets it travel for
// any element. Everything here is the loop's own arithmetic -- how many attempts,
// which fault words, how many milliseconds were spent waiting -- so there is
// nothing on it a page could have written and nothing that needs redacting.
//
// `absorbed` is bounded by construction: one word per absorbed fault, and
// `budget.ts` allows at most `RECOVERY_BACKOFF_MS.length` of them.

import type { RecoveryFault } from "./fault";

/**
 * The execution's account of what it survived.
 *
 * `attempts` is always at least 1, so the clean case is a legible row rather
 * than an absence. `outcome` separates the three states a reader wants to group
 * by: nothing went wrong, something went wrong and the execution got past it,
 * or something went wrong and the budget ran out first. The last is not a new
 * failure -- the result reported is the last attempt's own answer -- it is the
 * fact that the defence was tried and was not enough.
 */
export type RecoveryAccount = {
  /** Attempts made, the first included. */
  attempts: number;
  /** One word per fault absorbed, in the order they happened. */
  absorbed: readonly RecoveryFault[];
  /** Milliseconds spent deliberately waiting between attempts. */
  waitedMs: number;
  /**
   * How many layers standing over the page the loop pressed the way out of.
   *
   * A count, never what the dialog said. It is on the account rather than left
   * implicit in `absorbed` because the two are different facts: `blocking_dialog`
   * says the page put a dialog in the way, and this says the runtime pressed a
   * control on the page that no Flow authored. That second fact must be visible
   * in a debug on its own, since it is the one act the runtime takes without
   * being told to.
   */
  dismissed: number;
  /** Which of the three states the defence ended in. */
  outcome: RecoveryOutcome;
};

/** Nothing absorbed, absorbed and got past it, or absorbed and ran out of budget. */
export type RecoveryOutcome = "clean" | "recovered" | "exhausted";

/** The account of an execution that answered first time and absorbed nothing. */
export const CLEAN_RECOVERY_ACCOUNT: RecoveryAccount = Object.freeze({
  attempts: 1,
  absorbed: Object.freeze([]) as readonly RecoveryFault[],
  waitedMs: 0,
  dismissed: 0,
  outcome: "clean"
});

/**
 * The account in one sentence, or `undefined` for an execution that absorbed
 * nothing.
 *
 * Absent rather than empty for the clean case, because the two are different
 * facts and because appending "nothing went wrong" to every validation on the
 * page would bury the sentences that matter. The words are the account's own --
 * no page text, no selector -- and the sentence is short enough that a
 * validation already at its bound loses only its own tail to it.
 */
export function recoveryAccountSentence(account: RecoveryAccount): string | undefined {
  if (account.absorbed.length === 0) return undefined;
  const faults = account.absorbed.join(", ");
  const verdict = account.outcome === "recovered"
    ? `the execution recovered on attempt ${account.attempts}`
    : `the execution did not recover within its ${account.attempts} ${account.attempts === 1 ? "attempt" : "attempts"}`;
  return `${verdict} after absorbing ${faults}${dismissalClause(account.dismissed)}, waiting ${account.waitedMs} ms`;
}

/** What the loop pressed, in a count and a closed phrase, or nothing when it pressed nothing. */
function dismissalClause(dismissed: number): string {
  if (dismissed <= 0) return "";
  return `, closing ${dismissed} ${dismissed === 1 ? "dialog" : "dialogs"} the page had put in the way`;
}
