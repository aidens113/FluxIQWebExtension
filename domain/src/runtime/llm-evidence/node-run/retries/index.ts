// A node a build runs against the live page -- exploring, or replaying its draft
// in a test -- under Core's default retries (t355): the dispatch, and the look
// again before a decision taken on one look.
export { webNodeDispatchWithRetries, type WebNodeDispatchResult, type WebNodeRetriedDispatch } from "./dispatch";
export { webNodeLookUntilPresent } from "./look";
