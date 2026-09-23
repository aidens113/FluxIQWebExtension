// The closed sets this module puts on the wire: the evidence tool ids it
// offers, and the result codes it emits. Both exist as runtime values, not
// only as types, because a consumer outside this package has to enumerate them
// -- `packages/test-runner` filters its sanitized diagnostic by exactly these
// sets, and while they were hand-maintained both halves drifted: the tool
// allowlist omitted `web.reveal_safe` (now `web.press_control`), so every such step was silently
// dropped, and the result-code list omitted `web.action.rejected.no_progress`.
//
// Each vocabulary type is now derived from its value rather than declared
// beside it, so the set is exhaustive by construction and a code that is added
// here cannot fail to appear in the set a consumer derives.

import { AUTOMATION_STUDIO_LLM_RUN_NODE_TOOL_ID } from "fluxiq/automation-studio";
import { WEB_LLM_TOOL_REJECTION_CODES, type WebLlmToolRejectionCode } from "./tool-rejection";

/**
 * The verb that runs a node of the library, named by Core rather than here.
 *
 * It is Core's because the argument shape is Core's: the call names a node of
 * the registry and carries that node's own parameters, and Core both builds the
 * declaration and reads the step back out of the draft
 * (`AS/runtime/llm/node-tools/`). Restating the id would be one more place for
 * the two halves of one call to drift apart.
 */
export const WEB_LLM_RUN_NODE_TOOL_ID = AUTOMATION_STUDIO_LLM_RUN_NODE_TOOL_ID;

/**
 * Every tool id this domain puts on the wire.
 *
 * Two are offered today. `core.run_node` runs whichever node of the library the
 * call names -- which is now the whole of how a build acts on a page, because
 * the exploratory verbs and the Flow's nodes were made the same thing on
 * 2026-09-22. `web.detect_repeating_structure` stays beside it because an
 * extraction node cannot be written without the handle it issues, and finding a
 * list is an observation about the page rather than a step of any Flow.
 *
 * The four retired ids stay in the list. It is read by `packages/test-runner`
 * to decide which recorded steps of a run it may show, and a run recorded
 * before this change still names them; dropping them would silently blank those
 * steps, which is the exact defect this list was made exhaustive to prevent.
 */
export const WEB_LLM_EVIDENCE_TOOL_IDS = [
  WEB_LLM_RUN_NODE_TOOL_ID,
  "web.detect_repeating_structure",
  "web.inspect_current_page",
  "web.navigate_same_origin",
  "web.press_control",
  "web.enter_field"
] as const;

export type WebLlmEvidenceToolId = (typeof WEB_LLM_EVIDENCE_TOOL_IDS)[number];

export const WEB_LLM_DETECT_STRUCTURE_TOOL_ID = WEB_LLM_EVIDENCE_TOOL_IDS[1];
/** Retired 2026-09-22, when the library's own nodes became what a build runs. Kept so a recorded run still reads. */
export const WEB_LLM_INSPECT_TOOL_ID = WEB_LLM_EVIDENCE_TOOL_IDS[2];
export const WEB_LLM_NAVIGATE_TOOL_ID = WEB_LLM_EVIDENCE_TOOL_IDS[3];
export const WEB_LLM_PRESS_TOOL_ID = WEB_LLM_EVIDENCE_TOOL_IDS[4];
export const WEB_LLM_ENTER_FIELD_TOOL_ID = WEB_LLM_EVIDENCE_TOOL_IDS[5];

/** An observation succeeded: evidence was captured and nothing on the page moved. */
export const WEB_LLM_INSPECT_RESULT_CODE = "web.inspect.succeeded" as const;
/** A tool that changes the page succeeded, and the evidence is from after the change. */
export const WEB_LLM_ACTION_RESULT_CODE = "web.action.succeeded" as const;
/** A repeating structure was detected and an extraction handle issued for it; nothing on the page moved. */
export const WEB_LLM_STRUCTURE_RESULT_CODE = "web.structure.detected" as const;

const REJECTION_RESULT_CODE_PREFIX = "web.action.rejected.";

export type WebLlmToolRejectionResultCode = `web.action.rejected.${WebLlmToolRejectionCode}`;

/** The result code a deliberate refusal reports. The only place the prefix is written. */
export function webLlmToolRejectionResultCode(code: WebLlmToolRejectionCode): WebLlmToolRejectionResultCode {
  return `${REJECTION_RESULT_CODE_PREFIX}${code}` as WebLlmToolRejectionResultCode;
}

export type WebLlmEvidenceResultCode =
  | typeof WEB_LLM_INSPECT_RESULT_CODE
  | typeof WEB_LLM_ACTION_RESULT_CODE
  | typeof WEB_LLM_STRUCTURE_RESULT_CODE
  | WebLlmToolRejectionResultCode;

/** Every result code a tool execution can carry: the three successes, and one per rejection. */
export const WEB_LLM_EVIDENCE_RESULT_CODES: readonly WebLlmEvidenceResultCode[] = Object.freeze([
  WEB_LLM_INSPECT_RESULT_CODE,
  WEB_LLM_ACTION_RESULT_CODE,
  WEB_LLM_STRUCTURE_RESULT_CODE,
  ...WEB_LLM_TOOL_REJECTION_CODES.map(webLlmToolRejectionResultCode)
]);
