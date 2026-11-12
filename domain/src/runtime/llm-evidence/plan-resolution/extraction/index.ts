// Resolving an extraction node's list: the `extractList` slot a model wrote,
// the detected columns it keeps, and the conditions that say which of the
// list's items are records.
//
// `slot.ts` is the whole of what a caller needs; `columns.ts` and
// `conditions.ts` are what it is made of, and are its own to reach. The
// exceptions are the assumption a resolved slot reports, which is part of the
// answer rather than part of the making of it, and the condition reader itself,
// which a reader of a recorded build calls to read a `where` clause exactly as
// the build read it (the test runner's offline-trial experiment, trace plan P5).

export { type WebExtractionColumnAssumption } from "./columns";
export { keptWebExtractionConditions, type WebExtractionConditionColumns, type WebExtractionConditions } from "./conditions";
export { resolveWebExtractionSlot, type WebExtractionSlotIssue, type WebExtractionSlotResolution } from "./slot";
export { webPlanSlotRefusal, type WebPlanSlotRefusal } from "./slot-refusal";
// What a saved read holds of its list, so it needs no handle in memory (t869).
export { WEB_PLAN_EXTRACTION_BINDING_KEY, webPlanWithExtractionBinding } from "./saved-list";
// One element named by its own handle, read as a one-row table (t903).
export { webPlanElementRecord, type WebPlanBoundRecordElement, type WebPlanElementRecord } from "./element-record";
// The step's record output read as its dispatch reads it (t489).
export { webPlanStoredColumns, webPlanUndispatchable, type WebPlanUndispatchable } from "./stored-columns";
// The record output the step saves: the one its dispatch runs (t510).
export { webPlanRunRecordOutput } from "./run-record-output";
// What a refusal says beside its codes: the field and the names it can use (t489, t497).
export { type WebPlanRefusalIssue } from "./refusal-issues";
