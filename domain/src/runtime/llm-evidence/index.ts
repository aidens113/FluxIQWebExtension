// `web-llm-evidence.v2`: the bounded, value-free packet that is the only page
// data an LLM ever sees, the three tools that produce it, and the check that
// keeps a target the model proposes inside what the model was actually shown.
//
// The surface is deliberate rather than a re-export of everything: the bounded
// readers, the trim ladder and the target-handle bindings are how the packet
// is built, not part of its contract, and a consumer that reached for them
// would be building a second packet shape by hand.

export type {
  WebLlmEvidenceGateway,
  WebLlmEvidenceToolExecution,
  WebLlmEvidenceToolRequest
} from "./capture";
export * from "./harness-options";
export { WEB_LLM_EVIDENCE_BOUNDS, WEB_LLM_EVIDENCE_BYTE_BUDGETS } from "./limits";
export type { ResolvedWebLlmEvidenceElement, WebLlmEvidenceElement } from "./elements";
export type { WebLlmEvidenceDialog, WebLlmEvidenceFrame, WebLlmPageContext } from "./page-evidence";
export {
  sanitizeWebLlmSnapshot,
  WEB_LLM_EVIDENCE_SCHEMA_VERSION,
  type WebLlmPageEvidence,
  type WebLlmSanitizeOptions,
  type WebLlmSnapshotBinding
} from "./sanitize";
export {
  elementFillsRepairableParameter,
  webRepairableParameterFor,
  webRepairableParameters,
  WEB_REPAIRABLE_ELEMENT_PARAMETER,
  WEB_REPAIRABLE_FIELD_PARAMETER_PREFIX,
  WEB_REPAIRABLE_ITEM_PARAMETER,
  type WebRepairableParameter,
  type WebRepairableParameterRole
} from "./repairable-parameters";
export {
  WEB_PLAN_HANDLE_ISSUE_CODES,
  type WebPlanHandleIssueCode,
  type WebPlanNodeResolution,
  type WebPlanNodeResolutionInput
} from "./plan-resolution";
export {
  RETAINED_EXTRACTION_HANDLES,
  WEB_LLM_EXTRACTION_HANDLE_PATTERN,
  WEB_LLM_STRUCTURE_PAGINATION_MODES,
  WEB_LLM_STRUCTURE_SCHEMA_VERSION,
  type WebLlmExtractionBinding,
  type WebLlmExtractionHandleResolution,
  type WebLlmExtractionHandleScope,
  type WebLlmRepeatingStructure,
  type WebLlmStructureField,
  type WebLlmStructurePaginationMode
} from "./structure";
export { validateWebRuntimeTargetOverrideEvidence } from "./target-override";
export {
  WEB_LLM_TOOL_REJECTION_CODES,
  WEB_LLM_TOOL_RESULT_SCHEMA_VERSION,
  type WebLlmToolRejection,
  type WebLlmToolRejectionCode
} from "./tool-rejection";
export {
  webLlmToolRejectionResultCode,
  WEB_LLM_ACTION_RESULT_CODE,
  WEB_LLM_EVIDENCE_RESULT_CODES,
  WEB_LLM_EVIDENCE_TOOL_IDS,
  WEB_LLM_INSPECT_RESULT_CODE,
  WEB_LLM_INSPECT_TOOL_ID,
  WEB_LLM_NAVIGATE_TOOL_ID,
  WEB_LLM_REVEAL_TOOL_ID,
  WEB_LLM_DETECT_STRUCTURE_TOOL_ID,
  WEB_LLM_STRUCTURE_RESULT_CODE,
  type WebLlmEvidenceResultCode,
  type WebLlmEvidenceToolId,
  type WebLlmToolRejectionResultCode
} from "./vocabulary";
export {
  bindWebAutomationLlmEvidenceRuntime,
  createWebAutomationLlmEvidenceRuntime,
  type WebAutomationLlmEvidenceRuntime,
  type WebLlmFailureEvidenceRequest
} from "./tools";
