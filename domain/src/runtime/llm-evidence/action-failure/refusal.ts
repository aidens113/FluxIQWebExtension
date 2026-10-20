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

import type { JsonObject } from "fluxiq/core";
import { webAutomationNextPageAnswerValue } from "../../../actions/next-page";
import { webAutomationScrollRequestIssues } from "../../../actions/scroll-request-issues";
import { WEB_AUTOMATION_FAILURE_CODES } from "../../failure";
import { rejectionDetail, type WebLlmToolRejectionCode, type WebLlmToolRejectionDetail, type WebLlmToolRejectionReason } from "../tool-rejection";
import { webActionReadShortfall, type WebActionReadShortfall } from "./read-shortfall";
import type { WebFailedActionResult } from "./result";

/** The refusal a failed action is reported to the model as: its code, and what it can say beyond it. */
export type WebActionRefusal = {
  code: WebLlmToolRejectionCode;
  /** Absent only where the code is the whole of what the model could act on. */
  detail: WebLlmToolRejectionDetail | undefined;
  /**
   * True only for `USER_INTERVENTION_REQUIRED`: a robot check the client met
   * and did not act on. Such a refusal is never shown to the model -- Core asks
   * the person to clear the check (`AS/runtime/parking/person-needed-ask.ts`).
   * `AUTH_REQUIRED` shares the `needs_person` code and not this: a sign-in is
   * not something a Continue press clears. Absent, never `undefined`, on
   * every other refusal.
   */
  personNeeded?: true;
};

// A dialog anyone may close and a challenge only a person may answer are two
// codes on the client's side, and they stay two here: the first invites the
// model to deal with the dialog, and the second is not the model's at all --
// the call is marked `personNeeded` and the person is asked to clear it.
const BY_FAILURE_CODE: Readonly<Record<string, WebLlmToolRejectionCode>> = Object.freeze({
  [WEB_AUTOMATION_FAILURE_CODES.BLOCKED_BY_DIALOG]: "blocked_by_dialog",
  [WEB_AUTOMATION_FAILURE_CODES.USER_INTERVENTION_REQUIRED]: "needs_person",
  [WEB_AUTOMATION_FAILURE_CODES.AUTH_REQUIRED]: "needs_person",
  [WEB_AUTOMATION_FAILURE_CODES.TARGET_NOT_FOUND]: "target_not_found",
  [WEB_AUTOMATION_FAILURE_CODES.TARGET_AMBIGUOUS]: "target_not_found",
  // A target the page has and does not show. Its code is Core's
  // `target_not_found` since t193-1002m, so a Flow run finds the current step by
  // state; the model is told what it was told while the code was
  // TARGET_NOT_ACTIONABLE, so exploration does not change: the control is
  // there, and what is in the way of using it is the page's to show.
  [WEB_AUTOMATION_FAILURE_CODES.TARGET_NOT_SHOWN]: "target_not_actionable",
  [WEB_AUTOMATION_FAILURE_CODES.PAGE_CHANGED]: "page_changed",
  [WEB_AUTOMATION_FAILURE_CODES.NAVIGATION_UNEXPECTED]: "page_changed",
  [WEB_AUTOMATION_FAILURE_CODES.TIMEOUT]: "action_timed_out",
  // The verb ran and what it exists to produce did not appear. One code for the
  // two post-conditions, because the move is the same -- the step is the right
  // shape and its arguments are not -- and the reason below tells them apart.
  [WEB_AUTOMATION_FAILURE_CODES.OUTPUT_NOT_OBSERVED]: "output_not_observed",
  [WEB_AUTOMATION_FAILURE_CODES.STATE_MISMATCH]: "output_not_observed",
  // A select asked for an option it does not offer (t464): the step is the
  // right shape and the value it sent is not one of the control's options.
  [WEB_AUTOMATION_FAILURE_CODES.OPTION_NOT_OFFERED]: "output_not_observed",
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
  [WEB_AUTOMATION_FAILURE_CODES.INVALID_PARAMETER]: "invalid_input",
  // The press landed and the page refused it in its own words beside the
  // control. One code for both refusals, because the model's move starts the
  // same -- read what the page wrote, on the page this refusal carries -- and
  // the reason says whether to give it something first or only to wait. Both
  // used to fall through to `action_failed`, which the activity card reads as
  // "the step wasn't accepted" (t174 F40, run-muqk4u32 step 0021).
  [WEB_AUTOMATION_FAILURE_CODES.REFUSED_BY_PAGE]: "refused_by_page",
  [WEB_AUTOMATION_FAILURE_CODES.RATE_LIMITED]: "refused_by_page"
});

/**
 * The reason a code implies on its own, for the codes whose whole meaning is in
 * the code the client sent.
 *
 * Two of the closed set's codes are deliberately absent and stay bare `action_failed`,
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
  [WEB_AUTOMATION_FAILURE_CODES.TARGET_AMBIGUOUS]: "target_ambiguous",
  [WEB_AUTOMATION_FAILURE_CODES.STATE_MISMATCH]: "state_not_as_asserted",
  // A select sent an option it does not offer (t464). Bare, it was sent again
  // as it was (t509, `run-mv6qrcdu-a31b44b8` steps 0020-0032): the reason's
  // `next` says where the options are shown, never which they are.
  [WEB_AUTOMATION_FAILURE_CODES.OPTION_NOT_OFFERED]: "option_not_offered",
  [WEB_AUTOMATION_FAILURE_CODES.BROWSER_PERMISSION_DENIED]: "page_not_scriptable",
  [WEB_AUTOMATION_FAILURE_CODES.TRANSPORT_TRANSIENT]: "channel_to_page_failed",
  [WEB_AUTOMATION_FAILURE_CODES.NO_EFFECT]: "press_had_no_effect",
  [WEB_AUTOMATION_FAILURE_CODES.UNSUPPORTED_TYPE]: "node_not_runnable_here",
  [WEB_AUTOMATION_FAILURE_CODES.NOT_IMPLEMENTED]: "node_not_runnable_here",
  [WEB_AUTOMATION_FAILURE_CODES.INVALID_PARAMETER]: "parameter_not_readable",
  [WEB_AUTOMATION_FAILURE_CODES.REFUSED_BY_PAGE]: "page_needs_something_first",
  // Core's repeat guard reads "busy" in a reason as "may work later", so the
  // same press stays open to the model on the same page.
  [WEB_AUTOMATION_FAILURE_CODES.RATE_LIMITED]: "page_busy_try_later"
});

/**
 * The refusal a failed action is reported to the model as.
 *
 * The read's own account wins over the code's reason where there is one, and
 * it is read whatever the code was: an extraction that ran out of time still
 * counted what it had read, and telling the model only `action_timed_out` would
 * throw that away exactly as the bare `action_failed` did.
 *
 * `sent` is the command this domain sent, when the caller has it: only a
 * scroll's own request is read from it, to name the keys an INVALID_PARAMETER
 * refusal of that scroll was about (`unreadableScrollKeys`).
 */
export function webActionFailureRefusal(result: WebFailedActionResult, sent?: { actionType: string; parameters: JsonObject }): WebActionRefusal {
  const code = webActionFailureRejectionCode(result);
  const shortfall = webActionReadShortfall(result.payload);
  const reason = typeof result.failure?.code === "string" ? BY_FAILURE_REASON[result.failure.code] : undefined;
  const filtersDropped = droppedFilters(result);
  const withoutValue = parameterWithoutValue(result);
  const scrollKeys = withoutValue === undefined ? unreadableScrollKeys(result, sent) : undefined;
  // This marker is the client's closed reason, never its field/page text.
  const incompleteText = result.status !== "timed_out" && result.failure?.code === WEB_AUTOMATION_FAILURE_CODES.OUTPUT_NOT_OBSERVED
    && typeof result.failure.actual === "string" && result.failure.actual.startsWith("incomplete_text:");
  const incompleteField = incompleteText ? incompleteTextField(result, sent) : undefined;
  const wait = siteWait(result);
  const refusal: WebActionRefusal = {
    code,
    detail: incompleteText
      ? rejectionDetail({
        reason: "incomplete_text",
        target: undefined,
        instead: incompleteField === undefined ? undefined : [`${INCOMPLETE_FIELD_CODE}${incompleteField}`],
        missing: incompleteField === undefined ? undefined : [incompleteField],
        requestId: undefined
      })
      : shortfall !== undefined
      ? readDetail(shortfall)
      : withoutValue !== undefined
        ? rejectionDetail({ reason: "parameter_has_no_value", target: undefined, instead: undefined, missing: [withoutValue], requestId: undefined })
      : scrollKeys !== undefined
        ? rejectionDetail({ reason: "parameter_not_readable", target: undefined, instead: scrollKeys.codes, missing: scrollKeys.missing.length > 0 ? scrollKeys.missing : undefined, requestId: undefined })
      : filtersDropped !== undefined
        ? rejectionDetail({ reason: "next_leaves_filtered_list", target: undefined, instead: undefined, missing: undefined, requestId: undefined, paginationStop: "page_fault", filtersDropped })
        : reason === undefined
          ? undefined
          : rejectionDetail({ reason, target: undefined, instead: undefined, missing: undefined, requestId: undefined, retryAfterMs: wait.retryAfterMs, tabReturned: wait.tabReturned })
  };
  if (webActionNeedsPerson(result)) refusal.personNeeded = true;
  return refusal;
}

/**
 * Whether the client met something only a person can clear -- a robot check --
 * and did not act on it: failure code `USER_INTERVENTION_REQUIRED`, and nothing
 * else. Read off the closed code alone, never the sentence beside it.
 */
export function webActionNeedsPerson(result: WebFailedActionResult): boolean {
  return result.status !== "timed_out" && result.failure?.code === WEB_AUTOMATION_FAILURE_CODES.USER_INTERVENTION_REQUIRED;
}

/** The refusal code alone, for a caller that reports the failure under a code of its own. */
export function webActionFailureRejectionCode(result: WebFailedActionResult): WebLlmToolRejectionCode {
  if (result.status === "timed_out") return "action_timed_out";
  const code = result.failure?.code;
  if (code === WEB_AUTOMATION_FAILURE_CODES.ACTION_REJECTED || code === WEB_AUTOMATION_FAILURE_CODES.TARGET_NOT_ACTIONABLE) {
    return typeof result.failure?.actual === "string" && result.failure.actual.startsWith("covered:") ? "target_covered" : "target_not_actionable";
  }
  return typeof code === "string" && Object.prototype.hasOwnProperty.call(BY_FAILURE_CODE, code) ? BY_FAILURE_CODE[code]! : "action_failed";
}

/**
 * The wait a press the site refused for now asked for, and whether the tab was
 * taken back to the page the press was made on (t741 C1b), or nothing: read off
 * RATE_LIMITED alone. The wait is the record's own `retryAfterMs`, a number the
 * extension wrote (`apps/extension/src/runtime/click-landing.ts`); the return is
 * the extension's closed words for a confirmed return in `actual`, matched and
 * never passed on, as `covered:` is read above -- the page path beside them
 * stays behind. An unconfirmed or failed return says nothing.
 */
function siteWait(result: WebFailedActionResult): { retryAfterMs: number | undefined; tabReturned: true | undefined } {
  const failure = result.failure;
  if (result.status === "timed_out" || failure?.code !== WEB_AUTOMATION_FAILURE_CODES.RATE_LIMITED) return { retryAfterMs: undefined, tabReturned: undefined };
  const retryAfterMs = "retryAfterMs" in failure && typeof failure.retryAfterMs === "number" ? failure.retryAfterMs : undefined;
  const tabReturned = typeof failure.actual === "string" && TAB_RETURNED.test(failure.actual) ? true : undefined;
  return { retryAfterMs, tabReturned };
}

/** The extension's closed words for a tab it took back to the page the act was made on, after a refused load. */
const TAB_RETURNED = /nothing was loaded; the tab was taken back to the page the (?:click|check|choice) was (?:pressed|made) on \(/u;

/**
 * How many filters the page shows applied that a Next page step's Next would
 * have dropped (t626), or nothing: read off the step's own answer through its
 * closed copy (`actions/next-page/answer-value.ts`), which keeps the count only
 * beside `page_fault`, and only on `ACTION_FAILED`, the code that word maps
 * to. A field the extension wrote, never a sentence. Bare `action_failed` stays
 * bare for every other failure, as the table above says.
 */
function droppedFilters(result: WebFailedActionResult): number | undefined {
  if (result.status === "timed_out" || result.failure?.code !== WEB_AUTOMATION_FAILURE_CODES.ACTION_FAILED) return undefined;
  const answer = webAutomationNextPageAnswerValue(result.payload?.nextPage);
  return answer?.outcome === "failed" ? answer.filtersDropped : undefined;
}

/**
 * The parameter a step had no value for when it ran (t640), or nothing: read
 * off INVALID_PARAMETER alone, from the closed words `no value:` that lead its
 * `actual` and the parameter name after them, as `covered:` is read above. The
 * producers are the navigate node (`output-nodes/native-runtime.ts`) and the
 * extension's runner; both write the name of a parameter of the node's own
 * schema, never a value. A name that is not an identifier is not passed on.
 */
function parameterWithoutValue(result: WebFailedActionResult): string | undefined {
  if (result.status === "timed_out" || result.failure?.code !== WEB_AUTOMATION_FAILURE_CODES.INVALID_PARAMETER) return undefined;
  const actual = result.failure.actual;
  if (typeof actual !== "string") return undefined;
  return NO_VALUE.exec(actual)?.[1];
}

/** The closed words a missing-value refusal's `actual` starts with, and the parameter it names. */
const NO_VALUE = /^no value: ([A-Za-z][A-Za-z0-9_]{0,63})(?=\s|$)/u;

/**
 * What made a scroll request unreadable, key by key, for an INVALID_PARAMETER
 * refusal of a scroll (t738; social `run-mvgf7ij5-a9747575`, where a scroll
 * refused this way was told only `parameter_not_readable` and written again
 * with the same keys). Read off the request this domain sent, through
 * `webAutomationScrollRequestIssues`, never off the client's sentence, which is
 * not safe to pass on. Each issue becomes a code `web.scroll.key.<problem>`,
 * with the key after it only when the key is an identifier, and the missing
 * keys are listed beside them. Nothing for any other refusal, or a request
 * with no `scroll` or no issue.
 */
function unreadableScrollKeys(result: WebFailedActionResult, sent: { actionType: string; parameters: JsonObject } | undefined): { codes: string[]; missing: string[] } | undefined {
  if (result.status === "timed_out" || result.failure?.code !== WEB_AUTOMATION_FAILURE_CODES.INVALID_PARAMETER) return undefined;
  if (sent?.actionType !== "web.dom.scroll" || sent.parameters.scroll === undefined) return undefined;
  const issues = webAutomationScrollRequestIssues(sent.parameters.scroll);
  if (issues.length === 0) return undefined;
  const named = (key: string) => KEY_NAME.test(key);
  return {
    codes: issues.map((issue) => named(issue.key) ? `web.scroll.key.${issue.problem}.${issue.key}` : `web.scroll.key.${issue.problem}`),
    missing: issues.filter((issue) => issue.problem === "missing" && named(issue.key)).map((issue) => issue.key)
  };
}

/** A key a refusal may name: an identifier, as the parameter names above are. */
const KEY_NAME = /^[A-Za-z][A-Za-z0-9_]{0,63}$/u;

/**
 * The field an incomplete-text refusal was about, or nothing. The client's
 * marker reads `incomplete_text: field <name> ...`; the name is passed on only
 * when it is an identifier and a key of the `extractList.fields` this domain
 * sent, so a refusal never echoes a key the request did not carry, the way
 * `unreadableScrollKeys` names only the request's own keys. Until this was
 * read, the field was dropped and builders re-sent the same field again
 * (social rerun 3, steps 0029, 0056, 0083, 0186, 0241).
 */
function incompleteTextField(result: WebFailedActionResult, sent: { actionType: string; parameters: JsonObject } | undefined): string | undefined {
  const actual = result.failure?.actual;
  const key = typeof actual === "string" ? INCOMPLETE_FIELD.exec(actual)?.[1] : undefined;
  if (key === undefined || !KEY_NAME.test(key)) return undefined;
  const extractList = sent?.parameters.extractList;
  if (extractList === null || typeof extractList !== "object" || Array.isArray(extractList)) return undefined;
  const fields = extractList.fields;
  if (fields === null || typeof fields !== "object" || Array.isArray(fields)) return undefined;
  return Object.prototype.hasOwnProperty.call(fields, key) ? key : undefined;
}

/** The closed words an incomplete-text marker starts with, and the field name after them. */
const INCOMPLETE_FIELD = /^incomplete_text: field (\S+)(?=\s|$)/u;

/** The code an incomplete-text refusal carries its field in, read back by `../rejection-next/next-sentence.ts`. */
const INCOMPLETE_FIELD_CODE = "web.text.incomplete_field.";

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
    waitStoppedOn: shortfall.waitStoppedOn,
    paginationStop: shortfall.paginationStop
  });
}
