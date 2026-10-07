// T1 coverage of the next-page verb (`../next-page.ts`): how the page's answer
// to a move (`extraction/page-advance/`) becomes the action result contract C1
// declares, and that it survives the domain's field-by-field copy onto the
// wire. The move itself is `extraction/page-advance/tests/move-page.test.ts`.

import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyWebAutomationFailure,
  isWebAutomationFailureCode,
  WEB_AUTOMATION_FAILURE_CODES,
  webAutomationActionResultPayload,
  webAutomationFailureRecord
} from "@fluxiq-web-extension/domain/client";
import type { PageMoveOutcome } from "../../extraction/page-advance";
import { executeContentAction } from "../execute";
import type { ContentActionDependencies } from "../types";
import type { BrowserActionCommand, BrowserActionResult, BrowserActionValidation } from "../../types";

const COMMAND: BrowserActionCommand = {
  commandId: "cmd-next-page",
  actionType: "web.dom.next_page",
  timeoutMs: 30_000,
  nextPage: { item: "[data-card]", pagination: { next: "a[rel=next]" } }
};

/**
 * `results.ts`'s failure builder without the page it reads (as
 * `execute.test.ts` stands it in): the record a thrower attached when its code
 * is one the closed set names, or the classification of the error.
 */
function failure(action: BrowserActionCommand, error: unknown, startedAt = 1): BrowserActionResult {
  const message = error instanceof Error ? error.message : "Action failed.";
  const attached = (error as { failure?: { code?: unknown } } | undefined)?.failure;
  const record = (isWebAutomationFailureCode(attached?.code) ? attached as BrowserActionResult["failure"] : undefined)
    ?? classifyWebAutomationFailure(error, { status: "failed", actionType: action.actionType, message })
    ?? webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.UNKNOWN, { actual: message });
  return { commandId: action.commandId, actionType: action.actionType, status: "failed", validation: { status: "none", reason: "not-yet-validated" }, message, failure: record, startedAt, finishedAt: startedAt + 1 };
}

/** Runs the verb through the dispatcher with the move answering `outcome`, and records what the move was asked. */
async function run(outcome: PageMoveOutcome | Error, command: BrowserActionCommand = COMMAND): Promise<{ result: BrowserActionResult; asked: unknown[] }> {
  const asked: unknown[] = [];
  const result = (status: BrowserActionResult["status"], validation: BrowserActionValidation, message: string): BrowserActionResult => ({
    commandId: command.commandId,
    actionType: command.actionType,
    status,
    message,
    validation,
    startedAt: 1,
    finishedAt: 2
  });
  const deps = {
    nextPage: (request: unknown, options: unknown) => {
      asked.push({ request, options });
      return outcome instanceof Error ? Promise.reject(outcome) : Promise.resolve(outcome);
    },
    success: (_action: unknown, _startedAt: unknown, message: string, validation: BrowserActionValidation) =>
      result(validation.status === "failed" ? "failed" : "succeeded", validation, message),
    timedOut: (_action: unknown, _startedAt: unknown, message: string, validation: BrowserActionValidation) => result("timed_out", validation, message),
    failure
  } as unknown as ContentActionDependencies;
  return { result: await executeContentAction(command, deps), asked };
}

/** The result as it crosses the wire, through the domain's field-by-field copy; the verb sets no element or snapshot. */
function wire(result: BrowserActionResult): ReturnType<typeof webAutomationActionResultPayload> {
  const { element: _element, snapshot: _snapshot, ...rest } = result;
  return webAutomationActionResultPayload(rest);
}

test("a move is asked of the page with the command's request and time", async () => {
  const { asked } = await run({ outcome: "moved", by: "next", page: 2 });
  assert.deepEqual(asked, [{ request: COMMAND.nextPage, options: { timeoutMs: 30_000 } }]);
});

test("a list that moved succeeds with how it moved and the page it shows, and asks no route", async () => {
  const { result } = await run({ outcome: "moved", by: "following", page: 3 });
  assert.equal(result.status, "succeeded");
  assert.deepEqual(result.nextPage, { outcome: "moved", by: "following", page: 3 });
  assert.equal(result.route, undefined);
  assert.deepEqual(wire(result).nextPage, { outcome: "moved", by: "following", page: 3 });
});

test("a list with no next page succeeds down the ended route, with the stop word", async () => {
  const { result } = await run({ outcome: "ended", stop: "control_disabled" });
  assert.equal(result.status, "succeeded");
  assert.deepEqual(result.nextPage, { outcome: "ended", stop: "control_disabled" });
  assert.equal(result.route, "ended");
  const crossed = wire(result);
  assert.equal(crossed.route, "ended");
  assert.deepEqual(crossed.nextPage, { outcome: "ended", stop: "control_disabled" });
});

test("a move that failed fails with the code contract C1 maps its word to", async () => {
  const codes: Array<[PageMoveOutcome & { outcome: "failed" }, string]> = [
    [{ outcome: "failed", stop: "list_unchanged", reason: "The list did not change." }, WEB_AUTOMATION_FAILURE_CODES.OUTPUT_NOT_OBSERVED],
    [{ outcome: "failed", stop: "list_vanished", reason: "The list is gone." }, WEB_AUTOMATION_FAILURE_CODES.OUTPUT_NOT_OBSERVED],
    [{ outcome: "failed", stop: "rate_limited", reason: "Refused as too fast." }, WEB_AUTOMATION_FAILURE_CODES.RATE_LIMITED],
    [{ outcome: "failed", stop: "control_not_clickable", reason: "Not an element." }, WEB_AUTOMATION_FAILURE_CODES.TARGET_NOT_ACTIONABLE],
    [{ outcome: "failed", stop: "page_fault", reason: "The page threw." }, WEB_AUTOMATION_FAILURE_CODES.ACTION_FAILED]
  ];
  for (const [outcome, code] of codes) {
    const { result } = await run(outcome);
    assert.equal(result.status, "failed", outcome.stop);
    assert.equal(result.failure?.code, code, outcome.stop);
    assert.deepEqual(result.nextPage, { outcome: "failed", stop: outcome.stop });
    assert.equal(result.route, undefined);
    assert.equal(result.message, outcome.reason);
  }
});

test("a move that threw is a page_fault, and one out of time is timed out", async () => {
  const { result: threw } = await run(new Error("detached"));
  assert.equal(threw.status, "failed");
  assert.deepEqual(threw.nextPage, { outcome: "failed", stop: "page_fault" });
  const { result: late } = await run({ outcome: "timed_out", reason: "The time ran out." });
  assert.equal(late.status, "timed_out");
  assert.equal(late.nextPage, undefined);
});

test("a command without nextPage parameters fails without touching the page", async () => {
  const { nextPage: _omitted, ...bare } = COMMAND;
  const { result, asked } = await run({ outcome: "moved", by: "next" }, bare);
  assert.equal(result.status, "failed");
  assert.deepEqual(asked, []);
});
