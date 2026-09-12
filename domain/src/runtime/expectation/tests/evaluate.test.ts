// The expectation verdict, and what Core does with it.
//
// The important proofs here are the ones about not lying. A rejected condition
// must reject with a code from the closed set and must route `failed` through
// Core's own expectation node; a condition nobody could judge must not reject,
// must not be counted, and must not throw into Core, whose policy node awaits
// the evaluator with no catch of its own.

import assert from "node:assert/strict";
import test from "node:test";
import type { OutputDispatchResult } from "fluxiq";
import { getAutomationNodeDefinition, parseAutomationStudioFailureRecord } from "fluxiq/automation-studio";
import type { JsonObject } from "fluxiq/core";
import { WEB_AUTOMATION_FAILURE_CODES } from "../../failure";
import { createWebAutomationExpectationEvaluator, type WebAutomationExpectationDispatch } from "../evaluate";

type DispatchCall = { outputId: string; payload: JsonObject; metadata: JsonObject };

function dispatcher(answers: Array<Partial<OutputDispatchResult<JsonObject>>>): { dispatch: WebAutomationExpectationDispatch; calls: DispatchCall[] } {
  const calls: DispatchCall[] = [];
  const dispatch: WebAutomationExpectationDispatch = async (request) => {
    calls.push(request);
    const answer = answers[calls.length - 1] ?? { ok: false };
    return { outputId: request.outputId, ok: answer.status === "succeeded", ...answer } as OutputDispatchResult<JsonObject>;
  };
  return { dispatch, calls };
}

const transitionContext = { source: "transition_comparison" } as const;
const policyContext = { source: "policy_node" } as const;

test("a condition that holds passes and is counted", async () => {
  const { dispatch, calls } = dispatcher([{ status: "succeeded" }]);
  const evaluation = await createWebAutomationExpectationEvaluator(dispatch)(
    [{ kind: "exists", selector: "#done" }], "all", 0, transitionContext
  );
  assert.equal(evaluation.passed, true);
  assert.equal(evaluation.checkedConditionCount, 1);
  assert.equal(evaluation.failure, undefined);
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.outputId, "web.dom.assert");
  assert.deepEqual(calls[0]?.payload, { selector: "#done", assert: { kind: "exists", timeoutMs: 1 } });
  assert.equal(calls[0]?.metadata.expectationSource, "transition_comparison");
  assert.equal(calls[0]?.metadata.conditionIndex, 0);
});

test("a rejected condition fails with STATE_MISMATCH and a record Core's parser keeps", async () => {
  const { dispatch } = dispatcher([{ status: "failed", payload: { status: "failed", message: "Assertion did not hold: text." } }]);
  const evaluation = await createWebAutomationExpectationEvaluator(dispatch)(
    [{ kind: "text", expected: "Order placed", selector: "#banner" }], "all", 0, transitionContext
  );
  assert.equal(evaluation.passed, false);
  assert.equal(evaluation.checkedConditionCount, 1);
  assert.equal(evaluation.failure?.code, WEB_AUTOMATION_FAILURE_CODES.STATE_MISMATCH);
  assert.equal(evaluation.failure?.category, "unexpected_state");
  assert.equal(evaluation.failure?.stage, "verification");
  assert.equal(evaluation.failure?.expected, '"#banner" contains "Order placed"');
  assert.equal(evaluation.failure?.actual, "Assertion did not hold: text.");
  assert.deepEqual(parseAutomationStudioFailureRecord(evaluation.failure), evaluation.failure);
});

test("a wait that ran out fails with TIMEOUT rather than a mismatch, even behind an earlier rejection", async () => {
  const { dispatch } = dispatcher([{ status: "failed" }, { status: "timed_out" }]);
  const evaluation = await createWebAutomationExpectationEvaluator(dispatch)(
    [{ kind: "exists", selector: "#a" }, { kind: "visible", selector: "#b", timeoutMs: 250 }], "all", 0, transitionContext
  );
  assert.equal(evaluation.passed, false);
  assert.equal(evaluation.checkedConditionCount, 2);
  assert.equal(evaluation.failure?.code, WEB_AUTOMATION_FAILURE_CODES.TIMEOUT);
  assert.equal(evaluation.failure?.category, "timeout");
  assert.equal(evaluation.failure?.expected, '"#b" is visible');
});

test("a client that named a code from the closed set keeps its own record", async () => {
  const reported = { category: "blocked_by_capability_or_policy", code: WEB_AUTOMATION_FAILURE_CODES.ACTION_REJECTED, retryable: false, stage: "execution" } as const;
  const { dispatch } = dispatcher([{ status: "failed", failure: reported }]);
  const evaluation = await createWebAutomationExpectationEvaluator(dispatch)(
    [{ kind: "enabled", selector: "#save" }], "all", 0, transitionContext
  );
  assert.deepEqual(evaluation.failure, reported);
});

test("a client code outside the closed set is replaced rather than passed through", async () => {
  // What the assert verb produces today: `web.assert.<kind>`, which is not in
  // the closed set and would put a second vocabulary on the wire.
  const { dispatch } = dispatcher([{
    status: "failed",
    failure: { category: "expected_state_missing", code: "web.assert.text", retryable: true, stage: "verification", expected: "the page says Done", actual: "the page reads Pending" }
  }]);
  const evaluation = await createWebAutomationExpectationEvaluator(dispatch)(
    [{ kind: "text", expected: "Done" }], "all", 0, transitionContext
  );
  assert.equal(evaluation.failure?.code, WEB_AUTOMATION_FAILURE_CODES.STATE_MISMATCH);
  assert.equal(evaluation.failure?.actual, "the page reads Pending");
});

test("mode any passes when one condition holds; mode all does not", async () => {
  const conditions = [{ kind: "exists", selector: "#a" }, { kind: "exists", selector: "#b" }];
  const any = await createWebAutomationExpectationEvaluator(dispatcher([{ status: "failed" }, { status: "succeeded" }]).dispatch)(
    conditions, "any", 0, transitionContext
  );
  assert.equal(any.passed, true);
  assert.equal(any.checkedConditionCount, 2);
  const all = await createWebAutomationExpectationEvaluator(dispatcher([{ status: "failed" }, { status: "succeeded" }]).dispatch)(
    conditions, "all", 0, transitionContext
  );
  assert.equal(all.passed, false);
  assert.equal(all.checkedConditionCount, 2);
});

test("an unevaluatable condition is not counted, does not reject, and does not throw", async () => {
  const { dispatch, calls } = dispatcher([]);
  const evaluation = await createWebAutomationExpectationEvaluator(dispatch)(
    [{ kind: "contains", selector: "#a" }, "a bare string", null], "all", 0, transitionContext
  );
  assert.equal(evaluation.passed, true);
  assert.equal(evaluation.checkedConditionCount, 0);
  assert.equal(evaluation.failure, undefined);
  assert.equal(evaluation.message, "None of the 3 expected conditions could be checked against the page.");
  assert.equal(calls.length, 0, "an unreadable condition is never dispatched");
});

test("a command that never reached a client judges nothing rather than rejecting", async () => {
  for (const answer of [{ ok: false, error: "A single paired web-automation client must be selected." }, { status: "cancelled" }, { status: "unknown" }] as const) {
    const evaluation = await createWebAutomationExpectationEvaluator(dispatcher([answer]).dispatch)(
      [{ kind: "exists", selector: "#a" }], "all", 0, transitionContext
    );
    assert.equal(evaluation.passed, true, JSON.stringify(answer));
    assert.equal(evaluation.checkedConditionCount, 0, JSON.stringify(answer));
  }
});

test("a dispatch that throws is caught and reported as unjudged", async () => {
  const dispatch: WebAutomationExpectationDispatch = async () => { throw new Error("gateway is gone"); };
  const evaluation = await createWebAutomationExpectationEvaluator(dispatch)(
    [{ kind: "exists", selector: "#a" }], "all", 0, transitionContext
  );
  assert.equal(evaluation.passed, true);
  assert.equal(evaluation.checkedConditionCount, 0);
});

test("an empty condition list keeps Core's unconditional pass", async () => {
  const evaluation = await createWebAutomationExpectationEvaluator(dispatcher([]).dispatch)([], "all", 0, transitionContext);
  assert.deepEqual(evaluation, { passed: true, checkedConditionCount: 0, message: "The expected state named no conditions, so nothing was checked." });
});

test("a cancelled run stops asking and reports how far it got", async () => {
  const controller = new AbortController();
  const { dispatch, calls } = dispatcher([{ status: "succeeded" }]);
  const evaluate = createWebAutomationExpectationEvaluator(async (request) => {
    const result = await dispatch(request);
    controller.abort();
    return result;
  });
  const evaluation = await evaluate(
    [{ kind: "exists", selector: "#a" }, { kind: "exists", selector: "#b" }],
    "all",
    0,
    { source: "transition_comparison", signal: controller.signal }
  );
  assert.equal(calls.length, 1);
  assert.equal(evaluation.checkedConditionCount, 1);
  assert.equal(evaluation.passed, true);
});

test("both sources are evaluated the same way", async () => {
  const conditions = [{ kind: "url", expected: "/thanks" }];
  const policy = await createWebAutomationExpectationEvaluator(dispatcher([{ status: "failed" }]).dispatch)(conditions, "all", 1_000, policyContext);
  const transition = await createWebAutomationExpectationEvaluator(dispatcher([{ status: "failed" }]).dispatch)(conditions, "all", 1_000, transitionContext);
  assert.deepEqual({ ...policy, message: "" }, { ...transition, message: "" });
});

test("Core's expectation node routes failed on a rejected verdict and passed on an accepted one", async () => {
  const definition = getAutomationNodeDefinition("builtin.policy.expectation");
  assert.ok(definition?.execute, "Core must still register builtin.policy.expectation");
  const parameters = { conditions: [{ kind: "exists", selector: "#done" }], mode: "all", timeoutMs: 250 };

  const rejected = await definition.execute({
    inputs: {},
    parameters,
    expectationEvaluator: createWebAutomationExpectationEvaluator(dispatcher([{ status: "failed" }]).dispatch)
  });
  assert.equal(rejected.route, "failed");
  assert.equal(rejected.status, "failed");
  assert.equal(rejected.failure?.code, WEB_AUTOMATION_FAILURE_CODES.STATE_MISMATCH);

  const accepted = await definition.execute({
    inputs: {},
    parameters,
    expectationEvaluator: createWebAutomationExpectationEvaluator(dispatcher([{ status: "succeeded" }]).dispatch)
  });
  assert.equal(accepted.route, "passed");
  assert.equal(accepted.status, "success");
});
