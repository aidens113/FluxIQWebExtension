// The closed sets this module puts on the wire: the evidence tool ids it
// offers, and the result codes it emits. Both exist as runtime values, not
// only as types, because a consumer outside this package has to enumerate them
// -- `packages/test-runner` filters its sanitized diagnostic by exactly these
// sets, and while they were hand-maintained both halves drifted: the tool
// allowlist omitted `web.reveal_safe`, so every reveal step was silently
// dropped, and the result-code list omitted `web.action.rejected.no_progress`.
//
// Each vocabulary type is now derived from its value rather than declared
// beside it, so the set is exhaustive by construction and a code that is added
// here cannot fail to appear in the set a consumer derives.

import { WEB_LLM_TOOL_REJECTION_CODES, type WebLlmToolRejectionCode } from "./tool-rejection";

/** Every tool `createWebAutomationLlmEvidenceRuntime` offers, in the order it offers them. */
export const WEB_LLM_EVIDENCE_TOOL_IDS = ["web.inspect_current_page", "web.navigate_same_origin", "web.reveal_safe"] as const;

export type WebLlmEvidenceToolId = (typeof WEB_LLM_EVIDENCE_TOOL_IDS)[number];

export const WEB_LLM_INSPECT_TOOL_ID = WEB_LLM_EVIDENCE_TOOL_IDS[0];
export const WEB_LLM_NAVIGATE_TOOL_ID = WEB_LLM_EVIDENCE_TOOL_IDS[1];
export const WEB_LLM_REVEAL_TOOL_ID = WEB_LLM_EVIDENCE_TOOL_IDS[2];

/** An observation succeeded: evidence was captured and nothing on the page moved. */
export const WEB_LLM_INSPECT_RESULT_CODE = "web.inspect.succeeded" as const;
/** A tool that changes the page succeeded, and the evidence is from after the change. */
export const WEB_LLM_ACTION_RESULT_CODE = "web.action.succeeded" as const;

const REJECTION_RESULT_CODE_PREFIX = "web.action.rejected.";

export type WebLlmToolRejectionResultCode = `web.action.rejected.${WebLlmToolRejectionCode}`;

/** The result code a deliberate refusal reports. The only place the prefix is written. */
export function webLlmToolRejectionResultCode(code: WebLlmToolRejectionCode): WebLlmToolRejectionResultCode {
  return `${REJECTION_RESULT_CODE_PREFIX}${code}` as WebLlmToolRejectionResultCode;
}

export type WebLlmEvidenceResultCode =
  | typeof WEB_LLM_INSPECT_RESULT_CODE
  | typeof WEB_LLM_ACTION_RESULT_CODE
  | WebLlmToolRejectionResultCode;

/** Every result code a tool execution can carry: the two successes, and one per rejection. */
export const WEB_LLM_EVIDENCE_RESULT_CODES: readonly WebLlmEvidenceResultCode[] = Object.freeze([
  WEB_LLM_INSPECT_RESULT_CODE,
  WEB_LLM_ACTION_RESULT_CODE,
  ...WEB_LLM_TOOL_REJECTION_CODES.map(webLlmToolRejectionResultCode)
]);
