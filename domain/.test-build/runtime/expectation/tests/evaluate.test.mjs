// src/runtime/expectation/tests/evaluate.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { getAutomationNodeDefinition, parseAutomationStudioFailureRecord } from "fluxiq/automation-studio";

// src/actions/types.ts
var WEB_AUTOMATION_VALIDATION_TEXT_MAX_LENGTH = 1024;

// src/runtime/failure/codes.ts
var WEB_AUTOMATION_FAILURE_CODES = Object.freeze({
  /** The target was found but refused the action: disabled, hidden, or covered by another element. */
  ACTION_REJECTED: "web.action.rejected",
  /** No element matched the action's target with enough confidence. */
  TARGET_NOT_FOUND: "web.target.not_found",
  /** Several elements matched the action's target and none could be preferred. */
  TARGET_AMBIGUOUS: "web.target.ambiguous",
  /** The action ran and its post-condition did not hold (decision D4). */
  OUTPUT_NOT_OBSERVED: "web.validation.output_not_observed",
  /** An authored `web.dom.assert` condition did not hold. */
  STATE_MISMATCH: "web.validation.state_mismatch",
  /** The browser landed somewhere other than the requested URL, or never left where it was. */
  NAVIGATION_UNEXPECTED: "web.navigation.unexpected",
  /** The document was replaced between resolving the target and running the action. */
  PAGE_CHANGED: "web.page.changed",
  /** A wait, or an action, ran out of time. */
  TIMEOUT: "web.action.timeout",
  /** The host wants a sign-in before the action can continue. */
  AUTH_REQUIRED: "web.auth.required",
  /** A person must act first: a captcha, or a native dialog waiting for an answer. */
  USER_INTERVENTION_REQUIRED: "web.intervention.required",
  /** The client does not implement the requested action type at all. */
  UNSUPPORTED_TYPE: "web.action.unsupported_type",
  /** The verb is registered but not built yet, so a Flow that reaches one fails honestly. */
  NOT_IMPLEMENTED: "web.action.not_implemented",
  /** The action ran and failed for a reason no other code names. */
  ACTION_FAILED: "web.action.failed",
  /** Nothing said why the action failed. */
  UNKNOWN: "web.action.unknown"
});
var WEB_AUTOMATION_FAILURE_CODE_DEFINITIONS = Object.freeze({
  "web.action.rejected": { category: "blocked_by_capability_or_policy", retryable: false, stage: "execution" },
  "web.target.not_found": { category: "target_not_found", retryable: true, stage: "target_resolution" },
  "web.target.ambiguous": { category: "target_ambiguous", retryable: false, stage: "target_resolution" },
  "web.validation.output_not_observed": { category: "output_not_observed", retryable: true, stage: "verification" },
  "web.validation.state_mismatch": { category: "unexpected_state", retryable: false, stage: "verification" },
  "web.navigation.unexpected": { category: "navigation_unexpected", retryable: false, stage: "confirmation" },
  "web.page.changed": { category: "page_changed", retryable: true, stage: "execution" },
  "web.action.timeout": { category: "timeout", retryable: true, stage: "execution" },
  "web.auth.required": { category: "auth_required", retryable: false, stage: "confirmation" },
  "web.intervention.required": { category: "user_intervention_required", retryable: false, stage: "execution" },
  "web.action.unsupported_type": { category: "blocked_by_capability_or_policy", retryable: false, stage: "dispatch" },
  "web.action.not_implemented": { category: "blocked_by_capability_or_policy", retryable: false, stage: "dispatch" },
  "web.action.failed": { category: "action_failed", retryable: true, stage: "execution" },
  "web.action.unknown": { category: "ambiguous_or_unknown", retryable: false, stage: "execution" }
});
function isWebAutomationFailureCode(value) {
  return typeof value === "string" && Object.hasOwn(WEB_AUTOMATION_FAILURE_CODE_DEFINITIONS, value);
}
function webAutomationFailureRecord(code, comparison = {}) {
  const definition = WEB_AUTOMATION_FAILURE_CODE_DEFINITIONS[code];
  const expected = boundedText(comparison.expected);
  const actual = boundedText(comparison.actual);
  const evidenceDigest = comparison.evidenceDigest !== void 0 && EVIDENCE_DIGEST_PATTERN.test(comparison.evidenceDigest) ? comparison.evidenceDigest : void 0;
  return {
    category: definition.category,
    code,
    retryable: definition.retryable,
    stage: definition.stage,
    ...expected === void 0 ? {} : { expected },
    ...actual === void 0 ? {} : { actual },
    ...evidenceDigest === void 0 ? {} : { evidenceDigest }
  };
}
var EVIDENCE_DIGEST_PATTERN = /^[a-f0-9]{64}$/u;
function boundedText(value) {
  if (value === void 0) return void 0;
  const collapsed = value.replace(/\s+/gu, " ").trim();
  if (collapsed.length === 0) return void 0;
  if (collapsed.length <= WEB_AUTOMATION_VALIDATION_TEXT_MAX_LENGTH) return collapsed;
  return `${collapsed.slice(0, WEB_AUTOMATION_VALIDATION_TEXT_MAX_LENGTH - 1)}\u2026`;
}

// src/constants.ts
var WEB_AUTOMATION_DOMAIN_ID = "web-automation";

// src/runtime/expectation/conditions.ts
var ASSERT_KINDS = Object.freeze({
  exists: true,
  absent: true,
  text: true,
  url: true,
  visible: true,
  enabled: true
});
var IMMEDIATE_TIMEOUT_MS = 1;
var MAX_DESCRIPTION_LENGTH = 160;
function webAutomationExpectationCondition(value, fallbackTimeoutMs) {
  const entry = jsonObject(value);
  if (!entry) return void 0;
  const nested = jsonObject(entry.assert);
  const claim = nested && isAssertKind(nested.kind) ? nested : entry;
  const kind = claim.kind;
  if (!isAssertKind(kind)) return void 0;
  const expected = typeof claim.expected === "string" ? claim.expected : void 0;
  const selector = nonEmptyString(entry.selector) ?? nonEmptyString(claim.selector);
  const timeoutMs = Math.max(
    IMMEDIATE_TIMEOUT_MS,
    positiveInteger(claim.timeoutMs) ?? positiveInteger(entry.timeoutMs) ?? nonNegativeInteger(fallbackTimeoutMs) ?? 0
  );
  const frameId = nonNegativeInteger(entry.frameId ?? entry.browserFrameId);
  const tabId = nonNegativeInteger(entry.tabId ?? entry.browserTabId);
  return {
    assert: { kind, ...expected === void 0 ? {} : { expected }, timeoutMs },
    ...selector === void 0 ? {} : { selector },
    ...frameId === void 0 ? {} : { frameId },
    ...tabId === void 0 ? {} : { tabId }
  };
}
function webAutomationExpectationActionPayload(condition) {
  return {
    ...condition.selector === void 0 ? {} : { selector: condition.selector },
    ...condition.frameId === void 0 ? {} : { browserFrameId: condition.frameId },
    ...condition.tabId === void 0 ? {} : { browserTabId: condition.tabId },
    assert: {
      kind: condition.assert.kind,
      ...condition.assert.expected === void 0 ? {} : { expected: condition.assert.expected },
      timeoutMs: condition.assert.timeoutMs
    }
  };
}
function describeWebAutomationExpectationCondition(condition) {
  const where = condition.selector ? `"${condition.selector}"` : "the resolved element";
  const kind = condition.assert.kind;
  const expected = condition.assert.expected ?? "";
  if (kind === "url") return bounded(`the page URL contains "${expected}"`);
  if (kind === "text") return bounded(`${condition.selector ? where : "the page"} contains "${expected}"`);
  if (kind === "exists") return bounded(`an element matches ${where}`);
  if (kind === "absent") return bounded(`no element matches ${where}`);
  return bounded(`${where} is ${kind}`);
}
function isAssertKind(value) {
  return typeof value === "string" && Object.hasOwn(ASSERT_KINDS, value);
}
function jsonObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value : void 0;
}
function nonEmptyString(value) {
  return typeof value === "string" && value.length > 0 ? value : void 0;
}
function positiveInteger(value) {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : void 0;
}
function nonNegativeInteger(value) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : void 0;
}
function bounded(value) {
  const collapsed = value.replace(/\s+/gu, " ").trim();
  return collapsed.length <= MAX_DESCRIPTION_LENGTH ? collapsed : `${collapsed.slice(0, MAX_DESCRIPTION_LENGTH - 1)}\u2026`;
}

// src/runtime/expectation/evaluate.ts
var ASSERT_OUTPUT_ID = "web.dom.assert";
var EXPECTATION_SOURCE = "web-automation-expectation";
function createWebAutomationExpectationEvaluator(dispatch) {
  return async (conditions, mode, timeoutMs, context) => {
    try {
      return await evaluateConditions(dispatch, conditions, mode, timeoutMs, context);
    } catch (error) {
      return { passed: true, checkedConditionCount: 0, message: `The expected state could not be evaluated: ${errorText(error)}` };
    }
  };
}
async function evaluateConditions(dispatch, conditions, mode, timeoutMs, context) {
  const outcomes = [];
  for (let index = 0; index < conditions.length; index += 1) {
    if (context.signal?.aborted) break;
    const condition = webAutomationExpectationCondition(conditions[index], timeoutMs);
    outcomes.push(condition ? await evaluateCondition(dispatch, condition, index, context) : { description: "a condition this domain cannot read", evaluated: false, held: false, timedOut: false });
  }
  return verdict(outcomes, mode);
}
async function evaluateCondition(dispatch, condition, index, context) {
  const description = describeWebAutomationExpectationCondition(condition);
  let result;
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
  if (result.status !== "failed" && result.status !== "timed_out") {
    return { description, evaluated: false, held: false, timedOut: false };
  }
  const timedOut = result.status === "timed_out";
  return { description, evaluated: true, held: false, timedOut, failure: conditionFailure(condition, description, timedOut, result) };
}
function conditionFailure(condition, description, timedOut, result) {
  const reported = result.failure;
  if (reported && isWebAutomationFailureCode(reported.code)) return reported;
  const code = timedOut ? WEB_AUTOMATION_FAILURE_CODES.TIMEOUT : WEB_AUTOMATION_FAILURE_CODES.STATE_MISMATCH;
  const actual = reported?.actual ?? dispatchMessage(result.payload) ?? result.error ?? (timedOut ? `the wait for ${condition.assert.kind} ran out` : "the condition did not hold");
  return webAutomationFailureRecord(code, { expected: description, actual });
}
function verdict(outcomes, mode) {
  const evaluated = outcomes.filter((outcome) => outcome.evaluated);
  const unevaluated = outcomes.length - evaluated.length;
  if (evaluated.length === 0) {
    return {
      passed: true,
      checkedConditionCount: 0,
      message: outcomes.length === 0 ? "The expected state named no conditions, so nothing was checked." : `None of the ${outcomes.length} expected condition${outcomes.length === 1 ? "" : "s"} could be checked against the page.`
    };
  }
  const rejected = evaluated.filter((outcome) => !outcome.held);
  const passed = mode === "any" ? rejected.length < evaluated.length : rejected.length === 0;
  if (passed) {
    return {
      passed: true,
      checkedConditionCount: evaluated.length,
      message: unevaluated === 0 ? `${evaluated.length} expected condition${evaluated.length === 1 ? "" : "s"} held.` : `${evaluated.length} of ${outcomes.length} expected conditions held; ${unevaluated} could not be checked.`
    };
  }
  const representative = rejected.find((outcome) => outcome.timedOut) ?? rejected[0];
  return {
    passed: false,
    checkedConditionCount: evaluated.length,
    message: `${rejected.length} of ${evaluated.length} checked expected condition${evaluated.length === 1 ? "" : "s"} did not hold: ${representative.description}.`,
    failure: representative.failure ?? webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.STATE_MISMATCH, { expected: representative.description })
  };
}
function conditionMetadata(index, context) {
  return {
    source: EXPECTATION_SOURCE,
    domainId: WEB_AUTOMATION_DOMAIN_ID,
    expectationSource: context.source,
    conditionIndex: index,
    ...context.nodeId === void 0 ? {} : { nodeId: context.nodeId },
    ...context.attemptId === void 0 ? {} : { attemptId: context.attemptId },
    ...context.stateRef === void 0 ? {} : { stateRef: context.stateRef }
  };
}
function dispatchMessage(payload) {
  const message = payload?.message;
  return typeof message === "string" && message.length > 0 ? message : void 0;
}
function errorText(error) {
  return error instanceof Error && error.message.length > 0 ? error.message : "the reason was not reported";
}

// src/runtime/expectation/tests/evaluate.test.ts
function dispatcher(answers) {
  const calls = [];
  const dispatch = async (request) => {
    calls.push(request);
    const answer = answers[calls.length - 1] ?? { ok: false };
    return { outputId: request.outputId, ok: answer.status === "succeeded", ...answer };
  };
  return { dispatch, calls };
}
var transitionContext = { source: "transition_comparison" };
var policyContext = { source: "policy_node" };
test("a condition that holds passes and is counted", async () => {
  const { dispatch, calls } = dispatcher([{ status: "succeeded" }]);
  const evaluation = await createWebAutomationExpectationEvaluator(dispatch)(
    [{ kind: "exists", selector: "#done" }],
    "all",
    0,
    transitionContext
  );
  assert.equal(evaluation.passed, true);
  assert.equal(evaluation.checkedConditionCount, 1);
  assert.equal(evaluation.failure, void 0);
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.outputId, "web.dom.assert");
  assert.deepEqual(calls[0]?.payload, { selector: "#done", assert: { kind: "exists", timeoutMs: 1 } });
  assert.equal(calls[0]?.metadata.expectationSource, "transition_comparison");
  assert.equal(calls[0]?.metadata.conditionIndex, 0);
});
test("a rejected condition fails with STATE_MISMATCH and a record Core's parser keeps", async () => {
  const { dispatch } = dispatcher([{ status: "failed", payload: { status: "failed", message: "Assertion did not hold: text." } }]);
  const evaluation = await createWebAutomationExpectationEvaluator(dispatch)(
    [{ kind: "text", expected: "Order placed", selector: "#banner" }],
    "all",
    0,
    transitionContext
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
    [{ kind: "exists", selector: "#a" }, { kind: "visible", selector: "#b", timeoutMs: 250 }],
    "all",
    0,
    transitionContext
  );
  assert.equal(evaluation.passed, false);
  assert.equal(evaluation.checkedConditionCount, 2);
  assert.equal(evaluation.failure?.code, WEB_AUTOMATION_FAILURE_CODES.TIMEOUT);
  assert.equal(evaluation.failure?.category, "timeout");
  assert.equal(evaluation.failure?.expected, '"#b" is visible');
});
test("a client that named a code from the closed set keeps its own record", async () => {
  const reported = { category: "blocked_by_capability_or_policy", code: WEB_AUTOMATION_FAILURE_CODES.ACTION_REJECTED, retryable: false, stage: "execution" };
  const { dispatch } = dispatcher([{ status: "failed", failure: reported }]);
  const evaluation = await createWebAutomationExpectationEvaluator(dispatch)(
    [{ kind: "enabled", selector: "#save" }],
    "all",
    0,
    transitionContext
  );
  assert.deepEqual(evaluation.failure, reported);
});
test("a client code outside the closed set is replaced rather than passed through", async () => {
  const { dispatch } = dispatcher([{
    status: "failed",
    failure: { category: "expected_state_missing", code: "web.assert.text", retryable: true, stage: "verification", expected: "the page says Done", actual: "the page reads Pending" }
  }]);
  const evaluation = await createWebAutomationExpectationEvaluator(dispatch)(
    [{ kind: "text", expected: "Done" }],
    "all",
    0,
    transitionContext
  );
  assert.equal(evaluation.failure?.code, WEB_AUTOMATION_FAILURE_CODES.STATE_MISMATCH);
  assert.equal(evaluation.failure?.actual, "the page reads Pending");
});
test("mode any passes when one condition holds; mode all does not", async () => {
  const conditions = [{ kind: "exists", selector: "#a" }, { kind: "exists", selector: "#b" }];
  const any = await createWebAutomationExpectationEvaluator(dispatcher([{ status: "failed" }, { status: "succeeded" }]).dispatch)(
    conditions,
    "any",
    0,
    transitionContext
  );
  assert.equal(any.passed, true);
  assert.equal(any.checkedConditionCount, 2);
  const all = await createWebAutomationExpectationEvaluator(dispatcher([{ status: "failed" }, { status: "succeeded" }]).dispatch)(
    conditions,
    "all",
    0,
    transitionContext
  );
  assert.equal(all.passed, false);
  assert.equal(all.checkedConditionCount, 2);
});
test("an unevaluatable condition is not counted, does not reject, and does not throw", async () => {
  const { dispatch, calls } = dispatcher([]);
  const evaluation = await createWebAutomationExpectationEvaluator(dispatch)(
    [{ kind: "contains", selector: "#a" }, "a bare string", null],
    "all",
    0,
    transitionContext
  );
  assert.equal(evaluation.passed, true);
  assert.equal(evaluation.checkedConditionCount, 0);
  assert.equal(evaluation.failure, void 0);
  assert.equal(evaluation.message, "None of the 3 expected conditions could be checked against the page.");
  assert.equal(calls.length, 0, "an unreadable condition is never dispatched");
});
test("a command that never reached a client judges nothing rather than rejecting", async () => {
  for (const answer of [{ ok: false, error: "A single paired web-automation client must be selected." }, { status: "cancelled" }, { status: "unknown" }]) {
    const evaluation = await createWebAutomationExpectationEvaluator(dispatcher([answer]).dispatch)(
      [{ kind: "exists", selector: "#a" }],
      "all",
      0,
      transitionContext
    );
    assert.equal(evaluation.passed, true, JSON.stringify(answer));
    assert.equal(evaluation.checkedConditionCount, 0, JSON.stringify(answer));
  }
});
test("a dispatch that throws is caught and reported as unjudged", async () => {
  const dispatch = async () => {
    throw new Error("gateway is gone");
  };
  const evaluation = await createWebAutomationExpectationEvaluator(dispatch)(
    [{ kind: "exists", selector: "#a" }],
    "all",
    0,
    transitionContext
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
  const policy = await createWebAutomationExpectationEvaluator(dispatcher([{ status: "failed" }]).dispatch)(conditions, "all", 1e3, policyContext);
  const transition = await createWebAutomationExpectationEvaluator(dispatcher([{ status: "failed" }]).dispatch)(conditions, "all", 1e3, transitionContext);
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
