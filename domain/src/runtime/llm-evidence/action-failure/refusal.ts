// What a page action that did not succeed tells the model: one closed refusal
// code, one closed reason for it, and the counts a failed read already
// published about itself.
//
// The client reports a failed action with a record from the domain's closed
// failure set (`runtime/failure/codes.ts`) and a sentence about it. The code is
// safe to act on; the sentence is not safe to pass on, because it names what is
// on the page -- the element that covered the target, the text it carried. So
// this reads the code, and from the sentence only its leading reason word,
// which the client writes from a closed set of its own (`covered`, `hidden`,
// `disabled`), to tell an overlay from a disabled control.
//
// **The table used to name eight codes of nineteen and send every other one as
// `action_failed`.** That word is documented as "the action failed for a reason
// none of these names", and it was being applied to failures this domain has
// exact names for: a read whose post-condition did not hold, an assertion that
// did not, a page the browser will not script at all, a channel that dropped
// before the verb was reached, a node the client does not implement, a
// parameter it could not read. Each implies a different next move and all six
// arrived as one word. `run-mulryg6h-ff241a12` is what that cost: see
// `./read-shortfall.ts`.
//
// **The code and the reason are decided together, and returned together**, so a
// call site cannot take one and forget the other. That is what `capture.ts` did
// -- it read the code and passed `detail: undefined` beside it -- and a
// signature that hands back only a code is what made forgetting possible.

import { WEB_AUTOMATION_FAILURE_CODES } from "../../failure";
import { rejectionDetail, type WebLlmToolRejectionCode, type WebLlmToolRejectionDetail, type WebLlmToolRejectionReason } from "../tool-rejection";
import { webActionReadShortfall, type WebActionReadShortfall } from "./read-shortfall";
import type { WebFailedActionResult } from "./result";

/** The refusal a failed action is reported to the model as: its code, and what it can say beyond it. */
export type WebActionRefusal = {
  code: WebLlmToolRejectionCode;
  /** Absent only where the code is the whole of what the model could act on. */
  detail: WebLlmToolRejectionDetail | undefined;
};

// A dialog anyone may close and a challenge only a person may answer are two
// codes on the client's side, and they stay two here: the first invites the
// model to deal with the dialog, and the second tells it not to try.
const BY_FAILURE_CODE: Readonly<Record<string, WebLlmToolRejectionCode>> = Object.freeze({
  [WEB_AUTOMATION_FAILURE_CODES.BLOCKED_BY_DIALOG]: "blocked_by_dialog",
  [WEB_AUTOMATION_FAILURE_CODES.USER_INTERVENTION_REQUIRED]: "needs_person",
  [WEB_AUTOMATION_FAILURE_CODES.AUTH_REQUIRED]: "needs_person",
  [WEB_AUTOMATION_FAILURE_CODES.TARGET_NOT_FOUND]: "target_not_found",
  [WEB_AUTOMATION_FAILURE_CODES.TARGET_AMBIGUOUS]: "target_not_found",
  [WEB_AUTOMATION_FAILURE_CODES.PAGE_CHANGED]: "page_changed",
  [WEB_AUTOMATION_FAILURE_CODES.NAVIGATION_UNEXPECTED]: "page_changed",
  [WEB_AUTOMATION_FAILURE_CODES.TIMEOUT]: "action_timed_out",
  // The verb ran and what it exists to produce did not appear. One code for the
  // two post-conditions, because the move is the same -- the step is the right
  // shape and its arguments are not -- and the reason below tells them apart.
  [WEB_AUTOMATION_FAILURE_CODES.OUTPUT_NOT_OBSERVED]: "output_not_observed",
  [WEB_AUTOMATION_FAILURE_CODES.STATE_MISMATCH]: "output_not_observed",
  // The browser refused before the verb was reached. Its own code, because it
  // is the one failure nothing the model writes can clear.
  [WEB_AUTOMATION_FAILURE_CODES.BROWSER_PERMISSION_DENIED]: "not_permitted_here",
  // The verb was never reached and the next attempt may reach it. The code
  // stays `action_failed`, which is honest -- nothing about the call was wrong
  // -- and the reason says where to look.
  [WEB_AUTOMATION_FAILURE_CODES.TRANSPORT_TRANSIENT]: "action_failed",
  // The call named a node this client will not run, or wrote a parameter it
  // could not read. Both are the model's own input, which is what
  // `invalid_input` means everywhere else in this domain.
  [WEB_AUTOMATION_FAILURE_CODES.UNSUPPORTED_TYPE]: "invalid_input",
  [WEB_AUTOMATION_FAILURE_CODES.NOT_IMPLEMENTED]: "invalid_input",
  [WEB_AUTOMATION_FAILURE_CODES.INVALID_PARAMETER]: "invalid_input"
});

/**
 * The reason a code implies on its own, for the codes whose whole meaning is in
 * the code the client sent.
 *
 * Two of the nineteen are deliberately absent and stay bare `action_failed`,
 * because there is nothing truthful to add to them:
 *
 * - `web.action.failed` is by definition "the action failed for a reason no
 *   other code names". A reason invented for it would be this domain claiming
 *   to know something the client said it does not.
 * - `web.action.unknown` is "nothing said why the action failed". Same answer.
 *
 * `web.validation.output_not_observed` is absent for a different reason: the
 * reason it carries is read off the read's own account rather than off the
 * code, and where there is no account -- a click whose post-condition did not
 * hold -- the code already says the whole of it.
 */
const BY_FAILURE_REASON: Readonly<Record<string, WebLlmToolRejectionReason>> = Object.freeze({
  [WEB_AUTOMATION_FAILURE_CODES.STATE_MISMATCH]: "state_not_as_asserted",
  [WEB_AUTOMATION_FAILURE_CODES.BROWSER_PERMISSION_DENIED]: "page_not_scriptable",
  [WEB_AUTOMATION_FAILURE_CODES.TRANSPORT_TRANSIENT]: "channel_to_page_failed",
  [WEB_AUTOMATION_FAILURE_CODES.UNSUPPORTED_TYPE]: "node_not_runnable_here",
  [WEB_AUTOMATION_FAILURE_CODES.NOT_IMPLEMENTED]: "node_not_runnable_here",
  [WEB_AUTOMATION_FAILURE_CODES.INVALID_PARAMETER]: "parameter_not_readable"
});

/**
 * The refusal a failed action is reported to the model as.
 *
 * The read's own account wins over the code's reason where there is one, and
 * it is read whatever the code was: an extraction that ran out of time still
 * counted what it had read, and telling the model only `action_timed_out` would
 * throw that away exactly as the bare `action_failed` did.
 */
export function webActionFailureRefusal(result: WebFailedActionResult): WebActionRefusal {
  const code = webActionFailureRejectionCode(result);
  const shortfall = webActionReadShortfall(result.payload);
  if (shortfall !== undefined) return { code, detail: readDetail(shortfall) };
  const reason = typeof result.failure?.code === "string" ? BY_FAILURE_REASON[result.failure.code] : undefined;
  return {
    code,
    detail: reason === undefined
      ? undefined
      : rejectionDetail({ reason, target: undefined, instead: undefined, missing: undefined, requestId: undefined })
  };
}

/** The refusal code alone, for a caller that reports the failure under a code of its own. */
export function webActionFailureRejectionCode(result: WebFailedActionResult): WebLlmToolRejectionCode {
  if (result.status === "timed_out") return "action_timed_out";
  const code = result.failure?.code;
  if (code === WEB_AUTOMATION_FAILURE_CODES.ACTION_REJECTED) {
    return typeof result.failure?.actual === "string" && result.failure.actual.startsWith("covered:") ? "target_covered" : "target_not_actionable";
  }
  return typeof code === "string" && Object.prototype.hasOwnProperty.call(BY_FAILURE_CODE, code) ? BY_FAILURE_CODE[code]! : "action_failed";
}

/** The read's account as a refusal may carry it: counts, one closed word, and the call's own field keys. */
function readDetail(shortfall: WebActionReadShortfall): WebLlmToolRejectionDetail {
  return rejectionDetail({
    reason: shortfall.reason,
    target: undefined,
    instead: undefined,
    missing: undefined,
    requestId: undefined,
    recordsRead: shortfall.recordsRead,
    itemsSeen: shortfall.itemsSeen,
    emptyRecords: shortfall.emptyRecords,
    missingFields: shortfall.missingFields,
    waitStoppedOn: shortfall.waitStoppedOn
  });
}
