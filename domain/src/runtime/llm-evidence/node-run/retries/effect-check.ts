// Whether a lasting act whose acknowledgement was lost took effect after all
// (plan B3, Core C8), asked by Core's retries before it would make the act
// again (`./dispatch.ts`). Until this file the build's exploration and its test
// replays passed no check, so every such act ended `uncertain` on both paths.
//
// The answer comes from the node's own declared expected state
// (`parameters.expectedState`, `output-nodes/definitions.ts`), judged on the
// live page by the domain's existing evaluator (`../../../expectation/`) -- the
// one a saved Flow's transition comparison uses, through the build's own
// gateway. It waits for each claim within its window, which is the right
// question here: "did the page get there", not "is it there this instant", so a
// slow page is not read as an act that did not happen and pressed twice.
//
// Three answers, and `unknown` is the honest default:
//
//  - `landed`: every condition was judged and held (`mode: "any"`: one held).
//  - `not_landed`: a judged condition did not hold (`any`: every one was judged
//    and none held). Only a page that answered says so.
//  - `unknown`: no expected state, nothing in it the page could be asked, a
//    page that never answered, or held conditions beside ones nobody judged. A
//    missing acknowledgement is never read as "did not happen".

import type { AutomationNodeExpectationEvaluation, AutomationStudioLastingActCheck } from "fluxiq/automation-studio";
import type { JsonObject, JsonValue } from "fluxiq/core";
import type { OutputDispatchResult } from "fluxiq";
import { createWebAutomationExpectationEvaluator } from "../../../expectation";
import { present } from "../../present";
import { isJsonRecord } from "../../untrusted-json";
import type { WebNodeRun } from "../context";
import type { WebNodeDispatchResult } from "./dispatch";

/** The window a declared expected state gets when it names none: a web node's own default timeout. */
const DEFAULT_EXPECTATION_TIMEOUT_MS = 5_000;

/** The statuses a judged claim can come back with; every other one says nothing about the page. */
const JUDGED_STATUSES: ReadonlySet<string> = new Set(["succeeded", "failed", "timed_out"]);

/** The check Core asks of an uncertain act this node made, from the parameters it ran with. */
export function webNodeEffectCheck(
  run: Pick<WebNodeRun, "gateway" | "sessionId" | "request">,
  parameters: JsonObject
): AutomationStudioLastingActCheck<WebNodeDispatchResult> {
  return async () => {
    const expected = declaredExpectation(parameters.expectedState);
    if (expected === undefined) return "unknown";
    const evaluate = createWebAutomationExpectationEvaluator(async (request) =>
      dispatchResult(request.outputId, await run.gateway.executeAction(run.sessionId, { actionType: request.outputId, parameters: request.payload, metadata: request.metadata })));
    const signal = run.request.signal;
    const verdict = await evaluate(expected.conditions, expected.mode, expected.timeoutMs, signal === undefined ? { source: "transition_comparison" } : { source: "transition_comparison", signal });
    return landing(verdict, expected.conditions.length, expected.mode);
  };
}

type DeclaredExpectation = { conditions: JsonValue[]; mode: "all" | "any"; timeoutMs: number };

/** The node's expected state, when it declares at least one condition. Read field by field: the model wrote it. */
function declaredExpectation(value: JsonValue | undefined): DeclaredExpectation | undefined {
  if (!isJsonRecord(value) || !Array.isArray(value.conditions) || value.conditions.length === 0) return undefined;
  const timeoutMs = typeof value.timeoutMs === "number" && Number.isFinite(value.timeoutMs) && value.timeoutMs > 0 ? value.timeoutMs : DEFAULT_EXPECTATION_TIMEOUT_MS;
  return { conditions: value.conditions, mode: value.mode === "any" ? "any" : "all", timeoutMs };
}

/**
 * The verdict read by the evaluator's count contract (`expectation/evaluate.ts`):
 * judged conditions are the count, the rest are unknown, and `passed` speaks
 * only of the judged ones.
 */
function landing(verdict: AutomationNodeExpectationEvaluation, total: number, mode: "all" | "any"): "landed" | "not_landed" | "unknown" {
  const judged = verdict.checkedConditionCount ?? 0;
  if (judged === 0) return "unknown";
  if (mode === "any") {
    if (verdict.passed) return "landed";
    return judged === total ? "not_landed" : "unknown";
  }
  if (!verdict.passed) return "not_landed";
  return judged === total ? "landed" : "unknown";
}

/** The gateway's answer as the evaluator reads a dispatch: by its status alone. */
function dispatchResult(outputId: string, result: WebNodeDispatchResult): OutputDispatchResult<JsonObject> {
  const status = JUDGED_STATUSES.has(result.status) ? result.status as "succeeded" | "failed" | "timed_out" : "unknown";
  return present<OutputDispatchResult<JsonObject>>({
    ok: status === "succeeded",
    outputId,
    status,
    payload: result.payload,
    error: result.error,
    domainId: undefined,
    failure: undefined,
    clearedWait: undefined,
    metadata: undefined
  });
}
