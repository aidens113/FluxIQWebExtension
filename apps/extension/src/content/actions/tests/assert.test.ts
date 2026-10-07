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

test("a selector recorded inside a shadow root is asked with its host chain, from either place a command carries it", async () => {
  // Lane A's run 40 (`run-muq6lqnw-fdfa7aac`): the dry run asked whether the
  // store chooser's button was visible, and a selector written inside the
  // chooser's root was asked of the light document, where it matches nothing.
  const hosts = ["body > header > div > vr-fulfillment-picker"];
  const element = { tagName: "button", selector: "div > ul > li:nth-of-type(3) > button", context: { shadowHosts: hosts } };
  const declared = { ...action, selector: element.selector, assert: { kind: "visible" as const }, element };
  const raw = { ...action, selector: element.selector, assert: { kind: "visible" as const }, options: { element } };
  const plain = { ...action, assert: { kind: "visible" as const } };
  for (const [command, expected] of [[declared, hosts], [raw, hosts], [plain, undefined]] as const) {
    const asked: unknown[] = [];
    const deps = dependencies(true, "", "");
    const capturing = { ...deps, evaluateAssertion: (_request: unknown, target: unknown) => { asked.push(target); return deps.evaluateAssertion(_request as never, target as never); } } as ContentActionDependencies;
    await assertAction(command as BrowserActionCommand, capturing, 100);
    assert.deepEqual((asked[0] as { shadowHosts?: unknown }).shadowHosts, expected);
    assert.equal((asked[0] as { selector?: unknown }).selector, command.selector);
  }
});

// t195, live run `run-musp474o-e0ed7432`: the build's test checked a repeated
// Confirm once per kept row, and every pass answered "visible and enabled" --
// including the pass for a row whose Confirm was already gone. The domain
// scopes each pass to its row by writing the row's `values` into
// `element.context.record`, but the verb handed the evaluator the bare recorded
// selector, which names the build's own card, so the record gate never ran and
// the check judged a different control from the one the Flow presses. A
// row-scoped assert now resolves its target the way the click does.

/** The verb's dependencies with the evaluator's target and every `resolveTarget` call captured. */
function capturing(resolve: (command: BrowserActionCommand) => unknown): { deps: ContentActionDependencies; asked: unknown[]; resolved: BrowserActionCommand[] } {
  const asked: unknown[] = [];
  const resolved: BrowserActionCommand[] = [];
  const base = dependencies(true, "", "");
  const deps = {
    ...base,
    evaluateAssertion: (request: unknown, target: unknown) => { asked.push(target); return base.evaluateAssertion(request as never, target as never); },
    resolveTarget: (command: BrowserActionCommand) => { resolved.push(command); return resolve(command); },
    describeElement: () => ({ tagName: "button" })
  } as unknown as ContentActionDependencies;
  return { deps, asked, resolved };
}

const CONFIRM_SELECTOR = "li.invite:nth-of-type(1) > button.confirm";
const ROW_ELEMENT = { tagName: "button", selector: CONFIRM_SELECTOR, context: { record: { values: ["Amara Osei", "Product Designer"] } } };

test("a row-scoped check resolves its target through the record gate, never the bare recorded selector", async () => {
  const confirm = { tagName: "BUTTON" } as unknown as Element;
  const resolution = { strategy: "scored-candidate", candidateCount: 1 } as const;
  for (const command of [
    { ...action, selector: CONFIRM_SELECTOR, assert: { kind: "visible" as const }, element: ROW_ELEMENT },
    { ...action, selector: CONFIRM_SELECTOR, assert: { kind: "visible" as const }, options: { element: ROW_ELEMENT } }
  ]) {
    const { deps, asked, resolved } = capturing(() => ({ element: confirm, resolution }));
    const result = await assertAction(command as BrowserActionCommand, deps, 100);
    assert.equal(resolved.length, 1, "the check must resolve the row's control as the Flow's click does");
    assert.equal(resolved[0], command);
    assert.deepEqual(asked[0], { element: confirm });
    assert.deepEqual(result.status, "succeeded");
  }
});

test("a row-scoped check whose row holds no such control is asked of nothing, which waits in vain", async () => {
  const command = { ...action, selector: CONFIRM_SELECTOR, assert: { kind: "visible" as const }, element: ROW_ELEMENT } as BrowserActionCommand;
  const { deps, asked, resolved } = capturing(() => { throw new Error("No target resolved"); });
  await assertAction(command, deps, 100);
  assert.equal(resolved.length, 1);
  assert.deepEqual(asked[0], {}, "a refused row must not fall back to the recorded selector");
});

test("an unscoped selector check still hands the selector over and never resolves", async () => {
  const unscoped = [
    { ...action, assert: { kind: "visible" as const } },
    { ...action, assert: { kind: "visible" as const }, element: { tagName: "button", context: { record: { key: "usr_a91", keyAttribute: "data-member-id" } } } },
    { ...action, assert: { kind: "visible" as const }, element: { tagName: "button", context: { record: { values: [] } } } }
  ];
  for (const command of unscoped) {
    const { deps, asked, resolved } = capturing(() => { throw new Error("must not resolve"); });
    await assertAction(command as BrowserActionCommand, deps, 100);
    assert.equal(resolved.length, 0);
    assert.equal((asked[0] as { selector?: unknown }).selector, action.selector);
  }
});

test("absent with no authored target does not infer the focused element", async () => {
  const { deps, asked, resolved } = capturing(() => ({ element: { isConnected: true }, resolution: { strategy: "active-element", candidateCount: 1 } }));
  await assertAction({ ...action, selector: undefined, assert: { kind: "absent" } }, deps, 100);
  assert.equal(resolved.length, 0);
  assert.deepEqual(asked, [{}]);
});

test("absent preserves authored fingerprint coordinate and visual targets", async () => {
  const element = { isConnected: true };
  for (const target of [
    { element: { tagName: "button" } },
    { options: { element: { tagName: "button" } } },
    { coordinates: { x: 10, y: 10 } },
    { visualTarget: { bounds: { x: 0, y: 0, width: 10, height: 10 } } }
  ]) {
    const { deps, asked, resolved } = capturing(() => ({ element, resolution: { strategy: "coordinates", candidateCount: 1 } }));
    await assertAction({ ...action, selector: undefined, ...target, assert: { kind: "absent" } } as BrowserActionCommand, deps, 100);
    assert.equal(resolved.length, 1);
    assert.deepEqual(asked, [{ element }]);
  }
});

test("whole-page text with no authored target does not infer a focused field", async () => {
  const { deps, asked, resolved } = capturing(() => ({ element: {}, resolution: { strategy: "active-element", candidateCount: 1 } }));
  await assertAction({ ...action, selector: undefined, assert: { kind: "text", expected: "null" } }, deps, 100);
  assert.equal(resolved.length, 0);
  assert.deepEqual(asked, [{}]);
});
