// Putting the account onto the result, so a fault that was survived is a fault
// somebody can read.
//
// **Where it goes, and why not somewhere better.** The place this account
// belongs is a declared field of its own on the action result, copied at the
// domain boundary exactly as the extraction read's account is
// (`domain/src/actions/extraction/summary.ts`,
// `domain/src/client/gateway-mapping.ts`), and projected by Core onto the
// node's metadata the way `listWait`, `itemsSeen` and `emptyRecords` now are
// (t158). That is three files this task does not own and one repository it must
// not touch, and a field added here alone would be dropped by
// `webAutomationActionResultPayload`, which copies the result field by field --
// a fact computed and discarded, which is the very defect `account.ts` is
// written against. So the account travels today on the two texts that already
// reach Core on every result, and the report names the four-line wire diff that
// would make it countable.
//
// **The two texts.** A validation's `actual` is what an operator reads and what
// becomes a failure record's `actual` when the post-condition did not hold; a
// failure record's `actual` is what Core stores and what a repair is shown. Both
// are bounded, and both are appended to rather than replaced, because what the
// verb observed is the primary fact and what the loop absorbed is a note beside
// it. `click.ts` already writes its in-place effect into a validation's `actual`
// this way, so this is that file's idiom rather than a new channel.
//
// **The record is rebuilt through `webAutomationFailureRecord`, never spread.**
// The builder reads the category, the retryable flag and the stage from the code
// table, so a rebuilt record cannot contradict one of Core's consistency rules
// and be dropped whole -- which would lose the failure rather than annotate it.
// The code is carried over unchanged: absorbing faults does not change what
// finally went wrong.

import { isWebAutomationFailureCode, webAutomationFailureRecord } from "@fluxiq-web-extension/domain/client";
import type { BrowserActionResult } from "../../types";
import { truncateValidationText } from "../validation-outcome";
import { recoveryAccountSentence, type RecoveryAccount } from "./account";

/**
 * The result as it should be reported, given what reaching it absorbed:
 * unchanged for a clean execution, and annotated on both texts otherwise.
 *
 * The result is written in place rather than copied, for the reason
 * `actions/page-identity.ts` gives for doing the same: it was built one call
 * below and is shared with nothing, and rebuilding it would mean either a spread
 * -- which drops a renamed wire field silently -- or a second copy of the result
 * contract to keep in step with the first.
 */
export function recordRecovery(result: BrowserActionResult, account: RecoveryAccount): BrowserActionResult {
  const sentence = recoveryAccountSentence(account);
  if (sentence === undefined) return result;
  const validation = result.validation;
  if (validation.status !== "none") {
    validation.actual = truncateValidationText(`${validation.actual}; ${sentence}`);
  }
  const failure = result.failure;
  if (failure && isWebAutomationFailureCode(failure.code)) {
    result.failure = webAutomationFailureRecord(failure.code, {
      expected: failure.expected,
      actual: failure.actual === undefined ? sentence : `${failure.actual}; ${sentence}`,
      evidenceDigest: failure.evidenceDigest,
      // The wait a page named (`web.action.rate_limited`) is the producer's
      // fact, like the digest, and is carried over; the effect is the code's.
      retryAfterMs: failure.retryAfterMs
    });
  }
  return result;
}
