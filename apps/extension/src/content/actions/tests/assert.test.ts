// The failure record the assert verb builds when an authored claim does not
// hold.
//
// `e2e/content/tests/check-assert.spec.ts` is the live proof that the verb
// reaches the right verdict on a real page. What it cannot state on its own is
// that the record comes out of the domain's closed set rather than being
// assembled here, which is the property that stops a code being invented per
// assertion kind -- `web.assert.exists`, `web.assert.text` and four more, none
// of them in any set, which is what this file used to emit.
//
// It also covers the other half of the verdict, added once `AssertionOutcome`
// began carrying its timing: whether a failed claim is STATE_MISMATCH or
// TIMEOUT. A false claim is polled to its deadline whatever the reason, so the
// window running out cannot be the test on its own -- what separates them is
// whether the page was ever read. The three rows below pin both answers and the
// case where no window was given at all.
//
// The verb takes every page capability as an injected dependency, so it runs in
// Node with no DOM: only the ones the assert path touches are supplied, and the
// rest throw if reached, which is the assertion that the path is what it looks
// like.

import assert from "node:assert/strict";
import test from "node:test";
import { parseAutomationStudioFailureRecord } from "fluxiq/automation-studio";
import { WEB_AUTOMATION_FAILURE_CODES, isWebAutomationFailureCode } from "@fluxiq-web-extension/domain/client";
import { assertAction } from "../assert";
import type { ContentActionDependencies } from "../types";
import type { BrowserActionCommand, BrowserActionResult, BrowserActionValidation } from "../../types";

const action: BrowserActionCommand = {
  commandId: "cmd-assert",
  actionType: "web.dom.assert",
  selector: "#status",
  assert: { kind: "text", expected: "Done" }
};

/** How the evaluation's window closed, which is what decides STATE_MISMATCH from TIMEOUT. */
type StubWait = { judged?: boolean; waitExpired?: boolean };

/**
 * The verb's dependencies, reduced to the assert path: the evaluation, the
 * snapshot the evidence carries, and the two result builders. Everything else
 * is a getter that throws, so a change that starts reaching for the page fails
 * here rather than passing quietly.
 *
 * `success` and `timedOut` produce different statuses and nothing else does, so
 * a row asserting `timed_out` is asserting which builder the verb chose. In the
 * product both are `action-runtime/results.ts`, which reads the code off the
 * domain's closed set; the record itself is proven on a real page by
 * `e2e/content/tests/check-assert.spec.ts`.
 */
function dependencies(held: boolean, expected: string, actual: string, wait: StubWait = {}): ContentActionDependencies {
  const build = (status: BrowserActionResult["status"]) => (
    command: BrowserActionCommand,
    startedAt: number,
    message: string,
    validation: BrowserActionValidation
  ): BrowserActionResult => ({
    commandId: command.commandId,
    actionType: command.actionType,
    status: status === "succeeded" && validation.status === "failed" ? "failed" : status,
    validation,
    message,
    startedAt,
    finishedAt: startedAt + 1
  });
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
  // The verb attaches no record of its own on this path, so the builder's
  // TIMEOUT stands rather than being overwritten with a state mismatch.
  assert.equal(result.failure, undefined);
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
