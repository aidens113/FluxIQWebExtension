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
// The `detail` that answered that did not reach the one path the model now
// uses. Every handle a plan resolver would not make real came back as the
// single reason `parameters_not_resolved`, with the resolver's own codes
// buried in `instead` among the shapes a handle is written in -- so
// `target_unobserved` was one word again. Measured on `run-muf8dstp-0135804a`,
// 2026-09-24: twenty of 32 decision rows read it, mutually indistinguishable,
// inside one undivided 99-second gap. `webLlmHandleRejectionReason` below
// reads those codes and gives back the reason each one implies, which is what
// makes the three defects behind that one word three answers again.
//
// So a rejection now carries a `detail`, and everything in it is one of three
// things and never a fourth:
//
// 1. **the model's own input, echoed back** -- the handle it named;
// 2. **this domain's own closed vocabulary** -- one `reason` from the list
//    below, the input keys a tool declares in its own schema, the id of a
//    node this domain runs (`useNode`), and Core's consequence classes;
// 3. **an identifier Core minted** -- the id of the permission request now in
//    front of the person.
// 4. **a count of what the packet the model was already shown describes** --
//    how many records its controls sit in, how many copies the most-repeated
//    of them has, how many controls the page offered.
//
// None of those is page content. No text from the page, no selector, no value,
// and nothing drawn from a capture the model was not shown. A detail that would
// need any of those is not added; the reason says what to do instead, which is
// what the model needed in the first place.
//
// The fourth was added on 2026-09-24, relaxing a rule that had been written as
// "no count of what is on it". A count says how many, never which or what, and
// these three are already published fields of the packet the model holds, so a
// refusal repeating one tells it nothing new -- it tells it which of them the
// refusal turned on. Still refused: a count of a capture the model was not
// shown, and any number that could only come from reading a value.
// `structure/refusal.ts` has the run this was measured on.
//
// One kind of refusal carries more than that: a refusal the page caused. When a
// press is refused because a dialog or a banner covers the control, the model
// needs to see what covers it before it can deal with it, and until it changes
// something the loop will not let it look again. So such a refusal carries the
// page as it now stands (`page`): the page as an inspection returns it, the
// compact view (`web-llm-page.v3`, `./page-view/`), never the structured packet.

import { publishedWebLlmPage, type WebLlmPublishedPage } from "./page-view";
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
 * rather than a policy, and it is reported the same way, so the answer carries
 * no page content either -- only which of the four situations in
 * `WEB_LLM_TOOL_REJECTION_REASONS` it was, and the counts behind that
 * (`structure/refusal.ts`). One word for all four is what a model asked 24
 * times in a row on `run-mug25fdp-21ba8385`.
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
 *   or a value only the person can supply. Do not try to get past it. A robot
 *   check (`USER_INTERVENTION_REQUIRED`) never reaches the model at all: the
 *   call is marked `personNeeded` (`RecoverableToolRejection.personNeeded`),
 *   and Core asks the person to clear it and press Continue instead
 *   (`AS/runtime/parking/person-needed-ask.ts`).
 * - `target_covered`: something that is not a modal -- a banner, an overlay --
 *   lies over the control.
 *
 * Either of the last two is also said before anything is sent, with the reason
 * `covered_by_layer`, when the look a press takes before it acts already shows
 * the control `coveredBy` something: `target` is the control's handle,
 * `instead` the handles of what covers it, and `page` the page with that layer
 * in it -- its `COVERING` or `DIALOG` header line names it. Deal with the layer
 * first (close it, or answer it), then press the control again. A press made
 * through a cover used to be sent anyway: it closed a timed email popup by
 * landing on its backdrop and was reported `succeeded`, while the store button
 * underneath it never opened anything (`run-mup2i28c-6c7fc209`, C4, C9).
 * - `target_not_actionable`: the control is there but disabled or hidden.
 * - `target_not_found`: the control is no longer on the page, or no longer one.
 * - `page_changed`: the page navigated or was replaced while the action ran.
 * - `action_timed_out`: the action did not finish in time.
 * - `output_not_observed`: the node ran and what it exists to produce did not
 *   appear -- a read that came back with fewer records than it was asked for,
 *   a record short of a field it declared, an assertion about the page that did
 *   not hold. The step is the right shape and its arguments are not, which is a
 *   different move from every code above it: nothing on the page is in the way,
 *   so there is nothing to press or close. `detail.reason` says which shortfall
 *   it was and the counts beside it say how far off it was
 *   (`action-failure/read-shortfall.ts`).
 * - `not_permitted_here`: the browser itself refused, because this extension
 *   may not touch that page -- a host the manifest does not request, a
 *   `chrome://` or gallery URL, an enterprise policy. No retry of any kind
 *   clears it and nothing on the page can be dealt with; the only move is to be
 *   somewhere else.
 * - `refused_by_page`: the press landed and the page refused it in words of
 *   its own, beside the control, and did nothing: it needs something first --
 *   a choice made, a field filled (`page_needs_something_first`) -- or it was
 *   busy, or the press came too fast (`page_busy_try_later`). The page's words
 *   are on the page the refusal carries, never in the refusal. Until t174 F40
 *   (2026-10-02) the first was a success and the second `action_failed`.
 * - `action_failed`: the action failed for a reason none of these names.
 * - `page_unreadable`: the page could not be captured at all.
 *
 * There is no longer a refusal for a page too large to describe: the packet
 * carries the whole page whatever its size (t200), so
 * `evidence_budget_exhausted` was retired with the byte budget it reported.
 *
 * `not_at_start_location` is the one refusal that is about where the Flow is
 * rather than about what is on the page. A build that was told where its Flow
 * starts (`AS/runtime/flow-bootstrap/start-location.ts`) begins nowhere: no
 * page was opened for it, so there is nothing to read, nothing to press and no
 * handle that could have come from anywhere. The only call that works is the
 * one that goes to the start location, and this says so and names it. It is
 * deliberately not a stopping refusal -- the model is meant to act on it, not
 * to be ended by it -- which is why it is not `out_of_scope`.
 *
 * `address_not_shown` is a build's navigation to an address nothing it was
 * shown holds (`node-run/shown-addresses.ts`). Live, a build wrote one
 * product's slug with another product's id, the site routed by the id, and the
 * Flow's "first product" step opened the second (`run-munvvc3z-3eadc185`). It
 * is a move to make rather than a stop, like `not_at_start_location`.
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
  "output_not_observed",
  "not_permitted_here",
  "refused_by_page",
  "action_failed",
  "page_unreadable",
  "not_at_start_location",
  "address_not_shown"
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
 * - `handle_in_wrong_parameter`: the handle is written in a parameter that
 *   takes no handle. Put it in the one the node's description names.
 * - `handle_in_another_frame`: the step already names a frame other than the
 *   one the handle's element is in, so moving it there would be a guess.
 * - `handle_wrong_kind_of_control`: the handle names a real control, and not
 *   one this node can act on -- a choice step given a button, an entry step
 *   given a link. The handle is not the mistake; the node is. When the
 *   control's own kind says which node does act on it, `useNode` names that
 *   node: call it with the same handle (`target`). Without `useNode`, choose
 *   a handle whose control this node fits.
 * - `extraction_handle_required`: a repeating list was already detected here,
 *   so an extraction written from selectors is a guess at what was never
 *   shown. Name the detected list's own handle.
 * - `column_not_in_detected_list`: a column of the extraction names a field the
 *   detected list has no column for. Choose one it does have.
 *
 * Where the Flow is (`not_at_start_location`):
 * - `start_location_not_reached`: the Flow has not reached the place it starts
 *   from, and nothing was opened for it. `startLocation` names that place. Run
 *   the node that goes there, with that as its destination; it is also the
 *   Flow's own first step, because the Flow is built from the steps that ran.
 *
 * Where the call would go (`address_not_shown`):
 * - `address_not_shown`: the address is not the start location, a page this
 *   build has been on, a link a packet showed, an address a read returned, or
 *   a site search this build ran itself, with other words. `instead` names the
 *   two ways there: press the link that goes there, or navigate to an address
 *   the evidence gave. `startLocation` names where the Flow starts, if known.
 *
 * The input the call wrote (`invalid_input`):
 * - `unexpected_input_keys` and `missing_input_keys`: the call's keys are not
 *   the tool's. `instead` names the keys the tool takes.
 * - `malformed_handle`: the target is not a handle this domain issues. Copy one
 *   exactly as a packet shows it, `t` and a number.
 * - `not_a_number`, `not_a_url`, `value_not_text`: a value is not of the kind
 *   the tool's own schema declares.
 * - `not_a_text_field`: the control named is neither a text entry nor a select,
 *   so there is nothing to enter a value into. Press it instead.
 *
 * What the page holds, or does not (`no_repeating_structure`):
 * - `nothing_repeats_around_target`: the call named an element, and what it
 *   sits in holds no repeating children. Detect without a target, or name an
 *   element inside a row of the list actually wanted.
 * - `repeating_groups_not_readable`: the page does repeat, and none of its runs
 *   is a list a field can be read from. Name an element inside one, or narrow
 *   the page first.
 * - `nothing_repeats_on_page`: nothing on this page repeats at all, so this is
 *   not where the list is. Go where it is, or search first.
 * - `page_is_not_the_content`: what was captured stands in front of the content
 *   rather than being it -- a modal, an overlay, or almost no controls at all,
 *   which is the shape of a robot check or a page that has not drawn. Deal with
 *   what is in the way; asking again is answered the same.
 *
 * What a read came back with, or did not (`output_not_observed`). Each is read
 * off the extraction's own account of itself, which the page already sends and
 * this domain used to discard (`action-failure/read-shortfall.ts`):
 * - `list_never_appeared`: the item selector named nothing on the page, so
 *   there was never a list to read. Detect the list again and write the handle
 *   it issues; changing the fields or the conditions cannot help.
 * - `list_did_not_finish_loading`: the wait for the list ended on something
 *   other than the list arriving -- the page settling, the render window, the
 *   command's own deadline -- with nothing read. The list is late or is not on
 *   this page; go where it is, or act to bring it up.
 * - `conditions_kept_nothing`: `where` was applied and kept no item at all, so
 *   the read is empty because of its own conditions rather than the page. Widen
 *   or drop them, or name a column the detection actually showed.
 * - `records_have_no_fields`: the rows were found and every returned record is
 *   empty, so the fields are being read off the wrong element. Re-detect and
 *   map the columns the detection names.
 * - `required_fields_missing`: some record lacked a field declared required.
 *   `missingFields` names them, in the call's own words. Make them optional or
 *   map them to a column the list has.
 * - `fewer_records_than_required`: rows were read, just fewer than `minItems`.
 *   Reach a page with more of them, paginate, or lower the minimum.
 * - `no_records_read`: the read came back with nothing and none of the above
 *   says why. The page held nothing here.
 *
 * What the client would not run at all:
 * - `state_not_as_asserted`: an authored claim about the page did not hold.
 *   The page is in some other state; look at it before asserting again.
 * - `page_not_scriptable`: the browser refused to run anything on that page.
 *   Not retryable by anything the model can write.
 * - `channel_to_page_failed`: the verb was never reached -- the content script
 *   was not in the frame yet, the port closed, the frame was replaced. Nothing
 *   is wrong with the call; run it again.
 * - `parameter_not_readable`: a parameter arrived in a shape the client could
 *   not read, so the command was refused before it was dispatched. Write the
 *   node's own parameter shape.
 *
 * What the page answered a press with (`refused_by_page`):
 * - `page_needs_something_first`: the page wrote beside the control that it
 *   needs something before it will do this -- a choice, a value, a field --
 *   and did nothing. Read what it asked for on the page, give it that, then
 *   press again; the same press first is answered the same way.
 * - `page_busy_try_later`: the page said it was busy, or that presses came too
 *   fast, and did nothing. The same press may work a moment later.
 *
 * What this domain already said (`answered_the_same_again`):
 * - the answer to this call is byte-for-byte the one it was given last time,
 *   and `repeatedAnswer` says how many times in a row that has now happened.
 *   Nothing was learned and nothing will be; the move is a different call, not
 *   this one with a changed argument. `repeated-refusal.ts` has the run that
 *   measured what repeating costs.
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
 * - `consequences_declined`: the person declined this press. Do not make it
 *   again with that declaration; do the task another way or finish without
 *   it. `missing` names the classes they refused and `requestId` the request
 *   they answered.
 * - `nobody_to_ask`: the same refusal with no run behind it to raise a request,
 *   so there is nobody it could be put to. `missing` still names the classes.
 */
export const WEB_LLM_TOOL_REJECTION_REASONS = [
  "start_location_not_reached",
  "address_not_shown",
  "nothing_observed_yet",
  "handle_not_in_packet",
  "page_moved_since_packet",
  "handle_no_longer_on_page",
  "handle_names_several_now",
  "handle_in_wrong_parameter",
  "handle_in_another_frame",
  "handle_wrong_kind_of_control",
  "covered_by_layer",
  "extraction_handle_required",
  "column_not_in_detected_list",
  "unexpected_input_keys",
  "missing_input_keys",
  "malformed_handle",
  "not_a_number",
  "not_a_url",
  "value_not_text",
  "not_a_text_field",
  "nothing_repeats_around_target",
  "repeating_groups_not_readable",
  "nothing_repeats_on_page",
  "page_is_not_the_content",
  "list_never_appeared",
  "list_did_not_finish_loading",
  "conditions_kept_nothing",
  "records_have_no_fields",
  "required_fields_missing",
  "fewer_records_than_required",
  "no_records_read",
  "state_not_as_asserted",
  "page_not_scriptable",
  "channel_to_page_failed",
  "parameter_not_readable",
  "page_needs_something_first",
  "page_busy_try_later",
  "answered_the_same_again",
  "page_unchanged_after_action",
  "already_at_destination",
  "nothing_changed_while_waiting",
  "another_origin",
  "consequences_unreadable",
  "consequences_not_granted",
  "consequences_declined",
  "nobody_to_ask",
  // The library verb names a node, and two things can be wrong with the naming.
  // `instead` carries what the call could have written: the nodes this domain
  // can run, or the resolver's own codes for a handle it would not make real.
  //
  // `parameters_not_resolved` is now the last answer rather than the first: the
  // resolver's codes are read (`HANDLE_ISSUE_REASONS`) and the reason above
  // that each one implies is given instead. What is left when none of them
  // matches is a gap in that table rather than a fact about the call, so a
  // refusal that still reads `parameters_not_resolved` is a finding about this
  // file.
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
  /**
   * The node that acts on the control `target` names, when the node the call
   * named cannot (`handle_wrong_kind_of_control`): one of this domain's node
   * ids, read off the resolver's own closed codes, never page text. The move is
   * the same call again with this node and the same handle.
   *
   * A field of its own rather than a member of `instead`, because on this
   * refusal `instead` already carries the resolver's codes and the shapes a
   * handle is written in, and a node id among them is one the model has to
   * pick out. Live, the refusal without it was made five times in one build
   * with the right handle and the wrong node (`run-munnq7vz-98c3481c`).
   */
  useNode?: string;
  /**
   * On `covered_by_layer` only: the controls inside the first layer `instead`
   * names that close it -- its "×", "No thanks", "Close" -- by handle, and the
   * move in `next`. Handles and this domain's own words, never page text: the
   * page the refusal carries shows each control's name. Crossborder's run
   * `run-muqc07fh-eeffbc86` (step 0018) typed into a search field under a coupon
   * popup, closed the popup, and never made the search again.
   */
  closeWith?: string[];
  next?: string;
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
  /**
   * The three counts a structure detection's refusal carries, and no other
   * refusal does (`structure/refusal.ts`). They are what separates "this page
   * has nothing that repeats" from "this page repeats and the detection would
   * not read it", and what makes `page_is_not_the_content` checkable rather
   * than asserted.
   *
   * How many separate records -- rows, cards, list items -- the capture's own
   * controls sit in.
   */
  groupsSeen?: number;
  /** The most copies any one control has: the largest repeating run the capture saw (`elements[].repeats`). */
  rowsSeen?: number;
  /** How many of the packet's elements are controls (`actionableEvidenceElement`); the packet carries every rendered element. */
  controlsSeen?: number;
  /**
   * What a read that fell short came back with, and no other refusal carries
   * (`action-failure/read-shortfall.ts`).
   *
   * Every one of these is already a published field of the extraction's own
   * summary (`actions/extraction/summary.ts`), which admits nothing but counts,
   * flags, closed words and the call's own declared field keys -- so repeating
   * one here says how much was read and never what was on the page. The rule
   * the top of this file draws is unchanged; this is the fourth kind of value
   * it already allows, applied to a read instead of to a detection.
   *
   * Why they are here at all: on `run-mulryg6h-ff241a12` an extraction failed
   * three times and was reported to the model as the bare word `action_failed`,
   * with 6,149 bytes of evidence that were byte-identical on all three
   * attempts, while the page had computed every count below and this domain
   * discarded it at `capture.ts`. The build spent its remaining twelve
   * decisions repeating itself and produced no Flow.
   *
   * How many records the read returned.
   */
  recordsRead?: number;
  /** How many items the read's own item selector matched, before conditions, duplicates and the item bound. `0` is the selector naming nothing. */
  itemsSeen?: number;
  /** How many of the returned records yielded no declared field at all. Equal to `recordsRead` means the fields were read off the wrong element. */
  emptyRecords?: number;
  /** The declared field keys some record lacked: the call's own words for its own columns, never a word of the page. */
  missingFields?: string[];
  /** Which of four things ended the wait for the list (`actions/extraction/summary.ts` `WebAutomationExtractionWaitStop`). */
  waitStoppedOn?: string;
  /**
   * Why a read that paged stopped paging (`actions/extraction/summary.ts`
   * `WebAutomationExtractionPaginationStop`): a read that came back short after
   * one page of fifty is a different repair when the page ignored its Next than
   * when the Next selector named nothing.
   */
  paginationStop?: string;
  /** How many times in a row this same answer has now been given, counting from 2 (`repeated-refusal.ts`). */
  repeatedAnswer?: number;
};

export type WebLlmToolRejection = {
  schemaVersion: typeof WEB_LLM_TOOL_RESULT_SCHEMA_VERSION;
  ok: false;
  code: WebLlmToolRejectionCode;
  /** Why, and what to do about it. Absent only where the code already says everything the model could act on. */
  detail?: WebLlmToolRejectionDetail;
  /** The page as it stands after a refusal the page caused, as the model reads every page (t223); absent on every other refusal. */
  page?: WebLlmPublishedPage;
};

export class RecoverableToolRejection extends Error {
  /**
   * `page` is set only for a refusal the page caused, and only when the page could be captured.
   *
   * `personNeeded` is set only when the page answered `USER_INTERVENTION_REQUIRED`:
   * a robot check stood in the way and nothing was done about it. Such a refusal
   * is not for the model -- the call's result says `personNeeded` and Core puts
   * the check to the person (`./node-run/run.ts`).
   */
  constructor(
    readonly code: WebLlmToolRejectionCode,
    readonly detail?: WebLlmToolRejectionDetail,
    readonly page?: WebLlmSnapshotBinding,
    readonly personNeeded?: true
  ) {
    super(code);
  }
}

/** Refuse the call. Throws, so a caller cannot forget to stop. */
export function recoverable(code: WebLlmToolRejectionCode, detail?: WebLlmToolRejectionDetail): never {
  throw new RecoverableToolRejection(code, detail);
}

/**
 * The plan resolver's own codes for a handle it would not make real
 * (`plan-resolution/resolve-plan-node.ts` `WEB_PLAN_HANDLE_ISSUE_CODES`),
 * against the reason each one implies.
 *
 * Both halves are this domain's closed vocabulary, so nothing the page said can
 * cross this table; what it does is turn one word back into the several
 * different mistakes it was made of. The codes it does not name -- the
 * `web.handle.expected.*` shape hints, and the `<code>:<position>` entries --
 * are not reasons at all and are passed over.
 */
const HANDLE_ISSUE_REASONS: ReadonlyMap<string, WebLlmToolRejectionReason> = new Map([
  ["web.handle.malformed", "malformed_handle"],
  ["web.handle.misplaced", "handle_in_wrong_parameter"],
  ["web.handle.unknown", "handle_not_in_packet"],
  ["web.handle.stale", "page_moved_since_packet"],
  ["web.handle.ambiguous", "handle_names_several_now"],
  ["web.handle.not_unique", "handle_names_several_now"],
  ["web.handle.frame_mismatch", "handle_in_another_frame"],
  ["web.handle.unknown_field", "column_not_in_detected_list"],
  ["web.handle.extraction_required", "extraction_handle_required"],
  ["web.handle.wrong_control", "handle_wrong_kind_of_control"]
] as const satisfies ReadonlyArray<readonly [string, WebLlmToolRejectionReason]>);

/**
 * Which of those mistakes a resolver refusal was, given its codes.
 *
 * The defect this closes is the failed multi-step run `run-muf8dstp-0135804a`:
 * twenty of its 32 decision rows read `web.action.rejected.target_unobserved`
 * and were mutually indistinguishable, because every way a handle can fail to
 * name one control arrived as the single reason `parameters_not_resolved`. A
 * handle that was never in a packet, a handle whose page the exploration has
 * left, and a selector the page has given to several controls are three
 * different defects with three different next moves, and the model was told
 * one word for all of them.
 *
 * The first code that names a reason wins, which is the resolver's own
 * priority: it lists its reasons in `WEB_PLAN_HANDLE_ISSUE_CODES` order before
 * anything else, so reading in order is reading that order.
 */
export function webLlmHandleRejectionReason(issueCodes: readonly string[]): WebLlmToolRejectionReason {
  for (const code of issueCodes) {
    const reason = HANDLE_ISSUE_REASONS.get(code);
    if (reason !== undefined) return reason;
  }
  return "parameters_not_resolved";
}

/**
 * The resolver's codes for the node that fits a control it refused a node on
 * (`plan-resolution/resolve-plan-node.ts`, `web.handle.expected.node.*`),
 * against that node's id. Both halves are closed: a code not in this table
 * names no node, whatever it says.
 */
const HANDLE_FITTING_NODES: ReadonlyMap<string, string> = new Map([
  ["web.handle.expected.node.web.output.dom-click", "web.output.dom-click"],
  ["web.handle.expected.node.web.output.dom-select", "web.output.dom-select"]
]);

/** The node a resolver refusal says fits the control its handle names, or nothing when it names none. */
function webLlmHandleFittingNode(issueCodes: readonly string[]): string | undefined {
  for (const code of issueCodes) {
    const node = HANDLE_FITTING_NODES.get(code);
    if (node !== undefined) return node;
  }
  return undefined;
}

/**
 * One reason, carrying only the fields that reason gives a meaning to.
 *
 * A caller that has the resolver's codes but not the reason behind them says
 * `parameters_not_resolved` and puts the codes in `instead`; the reason is
 * sharpened here rather than there, so there is one place the table is applied
 * and no caller can forget it. It is idempotent -- a reason that has already
 * been sharpened is not `parameters_not_resolved`, so a caller that comes to
 * call `webLlmHandleRejectionReason` itself changes nothing here.
 */
export function rejectionDetail(fields: {
  reason: WebLlmToolRejectionReason;
  target?: string | undefined;
  instead?: readonly string[] | undefined;
  missing?: readonly string[] | undefined;
  requestId?: string | undefined;
  startLocation?: string | undefined;
  groupsSeen?: number | undefined;
  rowsSeen?: number | undefined;
  controlsSeen?: number | undefined;
  recordsRead?: number | undefined;
  itemsSeen?: number | undefined;
  emptyRecords?: number | undefined;
  missingFields?: readonly string[] | undefined;
  waitStoppedOn?: string | undefined;
  paginationStop?: string | undefined;
  repeatedAnswer?: number | undefined;
  closeWith?: readonly string[] | undefined;
}): WebLlmToolRejectionDetail {
  const reason = fields.reason === "parameters_not_resolved" && fields.instead !== undefined
    ? webLlmHandleRejectionReason(fields.instead)
    : fields.reason;
  return present<WebLlmToolRejectionDetail>({
    reason,
    target: fields.target,
    // Copied, so a caller's own list cannot be changed by what goes on the wire, and the packet stays plain JSON.
    instead: fields.instead === undefined ? undefined : [...fields.instead],
    // Read off the same codes the reason was, and in the same one place, so a
    // repeat of this refusal (`repeated-refusal.ts`), which passes `instead`
    // back through here, names the node again without knowing it exists.
    useNode: reason === "handle_wrong_kind_of_control" && fields.instead !== undefined ? webLlmHandleFittingNode(fields.instead) : undefined,
    closeWith: fields.closeWith === undefined || fields.closeWith.length === 0 ? undefined : [...fields.closeWith],
    next: reason === "covered_by_layer" ? (fields.closeWith?.length ? COVERED_NEXT_CLOSE : COVERED_NEXT) : undefined,
    missing: fields.missing === undefined ? undefined : [...fields.missing],
    requestId: fields.requestId,
    startLocation: fields.startLocation,
    // A count only, and only a whole one: a fraction or an infinity is a defect
    // in the counting rather than a fact about the page, and is left out.
    groupsSeen: wholeCount(fields.groupsSeen),
    rowsSeen: wholeCount(fields.rowsSeen),
    controlsSeen: wholeCount(fields.controlsSeen),
    recordsRead: wholeCount(fields.recordsRead),
    itemsSeen: wholeCount(fields.itemsSeen),
    emptyRecords: wholeCount(fields.emptyRecords),
    // Copied for the same reason `instead` is, and left out when empty: a read
    // that was short of nothing says so by carrying no list, not by carrying an
    // empty one.
    missingFields: fields.missingFields === undefined || fields.missingFields.length === 0 ? undefined : [...fields.missingFields],
    waitStoppedOn: fields.waitStoppedOn,
    paginationStop: fields.paginationStop,
    repeatedAnswer: wholeCount(fields.repeatedAnswer)
  });
}

/** What to do about a control a layer covers, when the layer's own close control is known (`closeWith`). */
const COVERED_NEXT_CLOSE = "Nothing was done. The layer in instead covers the target: press one of closeWith to close it, then make this same call again, unchanged.";
/** The same, when no control of the layer reads as closing it. */
const COVERED_NEXT = "Nothing was done. The layer in instead covers the target: close or answer it with one of its own controls on the page, then make this same call again, unchanged.";

/** A count fit to put on the wire, or nothing. */
function wholeCount(value: number | undefined): number | undefined {
  return value !== undefined && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}

/**
 * A refusal, with the page it was refused on when the page caused it. The page
 * goes out as the compact view; the structured packet stays in the domain.
 */
export function toolRejection(code: WebLlmToolRejectionCode, page?: WebLlmPageEvidence, detail?: WebLlmToolRejectionDetail): WebLlmToolRejection {
  return present<WebLlmToolRejection>({ schemaVersion: WEB_LLM_TOOL_RESULT_SCHEMA_VERSION, ok: false, code, detail, page: page === undefined ? undefined : publishedWebLlmPage(page) });
}
