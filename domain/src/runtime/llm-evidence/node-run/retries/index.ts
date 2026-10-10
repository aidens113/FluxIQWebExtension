// A node a build runs against the live page -- exploring, or replaying its draft
// in a test -- under Core's default retries (t355): the dispatch, the look
// again before a decision taken on one look, and how a lasting act whose
// outcome Core left uncertain is told (t361), or checked first against the
// node's declared expected state (plan B3).
export { webNodeDispatchWithRetries, type WebNodeDispatchResult, type WebNodeRetriedDispatch } from "./dispatch";
export { webNodeEffectCheck } from "./effect-check";
export { webNodeLookUntilPresent } from "./look";
export { webNodeFailureRefusal } from "./uncertain-outcome";
