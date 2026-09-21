// The UI end-to-end suite's assertions. Each one reads the rendered panel and
// Core together and returns a closed code with closed facts, never page text.

export { assertRuntimeDebugRun, type RuntimeDebugAssertion, type RuntimeDebugRefreshWatch, watchRuntimeDebugRefresh } from "./runtime-debug.js";
export { type ActionLogFacts, type RefreshFacts, type RunRowFacts, RUNTIME_DEBUG_CODES, type RuntimeDebugCode, type RuntimeDebugStatus } from "./runtime-debug-facts.js";
export { type AdaptationChangesAssertion, type AdaptationCoreReader, type AdaptationHistoryAssertion, type AdaptationReviewAssertion, assertAdaptationChanges, assertAdaptationHistory, reviewAdaptationViaUi, selectAdaptation } from "./adaptations.js";
export { ADAPTATION_UI_CODES, type AdaptationReviewAction, type AdaptationReviewFacts, type AdaptationStatus, type AdaptationUiCode } from "./adaptation-facts.js";
