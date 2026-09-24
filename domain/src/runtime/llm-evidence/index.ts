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
// The declaration itself, not the machinery that applies it. Anything that
// projects this domain's data for someone else to read has to be held to the
// same list, and `denied-keys.ts` says why there must be exactly one copy of
// it. The Lab's created-Flow snapshot is the third such reader: it screens a
// built Flow's authored node parameters before writing them into a run bundle
// (`packages/test-runner/src/flow-lane/creation/parameter-screen.ts`), and a
// second, drifting copy of this list there is precisely the failure the single
// declaration exists to prevent.
export { WEB_LLM_DENIED_EVIDENCE_KEYS, webLlmEvidenceKey } from "./denied-keys";
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
export { webLlmStateDigest } from "./state-digest";
export { projectWebRepairCandidates, validateWebRuntimeTargetOverrideEvidence, WEB_REPAIR_CANDIDATE_LIMIT, type WebRepairCandidateMatch, type WebRepairCandidateProjection, type WebRepairCandidateRefusal } from "./target";
export {
  WEB_LLM_TOOL_REJECTION_CODES,
  WEB_LLM_TOOL_REJECTION_REASONS,
  WEB_LLM_TOOL_RESULT_SCHEMA_VERSION,
  type WebLlmToolRejection,
  type WebLlmToolRejectionCode,
  type WebLlmToolRejectionDetail,
  type WebLlmToolRejectionReason
} from "./tool-rejection";
export { webRunnableNode, webRunnableNodeIds, type WebRunnableNode } from "./node-run";
export {
  webLlmToolRejectionResultCode,
  WEB_LLM_ACTION_RESULT_CODE,
  WEB_LLM_EVIDENCE_RESULT_CODES,
  WEB_LLM_EVIDENCE_TOOL_IDS,
  WEB_LLM_INSPECT_RESULT_CODE,
  WEB_LLM_INSPECT_TOOL_ID,
  WEB_LLM_NAVIGATE_TOOL_ID,
  WEB_LLM_PRESS_TOOL_ID,
  WEB_LLM_DETECT_STRUCTURE_TOOL_ID,
  WEB_LLM_ENTER_FIELD_TOOL_ID,
  WEB_LLM_RUN_NODE_TOOL_ID,
  WEB_LLM_STRUCTURE_RESULT_CODE,
  type WebLlmEvidenceResultCode,
  type WebLlmEvidenceToolId,
  type WebLlmToolRejectionResultCode
} from "./vocabulary";
export {
  bindWebAutomationLlmEvidenceRuntime,
  createWebAutomationLlmEvidenceRuntime,
  type WebAutomationLlmEvidenceRuntime,
  type WebLlmFailureEvidenceRequest,
  type WebLlmStateDigestRequest
} from "./tools";
