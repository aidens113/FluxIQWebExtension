// The web domain's half of Core's trace state rule (`ClientGatewayTraceStateDomain`):
// what a call does, what makes two calls the same, how to read an answer, and which
// reads can be computed from recorded rows. Not wired into any live path: only the
// harness and the experiment in `packages/test-runner` use it.

import type { ClientGatewayTraceStateDomain } from "fluxiq/client-gateway";
import { webTraceStateReadAnswer } from "./answer-reading";
import { webTraceStateCallKind, webTraceStatePageMoveForm } from "./call-label";
import { WEB_TRACE_STATE_NORMALISATIONS, webTraceStateCanonicalKey, webTraceStateSiblingKey } from "./canonical-operation";
import { webTraceStateIsOneTimeLayerAct } from "./one-time-layer";
import { webTraceStateComputeRead, webTraceStateRecordedAnswerFits, webTraceStateUnansweredCall } from "./row-computer";
import { webTraceStateHandleScope } from "./run-handles";

export const webTraceStateDomain: ClientGatewayTraceStateDomain = Object.freeze({
  normalisations: WEB_TRACE_STATE_NORMALISATIONS,
  labelCall: (operation) => webTraceStateCallKind(operation.actionType),
  pageMoveForm: (operation) => webTraceStatePageMoveForm(operation.actionType),
  canonicalKey: webTraceStateCanonicalKey,
  siblingKey: webTraceStateSiblingKey,
  waitMs: (operation) => {
    const parameters = operation.compared.parameters;
    if (typeof parameters !== "object" || parameters === null || Array.isArray(parameters)) return null;
    const { timeoutMs } = parameters as { readonly timeoutMs?: unknown };
    return typeof timeoutMs === "number" ? timeoutMs : null;
  },
  readAnswer: webTraceStateReadAnswer,
  isOneTimeLayerAct: webTraceStateIsOneTimeLayerAct,
  handleScope: webTraceStateHandleScope,
  unansweredCall: webTraceStateUnansweredCall,
  computeRead: webTraceStateComputeRead,
  recordedAnswerFits: webTraceStateRecordedAnswerFits
});
