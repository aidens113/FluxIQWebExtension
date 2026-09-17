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
import type { JsonObject, JsonValue } from "fluxiq/core";
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

// The unknown contract, which is what a recovery verdict reads.
//
// Core's evaluation carries a boolean and a count and has no third value, so
// "unknown" is `checkedConditionCount` falling short of the number of conditions
// handed in. A caller that requires evidence reads the shortfall and treats it
// as not resumable, so the one way this module can lie is to count a condition
// it did not judge. Every route that fails to judge one is proven here to leave
// the count short.

/** The shortfall a required-evidence caller reads: conditions asked minus conditions judged. */
function unknownCount(conditions: unknown[], evaluation: { checkedConditionCount?: number }): number {
  return conditions.length - (evaluation.checkedConditionCount ?? 0);
}

test("an absent claim naming no element is never dispatched and is reported as unknown, not as held", async () => {
  // Without the refusal this is the worst answer this module could give. The
  // content script re-queries a target that was never named, finds nothing, and
  // reports the claim held and judged -- so "the blocking banner is gone" would
  // come back yes, counted, with nothing looked at, and a recovery verdict would
  // resume deterministic execution on it.
  const conditions = [{ kind: "absent" }];
  const { dispatch, calls } = dispatcher([{ status: "succeeded" }]);
  const evaluation = await createWebAutomationExpectationEvaluator(dispatch)(conditions, "all", 0, transitionContext);
  assert.equal(calls.length, 0, "a claim the page cannot be asked is never put to it");
  assert.equal(evaluation.checkedConditionCount, 0);
  assert.equal(unknownCount(conditions, evaluation), 1);
  assert.equal(evaluation.failure, undefined, "it did not fail; it was not asked");
  assert.equal(evaluation.message, "None of the 1 expected condition could be checked against the page.");
});

test("every claim the page cannot be asked is unknown rather than held or rejected", async () => {
  const unaskable = [
    { kind: "absent" },
    { kind: "exists" },
    { kind: "visible" },
    { kind: "enabled" },
    { kind: "url" },
    { kind: "url", expected: "  " },
    { kind: "text", expected: "" },
    { kind: "text", selector: "#banner", expected: " " }
  ];
  for (const condition of unaskable) {
    const { dispatch, calls } = dispatcher([{ status: "succeeded" }]);
    const evaluation = await createWebAutomationExpectationEvaluator(dispatch)([condition], "all", 0, transitionContext);
    assert.equal(calls.length, 0, JSON.stringify(condition));
    assert.equal(evaluation.checkedConditionCount, 0, JSON.stringify(condition));
    assert.equal(evaluation.failure, undefined, JSON.stringify(condition));
  }
});

test("the two conditions a recovery verdict asks for are judged and counted when they can be", async () => {
  const conditions = [{ kind: "url", expected: "/order/confirmed" }, { selector: ".cookie-wall", assert: { kind: "absent" } }];
  const { dispatch, calls } = dispatcher([{ status: "succeeded" }, { status: "succeeded" }]);
  const evaluation = await createWebAutomationExpectationEvaluator(dispatch)(conditions, "all", 1_500, transitionContext);
  assert.equal(evaluation.passed, true);
  assert.equal(evaluation.checkedConditionCount, 2);
  assert.equal(unknownCount(conditions, evaluation), 0, "nothing unknown: the verdict may rely on this");
  assert.deepEqual(calls[0]?.payload, { assert: { kind: "url", expected: "/order/confirmed", timeoutMs: 1_500 } });
  assert.deepEqual(calls[1]?.payload, { selector: ".cookie-wall", assert: { kind: "absent", timeoutMs: 1_500 } });
});

test("a banner that recovery did not dismiss rejects, and is distinguishable from one nobody looked at", async () => {
  const dismissed = [{ selector: ".cookie-wall", assert: { kind: "absent" } }];
  const stillThere = await createWebAutomationExpectationEvaluator(dispatcher([{ status: "failed" }]).dispatch)(
    dismissed, "all", 0, transitionContext
  );
  assert.equal(stillThere.passed, false);
  assert.equal(stillThere.checkedConditionCount, 1);
  assert.equal(unknownCount(dismissed, stillThere), 0, "it was looked at; the answer is no");
  assert.equal(stillThere.failure?.code, WEB_AUTOMATION_FAILURE_CODES.STATE_MISMATCH);

  const neverLooked = await createWebAutomationExpectationEvaluator(dispatcher([{ status: "unknown" }]).dispatch)(
    dismissed, "all", 0, transitionContext
  );
  assert.equal(neverLooked.passed, true, "Core's default, which is why the count and not the boolean is read");
  assert.equal(unknownCount(dismissed, neverLooked), 1, "nobody looked, and the shortfall is the only thing that says so");
});

test("every route that fails to judge a condition leaves the count short of what was asked", async () => {
  const askable = { selector: "#done", assert: { kind: "exists" } };
  // The first two routes hand the dispatcher a second `succeeded` it must never
  // reach. Without it they would pass for the wrong reason: an unwanted dispatch
  // would run out of scripted answers, come back unrecognised, and go uncounted
  // anyway -- so the test would still be green with the guard deleted.
  const routes: Array<[string, Array<Partial<OutputDispatchResult<JsonObject>>>, JsonValue[]]> = [
    ["an unreadable shape", [{ status: "succeeded" }, { status: "succeeded" }], [askable, "a bare string"]],
    ["a claim the page cannot be asked", [{ status: "succeeded" }, { status: "succeeded" }], [askable, { kind: "absent" }]],
    ["a command that never reached a client", [{ status: "succeeded" }, { ok: false, error: "no client" }], [askable, askable]],
    ["a cancelled action", [{ status: "succeeded" }, { status: "cancelled" }], [askable, askable]],
    ["a status the domain does not read", [{ status: "succeeded" }, { status: "unknown" }], [askable, askable]]
  ];
  for (const [name, answers, conditions] of routes) {
    const evaluation = await createWebAutomationExpectationEvaluator(dispatcher(answers).dispatch)(conditions, "all", 0, transitionContext);
    assert.equal(evaluation.checkedConditionCount, 1, name);
    assert.equal(unknownCount(conditions, evaluation), 1, name);
  }
});

test("a rejection says how many conditions were never checked, rather than reporting a partial look as a whole one", async () => {
  const conditions = [{ selector: "#a", assert: { kind: "exists" } }, { kind: "absent" }, "a bare string"];
  // The second answer is one the refusal must stop this reaching: were the
  // unaskable `absent` dispatched, the page would report it held and the count
  // would say two conditions were checked.
  const evaluation = await createWebAutomationExpectationEvaluator(dispatcher([{ status: "failed" }, { status: "succeeded" }]).dispatch)(
    conditions, "all", 0, transitionContext
  );
  assert.equal(evaluation.passed, false);
  assert.equal(evaluation.checkedConditionCount, 1);
  assert.equal(unknownCount(conditions, evaluation), 2);
  assert.match(evaluation.message ?? "", /2 further conditions could not be checked\.$/u);
});

test("mode any cannot pass an expectation on conditions nobody judged", async () => {
  // `any` is the mode where a shortfall is easiest to miss: one condition held,
  // so the boolean is true. The count still reports that two were never asked.
  const conditions = [{ selector: "#a", assert: { kind: "exists" } }, { kind: "absent" }, { kind: "url" }];
  const answers = [{ status: "succeeded" }, { status: "succeeded" }, { status: "succeeded" }] as const;
  const evaluation = await createWebAutomationExpectationEvaluator(dispatcher([...answers]).dispatch)(
    conditions, "any", 0, transitionContext
  );
  assert.equal(evaluation.passed, true);
  assert.equal(unknownCount(conditions, evaluation), 2);
});
