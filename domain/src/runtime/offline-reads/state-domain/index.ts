// The web domain's port for Core's trace state rule.
export { webTraceStateDomain } from "./web-trace-state-domain";
export { WEB_TRACE_STATE_NORMALISATIONS, webTraceStateCanonicalKey, webTraceStateSiblingKey } from "./canonical-operation";
export { webTraceStateCallKind, webTraceStatePageMoveForm } from "./call-label";
export type { WebTraceStateCallKind } from "./call-label";
export { webTraceStateReadAnswer } from "./answer-reading";
export { webTraceStateIsOneTimeLayerAct } from "./one-time-layer";
export { webTraceStateHandleScope } from "./run-handles";
export { webTraceStateComputeRead, webTraceStateRecordedAnswerFits, webTraceStateUnansweredCall } from "./row-computer";
