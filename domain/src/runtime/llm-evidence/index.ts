// `web-llm-evidence.v2`: the secret-screened packet that is the only page data
// an LLM ever sees -- every element the capture sent, in document order,
// uncut (t200) -- the tools that produce it, and the check that keeps a target
// the model proposes inside what the model was actually shown.
//
// The surface is deliberate rather than a re-export of everything: the
// readers, the screens and the target-handle bindings are how the packet is
// built, not part of its contract, and a consumer that reached for them would
// be building a second packet shape by hand.

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
// What a published string says instead of itself when it is shaped like a
// credential, so a reader can tell a withheld string from the page's own.
export { WEB_LLM_WITHHELD_TEXT, screenedText as screenedWebLlmText } from "./withheld";
// A target handle as the domain spells it, `tN`, from either spelling a model
// may write: `tN` or the old `target.N`.
export { canonicalWebLlmTargetHandle } from "./handle-spelling";
// A URL as the packet spells one: query and fragment kept, secrets withheld.
export { screenedEvidenceUrl } from "./location";
// A name this domain read as something other than what was written, which a
// call reports on its execution result. Part of the contract rather than of the
// making of it: whoever carries the result onwards -- Core, and then a run
// bundle -- has to declare the same five members or the field is dropped at that
// boundary, which is the whole defect this shape exists to close.
export {
  MAX_WEB_LLM_NAME_ASSUMPTIONS,
  WEB_LLM_NAME_ASSUMPTION_HOWS,
  type WebLlmNameAssumption,
  type WebLlmNameAssumptionHow
} from "./name-assumption";
// Whether a click means something on an element: the packet carries every
// rendered element (t200), and a reader that wants the controls asks this.
export { actionableEvidenceElement, type ResolvedWebLlmEvidenceElement, type WebLlmEvidenceElement } from "./elements";
export type { WebLlmEvidenceBlocker, WebLlmEvidenceDialog, WebLlmEvidenceFrame, WebLlmEvidenceLoadingIndicator, WebLlmPageContext } from "./page-evidence";
// What stands in front of the page, marked on the element it is about rather
// than by moving it (t200, `./layers.ts`).
export type { WebLlmLayerMarks } from "./layer-marks";
// The page as a model reads it (t223): the compact view every page leaves the
// domain as, `web-llm-page.v3`, and the pieces it is written from.
export * from "./page-view";
// Searching the whole page: hidden, off-screen and text-less elements, and any attribute (t223).
export * from "./page-find";
export { screenWebBuildRefusalDiagnostic, type WebBuildRefusalDiagnostic } from "./refusal-diagnostic";
export {
  sanitizeWebLlmSnapshot,
  sanitizeWebLlmSnapshotWithBindings,
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
export { projectWebRepairCandidates, validateWebRuntimeTargetOverrideEvidence, type WebRepairCandidateMatch, type WebRepairCandidateProjection, type WebRepairCandidateRefusal } from "./target";
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
  WEB_LLM_FIND_ON_PAGE_TOOL_ID,
  WEB_LLM_DESCRIBE_ELEMENT_TOOL_ID,
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
