// The one guarantee the verb dispatcher makes: `executeContentAction` answers.
//
// Whatever a verb does -- return a result, throw, or reject a promise on a
// later tick -- the caller gets a `BrowserActionResult`. It is the dispatcher's
// only job beyond routing, and it is worth a test of its own because the way it
// is lost leaves no trace: `execute.ts` used to `return` most verbs' promises
// rather than awaiting them, and a promise returned from inside a `try` settles
// after the block has exited, so its rejection escaped the `catch` that turns a
// throw into a failure result. `executeContentAction` then rejected instead of
// resolving, `message-handler.ts` never posted a reply, and the command sat
// unanswered forever: Core applies no runtime deadline to a web action, and
// `timeoutMs` is deliberately kept out of the effect payload so a Core timer
// cannot displace the structured `timed_out` result the client reports itself.
// A hung command, not a failed one -- nothing upstream ends it.
//
// The hole was masked rather than harmless. Of the branches that were returned
// unawaited, all but three were synchronous verbs, whose throw happens during
// the try block and was always caught; the three asynchronous ones -- assert,
// extract-list and scroll -- each wrap their own body in a `try`/`catch` that
// routes to `deps.failure`. So no verb in the tree could actually reject, and
// no test written against real verbs could tell the broken dispatcher from the
// fixed one. That masking is exactly why the guarantee has to be asserted
// against the dispatcher's own shape rather than against any one verb: the
// three internal catches are a convention nothing enforces, and the first verb
// added without one reinstates the hang.
//
// So the load-bearing row below drives a verb that has no internal catch of its
// own -- `wait-for-selector.ts` -- into an asynchronous rejection, which is the
// exact shape that used to escape. Remove `await` from the branches in
// `execute.ts` and it fails: `executeContentAction` rejects, and the assertion
// reads `Promise rejected` instead of a result.
//
// Answering is not the whole of it, though: *what* the answer says decides what
// Core does next. Two things reach the dispatcher's catch -- a verb that
// rejected, and an action type no branch routes -- and they must not report the
// same code, because one is retryable and the other cannot be. The last row
// but one holds them apart; the reasoning is on the throw in `execute.ts`.
//
// The verbs take every page capability as an injected dependency, so this runs
// in Node with no DOM.

import assert from "node:assert/strict";
import test from "node:test";
import { parseAutomationStudioFailureRecord } from "fluxiq/automation-studio";
import {
  WEB_AUTOMATION_ACTION_TYPES,
  WEB_AUTOMATION_FAILURE_CODES,
  classifyWebAutomationFailure,
  isWebAutomationFailureCode,
  webAutomationFailureRecord
} from "@fluxiq-web-extension/domain/client";
import { executeContentAction } from "../execute";
import type { ContentActionDependencies } from "../types";
import type { BrowserActionCommand, BrowserActionResult } from "../../types";

const DETACHED = "the frame was detached while waiting";

/**
 * `action-runtime/results.ts`'s `actionFailure`, reproduced here because the
 * real builder reads `location`, `document` and the capture settings and so
 * cannot run in Node.
 *
 * It is reproduced by *calling the same exports it calls* -- the domain's
 * `classifyWebAutomationFailure` with the same outcome, `isWebAutomationFailureCode`
 * to decide whether a thrower's own record may be trusted, and the same UNKNOWN
 * fallback -- rather than by restating its answer, so a row asserting a code
 * asserts the product's classification rule and not this file's opinion of it.
 * The precedence is the builder's too: a record the thrower attached wins over
 * anything inferred from the error, which is how a producer that already knows
 * its code reports one. The only part not exercised is the snapshot the real
 * builder attaches, which the Playwright harness covers against a real page.
 */
function classifiedFailure(action: BrowserActionCommand, error: unknown, startedAt = Date.now()): BrowserActionResult {
  const message = error instanceof Error ? error.message : "Action failed.";
  const failure = reportedFailure(error)
    ?? classifyWebAutomationFailure(error, { status: "failed", actionType: action.actionType, message })
    ?? webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.UNKNOWN, { actual: message });
  return {
    commandId: action.commandId,
    actionType: action.actionType,
    status: "failed",
    validation: { status: "none", reason: "not-yet-validated" },
    message,
    failure,
    startedAt,
    finishedAt: startedAt + 1
  };
}

/**
 * `results.ts`'s `reportedFailure`: the record a thrower attached to the error,
 * read structurally and trusted only when its code is one the closed set names.
 *
 * Structural rather than by class for the reason `results.ts` gives -- the
 * thrown value may have been raised against a bundled copy of the class -- and
 * the code check is what stops an arbitrary object on an error reaching the
 * wire as a failure record.
 */
function reportedFailure(error: unknown): BrowserActionResult["failure"] | undefined {
  const failure = property(error, "failure");
  return isWebAutomationFailureCode(property(failure, "code")) ? failure as NonNullable<BrowserActionResult["failure"]> : undefined;
}

function property(value: unknown, name: string): unknown {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>)[name] : undefined;
}

/**
 * The dependencies, with `failure` real enough to classify and everything else
 * a throw.
 *
 * A capability that throws is how each verb is driven to its failure path
 * without a DOM. `failure` is the one that must work, because it is what every
 * path -- a verb's own catch and the dispatcher's -- ends at, and a stub that
 * threw there would prove nothing about which of the two caught.
 */
function dependencies(overrides: Partial<ContentActionDependencies> = {}): ContentActionDependencies {
  const provided = { failure: classifiedFailure, ...overrides } as unknown as Record<string, unknown>;
  return new Proxy(provided as unknown as ContentActionDependencies, {
    get(target, property: string | symbol) {
      const found = (target as unknown as Record<string | symbol, unknown>)[property];
      if (found !== undefined) return found;
      if (typeof property === "symbol") return undefined;
      return () => {
        throw new Error(`the page is gone: ${property}`);
      };
    }
  });
}

/** A rejection that settles on a later tick, which is the one a returned promise carried past the try block. */
async function rejectLater(): Promise<never> {
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
  throw new Error(DETACHED);
}

test("a verb that rejects on a later tick still answers, instead of leaving the command unanswered", async () => {
  // `wait-for-selector.ts` has no try/catch of its own, so this rejection is
  // the verb's promise rejecting -- the shape that escaped. With the branch
  // returned rather than awaited, `executeContentAction` rejects with this
  // error and the assertion below never sees a result at all.
  const result = await executeContentAction(
    { commandId: "cmd-wait", actionType: "web.dom.wait_for_selector", selector: "#save" },
    dependencies({ waitForCondition: rejectLater })
  );
  assert.equal(result.status, "failed");
  assert.equal(result.commandId, "cmd-wait");
  assert.equal(result.message, DETACHED);
});

test("the escaped rejection carries ACTION_FAILED from the closed set, and stays retryable", async () => {
  const result = await executeContentAction(
    { commandId: "cmd-wait", actionType: "web.dom.wait_for_text", text: "Saved" },
    dependencies({ waitForCondition: rejectLater })
  );

  // ACTION_FAILED, not UNKNOWN. The set draws the line at whether anything said
  // why: UNKNOWN means the producer could not determine a cause, and a verb
  // that threw an Error did determine one and put it in the message -- it is
  // just a cause no code names, which is what `web.action.failed` is for.
  //
  // The distinction is not cosmetic: ACTION_FAILED is retryable and UNKNOWN is
  // not, so the choice decides whether Core may try the step again. A rejection
  // out of a verb is overwhelmingly a transient page condition -- a node
  // detached mid-action, a frame torn down by a navigation that landed while
  // the action was running -- and a retry on the settled page is exactly the
  // right response. Reporting UNKNOWN would make every one of them a hard stop.
  assert.deepEqual(result.failure, webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.ACTION_FAILED, { actual: DETACHED }));
  assert.equal(result.failure?.code, "web.action.failed");
  assert.equal(result.failure?.category, "action_failed");
  assert.equal(result.failure?.retryable, true);
  assert.equal(result.failure?.stage, "execution");
  assert.ok(isWebAutomationFailureCode(result.failure?.code));
  // Core drops a record it refuses whole, taking the failure with it.
  assert.deepEqual(parseAutomationStudioFailureRecord(result.failure), result.failure);
});

test("no action type can leave the background worker without a reply", async () => {
  // Every type the domain declares, not only the ones this file routes: the
  // three `web.browser.*` types the background worker runs fall through to the
  // dispatcher's throw, and a type added to the domain without a branch here
  // must still answer. Iterating the domain's own list is what keeps this row
  // exhaustive as the vocabulary grows.
  for (const actionType of WEB_AUTOMATION_ACTION_TYPES) {
    const command: BrowserActionCommand = {
      commandId: `cmd-${actionType}`,
      actionType,
      selector: "#target",
      assert: { kind: "text", expected: "Done" },
      dialog: { response: "accept" },
      extractList: { item: ".row", fields: { name: ".name" } }
    };
    const deps = dependencies({ waitForCondition: rejectLater, evaluateAssertion: rejectLater, extractList: rejectLater });

    // A rejection here is the bug itself, so it is caught and reported as the
    // thing it means -- an unanswered command -- rather than surfacing as a
    // bare error from whichever verb happened to be routed.
    let result: BrowserActionResult;
    try {
      result = await executeContentAction(command, deps);
    } catch (error) {
      throw new Error(`${actionType} left the command unanswered: ${String(error)}`);
    }

    assert.equal(result.status, "failed", actionType);
    // A code from the closed set, whichever one: this row is about answering at
    // all, and which code each type lands on is the next test's subject.
    assert.ok(isWebAutomationFailureCode(result.failure?.code), `${actionType}: ${String(result.failure?.code)}`);
    assert.deepEqual(parseAutomationStudioFailureRecord(result.failure), result.failure, actionType);
  }
});

test("an unsupported action type is refused as unretryable, and a verb that rejects stays retryable", async () => {
  // The two ways the dispatcher's catch is reached, and the reason they must
  // not answer with the same code: `retryable` is what Core's retry path reads.
  //
  // A verb that rejected almost always hit a transient page condition -- a node
  // detached mid-action, a frame torn down by a navigation that landed while
  // the action ran -- and a retry against the settled page is the right answer,
  // so it stays ACTION_FAILED. An action type this build has no branch for will
  // refuse identically however many times it is sent, so reporting it as a
  // failed action buys nothing but a full retry cycle before the same refusal.
  //
  // `web.browser.navigate` is the realistic instance rather than an invented
  // string: it is a real member of the domain's vocabulary that the background
  // worker runs, so reaching this frame means it was misrouted, not that the
  // vocabulary is unknown.
  const unsupported = await executeContentAction(
    { commandId: "cmd-unsupported", actionType: "web.browser.navigate" },
    dependencies()
  );
  assert.equal(unsupported.status, "failed");
  assert.equal(unsupported.failure?.code, WEB_AUTOMATION_FAILURE_CODES.UNSUPPORTED_TYPE);
  assert.equal(unsupported.failure?.code, "web.action.unsupported_type");
  assert.equal(unsupported.failure?.category, "blocked_by_capability_or_policy");
  assert.equal(unsupported.failure?.retryable, false);
  // `dispatch`, because nothing ran: the refusal happened before the page was
  // touched, which is what separates it from an execution-stage failure.
  assert.equal(unsupported.failure?.stage, "dispatch");
  assert.ok(unsupported.failure?.actual?.includes("web.browser.navigate"), String(unsupported.failure?.actual));
  // Core drops a record it refuses whole, taking the failure with it.
  assert.deepEqual(parseAutomationStudioFailureRecord(unsupported.failure), unsupported.failure);

  const rejected = await executeContentAction(
    { commandId: "cmd-rejected", actionType: "web.dom.wait_for_selector", selector: "#save" },
    dependencies({ waitForCondition: rejectLater })
  );
  assert.equal(rejected.status, "failed");
  assert.equal(rejected.failure?.code, WEB_AUTOMATION_FAILURE_CODES.ACTION_FAILED);
  assert.equal(rejected.failure?.retryable, true);

  // The point of the row: one catch, two answers. If the unsupported-type path
  // ever falls back to a bare `Error` again it collapses onto ACTION_FAILED and
  // these two lines are what notice.
  assert.notEqual(unsupported.failure?.code, rejected.failure?.code);
  assert.notEqual(unsupported.failure?.retryable, rejected.failure?.retryable);
});

test("awaiting a branch does not change what a caller sees when the verb succeeds", async () => {
  // The fix must be invisible to everything except a rejection. A verb's result
  // reaches the caller as the very object the verb built -- not copied, not
  // re-timed, not wrapped -- so nothing downstream can tell an awaited branch
  // from a returned one.
  const built: BrowserActionResult = {
    commandId: "cmd-ok",
    actionType: "web.dom.wait_for_selector",
    status: "succeeded",
    validation: { status: "passed", expected: "an element matching #save", actual: "#save is present" },
    message: "Selector found.",
    startedAt: 1,
    finishedAt: 2
  };
  const result = await executeContentAction(
    { commandId: "cmd-ok", actionType: "web.dom.wait_for_selector", selector: "#save" },
    dependencies({
      waitForCondition: () => Promise.resolve({ ok: true as const, condition: "present" as const, actual: "#save is present", waitedMs: 3 }),
      captureSnapshot: () => ({
        url: "https://example.test/order",
        title: "Order",
        viewport: { width: 1280, height: 720, scrollX: 0, scrollY: 0 },
        interactiveElements: []
      }),
      success: () => built
    })
  );
  assert.equal(result, built);
});
