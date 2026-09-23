// A tool call the runtime refuses on purpose, and the result it returns
// instead. A rejection is not an error: the model asked for something policy
// does not allow, or asked badly, or the page would not let the action happen,
// and telling it so lets it try something else.
//
// **What a rejection may carry, and why it is not the page.** Until 2026-09-22
// the reply was a code and nothing else, so that a refusal could never become a
// side channel for the page content the refusal was protecting. That guard was
// right and is kept; what it also did, unintentionally, was leave the model
// with no way to tell one cause from another. `target_unobserved` is the same
// word for a handle that was never in a packet, a handle whose page has since
// been left, and a control that is no longer there -- and each of those wants a
// different next move. Measured on round 1 of the live campaign, 2026-09-21:
// about seventy attempts to build a Flow produced one Flow, and
// `repeat_without_progress` was among the top endings, because a model that
// cannot tell why a call was refused has nothing to do but make it again, and
// Core's loop answers a repeat from what it already holds until the build runs
// out of steps.
//
// So a rejection now carries a `detail`, and everything in it is one of three
// things and never a fourth:
//
// 1. **the model's own input, echoed back** -- the handle it named;
// 2. **this domain's own closed vocabulary** -- one `reason` from the list
//    below, the input keys a tool declares in its own schema, and Core's
//    consequence classes;
// 3. **an identifier Core minted** -- the id of the permission request now in
//    front of the person.
//
// None of those is page content. No text from the page, no selector, no value,
// no count of what is on it, and nothing drawn from a capture the model was not
// shown. A detail that would need any of those is not added; the reason says
// what to do instead, which is what the model needed in the first place.
//
// One kind of refusal carries more than that: a refusal the page caused. When a
// press is refused because a dialog or a banner covers the control, the model
// needs to see what covers it before it can deal with it, and until it changes
// something the loop will not let it look again. So such a refusal carries the
// page as it now stands (`page`): the same sanitized packet an inspection
// returns, never anything the packet would not show.

import { present } from "./present";
import type { WebLlmPageEvidence, WebLlmSnapshotBinding } from "./sanitize";

export const WEB_LLM_TOOL_RESULT_SCHEMA_VERSION = "web-llm-tool-result.v1" as const;

/**
 * Every reason a tool call is refused. A runtime value rather than a bare
 * union, because the set has to be enumerable outside this package; the type
 * is derived from it, so the two cannot disagree.
 *
 * `cross_origin` and `out_of_scope` are two claims, not one. The first is this
 * domain's own fixed rule for the authoring tools -- never leave the page's
 * origin. The second is a refusal under the scope policy Core gave the
 * exploration, which may be an allowlist of several places and so cannot be
 * described as crossing an origin at all.
 *
 * `no_repeating_structure` is the structure-detection tool's answer when the
 * page has nothing there that repeats readably. It is a fact about the page
 * rather than a policy, but it is reported the same way, so the answer can
 * carry nothing from the page either.
 *
 * The codes from `blocked_by_dialog` on are what the page did rather than what
 * policy refused. Each was a thrown error until 2026-09-21, and Core ended the
 * whole exploration on the first one: measured live on the professional-network
 * site, Flow creation died on its first press because a promotion had opened
 * over the page after it loaded. They are read from the client's closed
 * failure code (`action-failure.ts`), never from its text:
 * - `blocked_by_dialog`: a dialog is open over the page, and the control is
 *   behind it. Nothing on the dialog asks for what only a person can give, so
 *   answer or close it first.
 * - `needs_person`: what stands in the way is for a person alone to answer --
 *   a robot check, a sign-in, a second-factor code, a payment confirmation --
 *   or a value only the person can supply. Do not try to get past it.
 * - `target_covered`: something that is not a modal -- a banner, an overlay --
 *   lies over the control.
 * - `target_not_actionable`: the control is there but disabled or hidden.
 * - `target_not_found`: the control is no longer on the page, or no longer one.
 * - `page_changed`: the page navigated or was replaced while the action ran.
 * - `action_timed_out`: the action did not finish in time.
 * - `action_failed`: the action failed for a reason none of these names.
 * - `page_unreadable`: the page could not be captured at all.
 * - `evidence_budget_exhausted`: what is left of the exploration's evidence
 *   budget cannot hold even an empty packet of this page.
 *
 * `not_at_start_location` is the one refusal that is about where the Flow is
 * rather than about what is on the page. A build that was told where its Flow
 * starts (`AS/runtime/flow-bootstrap/start-location.ts`) begins nowhere: no
 * page was opened for it, so there is nothing to read, nothing to press and no
 * handle that could have come from anywhere. The only call that works is the
 * one that goes to the start location, and this says so and names it. It is
 * deliberately not a stopping refusal -- the model is meant to act on it, not
 * to be ended by it -- which is why it is not `out_of_scope`.
 */
export const WEB_LLM_TOOL_REJECTION_CODES = [
  "invalid_input",
  "cross_origin",
  "out_of_scope",
  "no_progress",
  "target_unobserved",
  "permission_required",
  "sensitive_value",
  "no_repeating_structure",
  "blocked_by_dialog",
  "needs_person",
  "target_covered",
  "target_not_actionable",
  "target_not_found",
  "page_changed",
  "action_timed_out",
  "action_failed",
  "page_unreadable",
  "evidence_budget_exhausted",
  "not_at_start_location"
] as const;

export type WebLlmToolRejectionCode = (typeof WEB_LLM_TOOL_REJECTION_CODES)[number];

/**
 * Why a call was refused, in this domain's own words, closed so that a reason
 * can never become a sentence somebody wrote about the page.
 *
 * Each one exists because it implies a *different* next move, which is the
 * whole point: a reason that would leave the model doing what another reason
 * already tells it to do should not be added.
 *
 * A handle the call named (`target_unobserved`):
 * - `nothing_observed_yet`: no packet has been shown here yet, so no handle can
 *   have come from one. Look at the page first.
 * - `handle_not_in_packet`: the handle is not one of those in the packet last
 *   shown for this page. Look again and copy a handle from what comes back.
 * - `page_moved_since_packet`: the packet the handle came from describes a
 *   different page than the one now loaded. Look again where you are now.
 * - `handle_no_longer_on_page`: the control that handle named is not on the
 *   page any more -- it was removed, or the page re-rendered. Look again.
 * - `handle_names_several_now`: the control that handle named has become more
 *   than one element, so acting on it would be a guess. Look again and choose.
 *
 * Where the Flow is (`not_at_start_location`):
 * - `start_location_not_reached`: the Flow has not reached the place it starts
 *   from, and nothing was opened for it. `startLocation` names that place. Run
 *   the node that goes there, with that as its destination; it is also the
 *   Flow's own first step, because the Flow is built from the steps that ran.
 *
 * The input the call wrote (`invalid_input`):
 * - `unexpected_input_keys` and `missing_input_keys`: the call's keys are not
 *   the tool's. `instead` names the keys the tool takes.
 * - `malformed_handle`: the target is not a handle this domain issues. Copy one
 *   exactly as a packet shows it, `target.` and a number.
 * - `not_a_number`, `not_a_url`, `value_not_text`: a value is not of the kind
 *   the tool's own schema declares.
 * - `not_a_text_field`: the control named is neither a text entry nor a select,
 *   so there is nothing to enter a value into. Press it instead.
 *
 * What the page did, or did not (`no_progress`):
 * - `page_unchanged_after_action`: the action ran and the page came back
 *   identical, so nothing was learned. Try something else.
 * - `already_at_destination`: the page asked for is the page already loaded.
 * - `nothing_changed_while_waiting`: the wait ended with the page as it was.
 *
 * Policy (`cross_origin`, `permission_required`):
 * - `another_origin`: the address is not on this page's origin.
 * - `consequences_unreadable`: what the call declared its action would do is
 *   not a list of Core's consequence classes, so nothing was asked and nothing
 *   was done.
 * - `consequences_not_granted`: the action's declared consequences include ones
 *   this run does not hold. `missing` names them and `requestId` names the
 *   request now in front of the person.
 * - `nobody_to_ask`: the same refusal with no run behind it to raise a request,
 *   so there is nobody it could be put to. `missing` still names the classes.
 */
export const WEB_LLM_TOOL_REJECTION_REASONS = [
  "start_location_not_reached",
  "nothing_observed_yet",
  "handle_not_in_packet",
  "page_moved_since_packet",
  "handle_no_longer_on_page",
  "handle_names_several_now",
  "unexpected_input_keys",
  "missing_input_keys",
  "malformed_handle",
  "not_a_number",
  "not_a_url",
  "value_not_text",
  "not_a_text_field",
  "page_unchanged_after_action",
  "already_at_destination",
  "nothing_changed_while_waiting",
  "another_origin",
  "consequences_unreadable",
  "consequences_not_granted",
  "nobody_to_ask",
  // The library verb names a node, and two things can be wrong with the naming.
  // `instead` carries what the call could have written: the nodes this domain
  // can run, or the resolver's own codes for a handle it would not make real.
  "node_not_runnable_here",
  "parameters_not_resolved",
  // The node acts on an element and its parameters named no handle. The model
  // has never been shown a locator, so whatever it wrote is one it invented;
  // `instead` carries the shape a handle is written in.
  "target_not_a_handle"
] as const;

export type WebLlmToolRejectionReason = (typeof WEB_LLM_TOOL_REJECTION_REASONS)[number];

/**
 * What a refusal says beyond its code. Every field is the model's own input,
 * this domain's closed vocabulary, or an id Core minted; the note at the top of
 * this file says why nothing else may be here.
 */
export type WebLlmToolRejectionDetail = {
  reason: WebLlmToolRejectionReason;
  /** The handle the call named, as it named it. */
  target?: string;
  /** What the call could have written instead: the keys the tool's own schema declares. */
  instead?: string[];
  /** Core's consequence classes this run does not hold. */
  missing?: string[];
  /** Core's id for the permission request now in front of the person. */
  requestId?: string;
  /**
   * Where the Flow starts, when the refusal is that it has not got there yet.
   *
   * It belongs in a refusal for the same reason `requestId` does: it is not a
   * word of the page. It was declared by whoever asked for the build and
   * carried in by Core (`AS/runtime/flow-bootstrap/start-location.ts`); no
   * capture produced it, and repeating it tells the model nothing about a page
   * it has not been shown -- it tells it where to go so it can be shown one.
   */
  startLocation?: string;
};

export type WebLlmToolRejection = {
  schemaVersion: typeof WEB_LLM_TOOL_RESULT_SCHEMA_VERSION;
  ok: false;
  code: WebLlmToolRejectionCode;
  /** Why, and what to do about it. Absent only where the code already says everything the model could act on. */
  detail?: WebLlmToolRejectionDetail;
  /** The page as it stands after a refusal the page caused; absent on every other refusal. */
  page?: WebLlmPageEvidence;
};

export class RecoverableToolRejection extends Error {
  /** `page` is set only for a refusal the page caused, and only when the page could be captured. */
  constructor(
    readonly code: WebLlmToolRejectionCode,
    readonly detail?: WebLlmToolRejectionDetail,
    readonly page?: WebLlmSnapshotBinding
  ) {
    super(code);
  }
}

/** Refuse the call. Throws, so a caller cannot forget to stop. */
export function recoverable(code: WebLlmToolRejectionCode, detail?: WebLlmToolRejectionDetail): never {
  throw new RecoverableToolRejection(code, detail);
}

/** One reason, carrying only the fields that reason gives a meaning to. */
export function rejectionDetail(fields: {
  reason: WebLlmToolRejectionReason;
  target?: string | undefined;
  instead?: readonly string[] | undefined;
  missing?: readonly string[] | undefined;
  requestId?: string | undefined;
  startLocation?: string | undefined;
}): WebLlmToolRejectionDetail {
  return present<WebLlmToolRejectionDetail>({
    reason: fields.reason,
    target: fields.target,
    // Copied, so a caller's own list cannot be changed by what goes on the wire, and the packet stays plain JSON.
    instead: fields.instead === undefined ? undefined : [...fields.instead],
    missing: fields.missing === undefined ? undefined : [...fields.missing],
    requestId: fields.requestId,
    startLocation: fields.startLocation
  });
}

export function toolRejection(code: WebLlmToolRejectionCode, page?: WebLlmPageEvidence, detail?: WebLlmToolRejectionDetail): WebLlmToolRejection {
  return present<WebLlmToolRejection>({ schemaVersion: WEB_LLM_TOOL_RESULT_SCHEMA_VERSION, ok: false, code, detail, page });
}
