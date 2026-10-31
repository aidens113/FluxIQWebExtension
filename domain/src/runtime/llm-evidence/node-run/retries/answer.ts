import { readWebHostFailure } from "../../../host-failure";
import { webActionabilityFromPayload } from "../../../../actions/actionability";
// Which of a node's attempts answers for it once its retries are spent (t741 C1).
//
// Core's retries hand back the last attempt's answer. That is right whenever
// the attempts failed the same way, and wrong in one case live run
// `run-mvgo9wzn-fad4e050` (step 0116) measured: a press whose first attempt the
// site refused for now -- HTTP 429, the extension's RATE_LIMITED, which takes
// the tab back to the page the press was made on -- and whose later attempts
// then failed only because the control it pressed was no longer shown (it sat
// inside a menu the return had closed). The model was told
// `target_not_actionable`, Core's repeat guard read that as a failure that will
// not change, and the right move -- the same press once the site's wait is
// over -- was refused three times.
//
// The later attempts' failures were caused by the refusal, not by the control:
// the refusal is the answer. So when an attempt failed RATE_LIMITED and every
// attempt after it failed only because its target was not found, not shown or
// not usable, the latest refusal answers for the node, with its own record --
// the wait the site asked for and whether the tab was returned -- and the
// node's attempts stay the total. Any other run of attempts, all of them not
// shown included, keeps the last attempt's answer.

import { WEB_AUTOMATION_FAILURE_CODES } from "../../../failure";
import type { WebNodeDispatchResult } from "./dispatch";

/** The failures a later attempt may show and still owe to the refusal before it: the target was gone or unusable. */
const TARGET_GONE: ReadonlySet<string> = new Set([
  WEB_AUTOMATION_FAILURE_CODES.TARGET_NOT_FOUND,
  WEB_AUTOMATION_FAILURE_CODES.TARGET_NOT_SHOWN,
  WEB_AUTOMATION_FAILURE_CODES.TARGET_NOT_ACTIONABLE
]);

/**
 * The answer a node's attempts report, in the order they were made: the latest
 * RATE_LIMITED refusal when every attempt after it failed only because its
 * target was gone, otherwise the last attempt's own (`last`, what Core returned).
 */
export function webNodeRetriedAnswer(answers: readonly WebNodeDispatchResult[], last: WebNodeDispatchResult): WebNodeDispatchResult {
  if (answers[answers.length - 1] !== last || last.status === "succeeded") return last;
  for (let index = answers.length - 1; index >= 0; index -= 1) {
    const answer = answers[index]!;
    const original = readWebHostFailure(answer.failure);
    if (original !== undefined && (original.effect === "ambiguous" || (!original.retryable && !(original.code === WEB_AUTOMATION_FAILURE_CODES.TARGET_NOT_ACTIONABLE && original.category === "unexpected_state")))) return last;
    const code = failureCode(answer);
    if (code === WEB_AUTOMATION_FAILURE_CODES.RATE_LIMITED) return index === answers.length - 1 ? last : answer;
    if (code === undefined || !TARGET_GONE.has(code) || covered(answer)) return last;
  }
  return last;
}

/** The closed failure code an answer carries, when it is a failure with one. */
function failureCode(answer: WebNodeDispatchResult): string | undefined {
  if (answer.status === "succeeded" || answer.status === "timed_out") return undefined;
  const code = answer.failure?.code;
  return typeof code === "string" ? code : undefined;
}

/** A control covered by a layer is still there, so its failure is not owed to the refusal (`covered:`, read as `../../action-failure/refusal.ts` reads it). */
function covered(answer: WebNodeDispatchResult): boolean {
  const actionability = webActionabilityFromPayload(answer);
  if (actionability !== undefined) return !actionability.actionable && actionability.cause === "covered";
  const actual = answer.status === "succeeded" ? undefined : answer.failure?.actual;
  return typeof actual === "string" && actual.startsWith("covered:");
}
