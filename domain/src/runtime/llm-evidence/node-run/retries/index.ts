// A node a build runs against the live page -- exploring, or replaying its draft
// in a test -- under Core's default retries (t355): the dispatch, the look
// again before a decision taken on one look, and how a lasting act whose
// outcome Core left uncertain is told (t361), or checked first against the
// node's declared expected state (plan B3); and a stale target found again by
// its identity (t786).
export { webNodeRetriedAnswer } from "./answer";
export { webNodeDispatchWithRetries, type WebNodeDispatchResult, type WebNodeRetriedDispatch } from "./dispatch";
export { webNodeEffectCheck } from "./effect-check";
export { webNodeLookUntilPresent } from "./look";
// A stale target found again, once, before the last retries (t786).
export { webNodeLookedUpReacquire } from "./looked-up-reacquire";
export { webNodeScopedReacquire } from "./scoped-look";
export { webNodeRetryReacquire, type WebNodeReacquire, type WebNodeReacquired } from "./reacquire";
export { webNodeReplayRowReacquire } from "./replay-row-reacquire";
export { webNodeReplayedReads, type WebNodeReplayedRead, type WebNodeReplayedReads } from "./replayed-reads";
export { webNodeFailureRefusal } from "./uncertain-outcome";
