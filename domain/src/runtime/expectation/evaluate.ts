// Deciding whether an authored expected state holds, on the page itself.
//
// Core asks this question from two places -- the `builtin.policy.expectation`
// node and the transition comparison that follows a successful attempt -- and
// `context.source` says which. Both are answered the same way, because both ask
// the same thing: is the page in the state the Flow said it would be in.
//
// The judgement happens in the browser, not here. Each condition is dispatched
// as a `web.dom.assert` action, which is the verb that already knows how to
// wait for a claim, re-query a selector on every attempt, and report what it
// saw instead. Re-implementing `exists` or `visible` in the domain would mean a
// second definition of the same words, judged against a stale snapshot rather
// than against the live document.
//
// Three rules keep this honest:
//
//  - It never throws. `nodes/policy/expectation.ts` awaits the evaluator with
//    no catch of its own, so a throw here becomes a node execution error and a
//    false red. Everything is caught and reported as a verdict.
//  - A condition that could not be judged is not a condition that failed. An
//    unreadable shape, a client that never answered, a cancelled run: each is
//    left out of `checkedConditionCount` and cannot reject the expectation.
//    With nothing judged the verdict is Core's own default, an unconditional
//    pass, with a message saying so.
//  - A code is never written here. `STATE_MISMATCH` and `TIMEOUT` come from
//    `runtime/failure`, and a client that reported a code from that same closed
//    set keeps its own record: it stood nearest the page.

import type { OutputDispatchResult } from "fluxiq";
import type { AutomationNodeExpectationEvaluation, AutomationNodeExpectationEvaluationContext, AutomationStudioFailureRecord } from "fluxiq/automation-studio";
import type { JsonObject, JsonValue } from "fluxiq/core";
import { WEB_AUTOMATION_DOMAIN_ID } from "../../constants";
import { isWebAutomationFailureCode, WEB_AUTOMATION_FAILURE_CODES, webAutomationFailureRecord } from "../failure";
import {
  describeWebAutomationExpectationCondition,
  webAutomationExpectationActionPayload,
  webAutomationExpectationCondition,
  type WebAutomationExpectationCondition
} from "./conditions";

/** The one action this module dispatches, and the only way it reaches the page. */
const ASSERT_OUTPUT_ID = "web.dom.assert";

/** Names this evaluator in the client's action metadata, so a page-side trace says who asked. */
const EXPECTATION_SOURCE = "web-automation-expectation";

/** How the evaluator reaches the paired browser. The host runtime supplies the real one. */
export type WebAutomationExpectationDispatch = (request: {
  outputId: string;
  payload: JsonObject;
  metadata: JsonObject;
}) => Promise<OutputDispatchResult<JsonObject>>;

/** Core's `AutomationNodeExpectationEvaluator`, narrowed to the async form this module returns. */
export type WebAutomationExpectationEvaluator = (
  conditions: JsonValue[],
  mode: string,
  timeoutMs: number,
  context: AutomationNodeExpectationEvaluationContext
) => Promise<AutomationNodeExpectationEvaluation>;

/** What one condition turned out to be. `evaluated` is false when the page never answered for it. */
type ConditionOutcome = {
  description: string;
  evaluated: boolean;
  held: boolean;
  timedOut: boolean;
  failure?: AutomationStudioFailureRecord | undefined;
};

export function createWebAutomationExpectationEvaluator(dispatch: WebAutomationExpectationDispatch): WebAutomationExpectationEvaluator {
  return async (conditions, mode, timeoutMs, context) => {
    try {
      return await evaluateConditions(dispatch, conditions, mode, timeoutMs, context);
    } catch (error) {
      // Reaching here means the evaluator itself broke, not that the page is in
      // the wrong state. Rejecting on it would invent a failure the run did not
      // have, so it reports Core's default pass with nothing checked and says
      // why.
      return { passed: true, checkedConditionCount: 0, message: `The expected state could not be evaluated: ${errorText(error)}` };
    }
  };
}

async function evaluateConditions(
  dispatch: WebAutomationExpectationDispatch,
  conditions: JsonValue[],
  mode: string,
  timeoutMs: number,
  context: AutomationNodeExpectationEvaluationContext
): Promise<AutomationNodeExpectationEvaluation> {
  const outcomes: ConditionOutcome[] = [];
  for (let index = 0; index < conditions.length; index += 1) {
    // A cancelled run leaves the remaining conditions unjudged rather than
    // guessing at them; the count reports how far it got.
    if (context.signal?.aborted) break;
    const condition = webAutomationExpectationCondition(conditions[index] as JsonValue, timeoutMs);
    outcomes.push(condition
      ? await evaluateCondition(dispatch, condition, index, context)
      : { description: "a condition this domain cannot read", evaluated: false, held: false, timedOut: false });
  }
  return verdict(outcomes, mode);
}

async function evaluateCondition(
  dispatch: WebAutomationExpectationDispatch,
  condition: WebAutomationExpectationCondition,
  index: number,
  context: AutomationNodeExpectationEvaluationContext
): Promise<ConditionOutcome> {
  const description = describeWebAutomationExpectationCondition(condition);
  let result: OutputDispatchResult<JsonObject>;
  try {
    result = await dispatch({
      outputId: ASSERT_OUTPUT_ID,
      payload: webAutomationExpectationActionPayload(condition),
      metadata: conditionMetadata(index, context)
    });
  } catch {
    return { description, evaluated: false, held: false, timedOut: false };
  }
  if (result.status === "succeeded") return { description, evaluated: true, held: true, timedOut: false };
  // `failed` is the assert verb's answer for a claim that does not hold, and
  // `timed_out` is a wait that ran out. Every other status -- `cancelled`,
  // `unknown`, or none at all because the command never reached a client --
  // says nothing about the page, so it judges nothing.
  if (result.status !== "failed" && result.status !== "timed_out") {
    return { description, evaluated: false, held: false, timedOut: false };
  }
  const timedOut = result.status === "timed_out";
  return { description, evaluated: true, held: false, timedOut, failure: conditionFailure(condition, description, timedOut, result) };
}

/**
 * The record for a condition that did not hold. A client that already named a
 * code from the closed set keeps its own record, because it stood nearest the
 * page; anything else becomes `TIMEOUT` or `STATE_MISMATCH` built from the set.
 */
function conditionFailure(
  condition: WebAutomationExpectationCondition,
  description: string,
  timedOut: boolean,
  result: OutputDispatchResult<JsonObject>
): AutomationStudioFailureRecord {
  const reported = result.failure;
  if (reported && isWebAutomationFailureCode(reported.code)) return reported;
  const code = timedOut ? WEB_AUTOMATION_FAILURE_CODES.TIMEOUT : WEB_AUTOMATION_FAILURE_CODES.STATE_MISMATCH;
  const actual = reported?.actual
    ?? dispatchMessage(result.payload)
    ?? result.error
    ?? (timedOut ? `the wait for ${condition.assert.kind} ran out` : "the condition did not hold");
  return webAutomationFailureRecord(code, { expected: description, actual });
}

function verdict(outcomes: ConditionOutcome[], mode: string): AutomationNodeExpectationEvaluation {
  const evaluated = outcomes.filter((outcome) => outcome.evaluated);
  const unevaluated = outcomes.length - evaluated.length;
  if (evaluated.length === 0) {
    return {
      passed: true,
      checkedConditionCount: 0,
      message: outcomes.length === 0
        ? "The expected state named no conditions, so nothing was checked."
        : `None of the ${outcomes.length} expected condition${outcomes.length === 1 ? "" : "s"} could be checked against the page.`
    };
  }
  const rejected = evaluated.filter((outcome) => !outcome.held);
  const passed = mode === "any" ? rejected.length < evaluated.length : rejected.length === 0;
  if (passed) {
    return {
      passed: true,
      checkedConditionCount: evaluated.length,
      message: unevaluated === 0
        ? `${evaluated.length} expected condition${evaluated.length === 1 ? "" : "s"} held.`
        : `${evaluated.length} of ${outcomes.length} expected conditions held; ${unevaluated} could not be checked.`
    };
  }
  // A wait that ran out is the better name for what happened than a mismatch,
  // so it is preferred as the representative even when a plain rejection came
  // first.
  const representative = rejected.find((outcome) => outcome.timedOut) ?? rejected[0] as ConditionOutcome;
  return {
    passed: false,
    checkedConditionCount: evaluated.length,
    message: `${rejected.length} of ${evaluated.length} checked expected condition${evaluated.length === 1 ? "" : "s"} did not hold: ${representative.description}.`,
    failure: representative.failure ?? webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.STATE_MISMATCH, { expected: representative.description })
  };
}

function conditionMetadata(index: number, context: AutomationNodeExpectationEvaluationContext): JsonObject {
  return {
    source: EXPECTATION_SOURCE,
    domainId: WEB_AUTOMATION_DOMAIN_ID,
    expectationSource: context.source,
    conditionIndex: index,
    ...(context.nodeId === undefined ? {} : { nodeId: context.nodeId }),
    ...(context.attemptId === undefined ? {} : { attemptId: context.attemptId }),
    ...(context.stateRef === undefined ? {} : { stateRef: context.stateRef })
  };
}

/** The message the dispatcher wrapped around the client's action result. */
function dispatchMessage(payload: JsonObject | undefined): string | undefined {
  const message = payload?.message;
  return typeof message === "string" && message.length > 0 ? message : undefined;
}

function errorText(error: unknown): string {
  return error instanceof Error && error.message.length > 0 ? error.message : "the reason was not reported";
}
