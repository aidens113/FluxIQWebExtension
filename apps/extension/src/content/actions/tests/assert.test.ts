// What the assert verb does with the failure record `action-runtime/results.ts`
// built for it.
//
// The verb builds no record itself. Until Wave 3 it wrote a STATE_MISMATCH over
// whatever the builder had produced, which restated a rule `results.ts` already
// applies (`unobservedOutputCode`: a failed `web.dom.assert` post-condition is
// STATE_MISMATCH, every other verb's is OUTPUT_NOT_OBSERVED) and discarded the
// one record that disagrees with it -- the AUTH_REQUIRED that `authGateFailure`
// substitutes when the selector matches nothing on a sign-in gate.
//
// So the property under test moved. It was "the record this verb writes comes
// from the closed set"; it is now "this verb writes no record", which is the
// stronger statement and the one that stops the loss coming back. The rows
// below pin it from both sides: whatever record the builder produced arrives at
// the caller identical, and a record the verb could not have chosen for itself
// -- AUTH_REQUIRED, a code no assert path would ever pick -- survives the verb
// untouched. Reinstating the override fails both.
//
// The stub's `success` and `timedOut` therefore have to build a record, where
// before they built none, and they build it the way `results.ts` does: from the
// domain's closed set, through `webAutomationFailureRecord`, with the code
// chosen by the same rule. That the stub agrees with `results.ts` is asserted
// only by reading it -- what the harness proves against a real page and the
// real builder is `e2e/content/tests/check-assert.spec.ts`, which asserts the
// whole record for five kinds.
//
// It also covers the other half of the verdict, added once `AssertionOutcome`
// began carrying its timing: whether a failed claim is STATE_MISMATCH or
// TIMEOUT. A false claim is polled to its deadline whatever the reason, so the
// window running out cannot be the test on its own -- what separates them is
// whether the page was ever read. The rows below pin both answers and the case
// where no window was given at all.
//
// The verb takes every page capability as an injected dependency, so it runs in
// Node with no DOM: only the ones the assert path touches are supplied, and the
// rest throw if reached, which is the assertion that the path is what it looks
// like.

import assert from "node:assert/strict";
import test from "node:test";
import { parseAutomationStudioFailureRecord } from "fluxiq/automation-studio";
import { WEB_AUTOMATION_FAILURE_CODES, isWebAutomationFailureCode, webAutomationFailureRecord } from "@fluxiq-web-extension/domain/client";
import { assertAction } from "../assert";
import type { ContentActionDependencies } from "../types";
import type { BrowserActionCommand, BrowserActionResult, BrowserActionValidation } from "../../types";

type FailureRecord = NonNullable<BrowserActionResult["failure"]>;

const action: BrowserActionCommand = {
  commandId: "cmd-assert",
  actionType: "web.dom.assert",
  selector: "#status",
  assert: { kind: "text", expected: "Done" }
};

/** How the evaluation's window closed, which is what decides STATE_MISMATCH from TIMEOUT. */
type StubWait = { judged?: boolean; waitExpired?: boolean };

/**
 * The record `results.ts` would attach to a failed result, reproduced here
 * because the real builder reads `location`, `document` and the capture
 * settings and so cannot run in Node.
 *
 * A `timed_out` result carries TIMEOUT; a failed post-condition carries the
 * code `unobservedOutputCode` picks, which for `web.dom.assert` is
 * STATE_MISMATCH. `authGateFailure` -- the hook whose record the verb used to
 * discard -- is not modelled: a row that wants it hands the record in directly,
 * which is the honest way to state "the builder decided this, not the verb".
 */
function builtFailure(status: BrowserActionResult["status"], validation: BrowserActionValidation): FailureRecord | undefined {
  if (validation.status !== "failed") return undefined;
  const comparison = { expected: validation.expected, actual: validation.actual };
  return status === "timed_out"
    ? webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.TIMEOUT, comparison)
    : webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.STATE_MISMATCH, comparison);
}

/**
 * The verb's dependencies, reduced to the assert path: the evaluation, the
 * snapshot the evidence carries, and the two result builders. Everything else
 * is a getter that throws, so a change that starts reaching for the page fails
 * here rather than passing quietly.
 *
 * `success` and `timedOut` produce different statuses and nothing else does, so
 * a row asserting `timed_out` is asserting which builder the verb chose. In the
 * product both are `action-runtime/results.ts`. `override` replaces the record
 * either builder would have produced, which is how a row states that the
 * builder -- not the verb -- decided the code.
 */
function dependencies(held: boolean, expected: string, actual: string, wait: StubWait = {}, override?: FailureRecord): ContentActionDependencies {
  const build = (status: BrowserActionResult["status"]) => (
    command: BrowserActionCommand,
    startedAt: number,
    message: string,
    validation: BrowserActionValidation
  ): BrowserActionResult => {
    const resolved = status === "succeeded" && validation.status === "failed" ? "failed" : status;
    const failure = override ?? builtFailure(resolved, validation);
    return {
      commandId: command.commandId,
      actionType: command.actionType,
      status: resolved,
      validation,
      message,
      ...(failure ? { failure } : {}),
      startedAt,
      finishedAt: startedAt + 1
    };
  };
  const unreachable = (name: string) => () => {
    throw new Error(`the assert path must not touch ${name}`);
  };
  return new Proxy({
    evaluateAssertion: () => Promise.resolve({
      held,
      expected,
      actual,
      judged: wait.judged ?? true,
      waitExpired: wait.waitExpired ?? false,
      timeoutMs: 200,
      elapsedMs: 200,
      attempts: 5
    }),
    captureSnapshot: () => ({ url: "https://example.test/order", title: "Order", elements: [] }),
    success: build("succeeded"),
    timedOut: build("timed_out")
  } as unknown as ContentActionDependencies, {
    get(target, property: string) {
      const found = (target as unknown as Record<string, unknown>)[property];
      return found ?? unreachable(property);
    }
  });
}

test("a claim that holds reports no failure at all", async () => {
  const result = await assertAction(action, dependencies(true, 'the page contains "Done"', 'the page reads "Done"'), 100);
  assert.equal(result.status, "succeeded");
  assert.equal(result.failure, undefined);
});

test("a claim that does not hold carries STATE_MISMATCH from the closed set, whole", async () => {
  const result = await assertAction(
    action,
    dependencies(false, 'the page contains "Done"', 'the page reads "Pending"'),
    100
  );
  assert.equal(result.status, "failed");
  assert.deepEqual(result.failure, {
    // `unexpected_state`, not `expected_state_missing`: the page is in a state
    // other than the asserted one, which is what that category names.
    // `expected_state_missing` is Core's transition-comparison category and has
    // no web code at all.
    category: "unexpected_state",
    code: "web.validation.state_mismatch",
    // Not retryable: nothing here acts on the page, and the wait that gives the
    // page its chance to change has already happened inside the evaluation.
    retryable: false,
    stage: "verification",
    expected: 'the page contains "Done"',
    actual: 'the page reads "Pending"'
  });
  assert.equal(result.failure?.code, WEB_AUTOMATION_FAILURE_CODES.STATE_MISMATCH);
  assert.ok(isWebAutomationFailureCode(result.failure?.code));
  // Core drops a record it refuses whole, taking the failure with it.
  assert.deepEqual(parseAutomationStudioFailureRecord(result.failure), result.failure);
});

test("the verb returns the record the builder made, whatever it is, and never one of its own", async () => {
  // The row that stands in for the override's deletion. AUTH_REQUIRED is a code
  // no assert path could reach on its own -- `results.ts` substitutes it in
  // `authGateFailure` when the selector matches nothing and the document is a
  // sign-in gate -- so a result carrying it out the other side proves the verb
  // added nothing. With the override restored this reads STATE_MISMATCH, and an
  // operator told to check the page is sent looking for a state problem when
  // their session has expired.
  const gate = webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.AUTH_REQUIRED, {
    expected: 'an element matching "#status"',
    actual: 'nothing matched "#status"; the document is a sign-in gate, so the session has probably expired'
  });
  const result = await assertAction(
    { ...action, assert: { kind: "url", expected: "https://example.test/order" } },
    dependencies(false, "the address https://example.test/order", "https://example.test/sign-in", {}, gate),
    100
  );
  assert.equal(result.status, "failed");
  assert.deepEqual(result.failure, gate, "the builder's record reached the caller unchanged");
  assert.equal(result.failure?.code, WEB_AUTOMATION_FAILURE_CODES.AUTH_REQUIRED);
  assert.deepEqual(parseAutomationStudioFailureRecord(result.failure), result.failure);
});

test("the code no longer varies with the kind of claim, which is where six out-of-set codes came from", async () => {
  const kinds = ["exists", "absent", "text", "url", "visible", "enabled"] as const;
  for (const kind of kinds) {
    const result = await assertAction(
      { ...action, assert: { kind } },
      dependencies(false, `the claim ${kind}`, "it did not hold"),
      100
    );
    assert.equal(result.failure?.code, WEB_AUTOMATION_FAILURE_CODES.STATE_MISMATCH, kind);
    // The kind is not lost: it is named in the comparison a reader looks at.
    assert.equal(result.failure?.expected, `the claim ${kind}`);
  }
});

test("a claim whose subject never appeared runs out of time rather than mismatching state", async () => {
  const result = await assertAction(
    { ...action, assert: { kind: "exists", timeoutMs: 200 } },
    dependencies(false, 'an element matching "#status" exists', 'nothing matched "#status"', { judged: false, waitExpired: true }),
    100
  );
  // `timed_out` can only have come from `deps.timedOut`, which is where TIMEOUT
  // is built. Reporting `failed` here is what the verb did before the outcome
  // carried timing, and it made TIMEOUT unreachable from this verb entirely.
  assert.equal(result.status, "timed_out");
  assert.equal(result.message, "Assertion did not hold within 200 ms: exists.");
  // The builder's TIMEOUT stands: the timeout branch never had an override, and
  // now neither branch does.
  assert.equal(result.failure?.code, WEB_AUTOMATION_FAILURE_CODES.TIMEOUT);
  assert.deepEqual(parseAutomationStudioFailureRecord(result.failure), result.failure);
  assert.deepEqual(result.validation, {
    status: "failed",
    expected: 'an element matching "#status" exists',
    actual: 'nothing matched "#status"'
  });
});

test("a claim the page contradicted is a state mismatch even though its window ran out", async () => {
  // The row that stops the timeout branch swallowing every failure: a false
  // claim is always polled to the deadline, so `waitExpired` alone would make
  // STATE_MISMATCH unreachable. What separates them is whether the page was
  // read -- here it was, and it disagreed.
  const result = await assertAction(
    action,
    dependencies(false, 'the page contains "Done"', 'the page reads "Pending"', { judged: true, waitExpired: true }),
    100
  );
  assert.equal(result.status, "failed");
  assert.equal(result.failure?.code, WEB_AUTOMATION_FAILURE_CODES.STATE_MISMATCH);
});

test("a claim given no window at all is a state mismatch, not a timeout", async () => {
  const result = await assertAction(
    { ...action, assert: { kind: "exists", timeoutMs: 0 } },
    dependencies(false, 'an element matching "#status" exists', 'nothing matched "#status"', { judged: false, waitExpired: false }),
    100
  );
  assert.equal(result.status, "failed");
  assert.equal(result.failure?.code, WEB_AUTOMATION_FAILURE_CODES.STATE_MISMATCH);
});

test("an assert with no parameters fails through the classifier rather than inventing a code", async () => {
  const deps = dependencies(true, "", "");
  const failed: BrowserActionResult = {
    commandId: action.commandId,
    actionType: action.actionType,
    status: "failed",
    validation: { status: "failed", expected: "the assertion to name a kind", actual: "it named none" },
    message: "web.dom.assert requires assert parameters naming the kind of claim.",
    startedAt: 100,
    finishedAt: 101
  };
  const withFailure = { ...deps, failure: () => failed } as ContentActionDependencies;
  const result = await assertAction({ ...action, assert: undefined }, withFailure, 100);
  // `deps.failure` is `action-runtime/results.ts`, which already classifies
  // through the closed set. The verb must route there rather than building a
  // record of its own for a malformed request.
  assert.deepEqual(result, failed);
});
