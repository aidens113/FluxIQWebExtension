// What changed between two web state summaries, in the page view's own lines (t223),
// and where the step's control sat and which items its page listed (t609).

export { WEB_STATE_DIFF_SCHEMA_VERSION } from "./schema-version";
export { webAutomationStateDiff } from "./state-diff";
export { webStateSummaryLines, type WebStateSummaryLines } from "./summary-lines";
export { createWebStatePlacesMemo, webStateDiffPlaces, webStateSnapshotPlaces, webStateValueReplacements, type WebStatePlacesMemo, type WebStateSnapshotPlaces } from "./places";
