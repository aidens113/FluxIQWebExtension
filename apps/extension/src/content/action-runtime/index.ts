// The page-side half of action execution. `actions/` decides what each action
// type does; this directory supplies the capabilities it needs -- finding the
// target, judging whether it can be acted on, typing, waiting, reading values,
// and shaping the result the background worker receives.

export { captureSnapshotForResponse } from "./capture-snapshot-for-response";
export { executeAction } from "./execute-action";
export { actionFailure } from "./results";

export type { ActionResultEvidence } from "./results";
export type { ActionabilityRejectionCode, ActionabilityReport } from "./actionability";
export type { AssertionOutcome, AssertionTarget } from "./assertion-evaluation";
export type { CheckableStateOutcome } from "./checkable-state";
export type { DialogControl, ObservedDialog } from "./dialog-control";
export type { FileInputOutcome } from "./file-input";
export type { KeyboardCapability, KeyPressOutcome } from "./keyboard";
export type { ExtractedListRecord, ListExtractionOutcome } from "./list-extraction";
export type { WaitConditionOutcome, WaitConditionRequest } from "./wait-conditions";
