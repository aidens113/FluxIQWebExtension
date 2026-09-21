// What a page action that did not succeed tells the model: one closed refusal
// code, read from the client's closed failure code and nothing else.
//
// The client reports a failed action with a record from the domain's closed
// failure set (`runtime/failure/codes.ts`) and a sentence about it. The code is
// safe to act on; the sentence is not safe to pass on, because it names what is
// on the page -- the element that covered the target, the text it carried. So
// this reads the code, and from the sentence only its leading reason word,
// which the client writes from a closed set of its own (`covered`, `hidden`,
// `disabled`), to tell an overlay from a disabled control.

import { WEB_AUTOMATION_FAILURE_CODES } from "../failure";
import type { WebLlmToolRejectionCode } from "./tool-rejection";

/** The part of a gateway result this reads. Every field is untrusted. */
export type WebFailedActionResult = {
  status: string;
  failure?: { code?: unknown; actual?: unknown } | undefined;
};

const BY_FAILURE_CODE: Readonly<Record<string, WebLlmToolRejectionCode>> = Object.freeze({
  [WEB_AUTOMATION_FAILURE_CODES.USER_INTERVENTION_REQUIRED]: "blocked_by_dialog",
  [WEB_AUTOMATION_FAILURE_CODES.TARGET_NOT_FOUND]: "target_not_found",
  [WEB_AUTOMATION_FAILURE_CODES.TARGET_AMBIGUOUS]: "target_not_found",
  [WEB_AUTOMATION_FAILURE_CODES.PAGE_CHANGED]: "page_changed",
  [WEB_AUTOMATION_FAILURE_CODES.NAVIGATION_UNEXPECTED]: "page_changed",
  [WEB_AUTOMATION_FAILURE_CODES.TIMEOUT]: "action_timed_out"
});

/** The refusal a failed action is reported to the model as. */
export function webActionFailureRejectionCode(result: WebFailedActionResult): WebLlmToolRejectionCode {
  if (result.status === "timed_out") return "action_timed_out";
  const code = result.failure?.code;
  if (code === WEB_AUTOMATION_FAILURE_CODES.ACTION_REJECTED) {
    return typeof result.failure?.actual === "string" && result.failure.actual.startsWith("covered:") ? "target_covered" : "target_not_actionable";
  }
  return typeof code === "string" && Object.prototype.hasOwnProperty.call(BY_FAILURE_CODE, code) ? BY_FAILURE_CODE[code]! : "action_failed";
}
