// A tool call the runtime refuses on purpose, and the content-free result it
// returns instead. A rejection is not an error: the model asked for something
// policy does not allow, or asked badly, or the page would not let the action
// happen, and telling it so lets it try something else. The reply carries a
// code, so a refusal can never become a side channel for the page content the
// refusal was protecting.
//
// One kind of refusal carries more than its code: a refusal the page caused.
// When a press is refused because a dialog or a banner covers the control, the
// model needs to see what covers it before it can deal with it, and until it
// changes something the loop will not let it look again. So such a refusal
// carries the page as it now stands (`page`): the same sanitized packet an
// inspection returns, never anything the packet would not show.

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
 * rather than a policy, but it is reported the same way, as a bare code, so the
 * answer can carry nothing from the page either.
 *
 * The codes from `blocked_by_dialog` on are what the page did rather than what
 * policy refused. Each was a thrown error until 2026-09-21, and Core ended the
 * whole exploration on the first one: measured live on the professional-network
 * site, Flow creation died on its first press because a promotion had opened
 * over the page after it loaded. They are read from the client's closed
 * failure code (`action-failure.ts`), never from its text:
 * - `blocked_by_dialog`: a modal dialog is open over the page, and the control
 *   is behind it. Answer or close the dialog first.
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
  "target_covered",
  "target_not_actionable",
  "target_not_found",
  "page_changed",
  "action_timed_out",
  "action_failed",
  "page_unreadable",
  "evidence_budget_exhausted"
] as const;

export type WebLlmToolRejectionCode = (typeof WEB_LLM_TOOL_REJECTION_CODES)[number];

export type WebLlmToolRejection = {
  schemaVersion: typeof WEB_LLM_TOOL_RESULT_SCHEMA_VERSION;
  ok: false;
  code: WebLlmToolRejectionCode;
  /** The page as it stands after a refusal the page caused; absent on every other refusal. */
  page?: WebLlmPageEvidence;
};

export class RecoverableToolRejection extends Error {
  /** `page` is set only for a refusal the page caused, and only when the page could be captured. */
  constructor(readonly code: WebLlmToolRejectionCode, readonly page?: WebLlmSnapshotBinding) {
    super(code);
  }
}

/** Refuse the call. Throws, so a caller cannot forget to stop. */
export function recoverable(code: WebLlmToolRejectionCode): never {
  throw new RecoverableToolRejection(code);
}

export function toolRejection(code: WebLlmToolRejectionCode, page?: WebLlmPageEvidence): WebLlmToolRejection {
  return present<WebLlmToolRejection>({ schemaVersion: WEB_LLM_TOOL_RESULT_SCHEMA_VERSION, ok: false, code, page });
}
