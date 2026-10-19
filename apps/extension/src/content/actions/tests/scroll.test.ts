// T1 coverage of the scroll verb's refusal of a request it cannot read
// (`../scroll.ts`, lane 3 `run-mvcvzwk1-c1d869e4`): a scroll request that was
// sent but did not become `action.scroll` -- no mode, an unknown key, or
// `untilStable` without `maxScrolls` -- is INVALID_PARAMETER and moves nothing,
// where it used to run as the legacy absolute move to the node's `x: 0`/`y: 0`
// defaults. A command that sent no request still makes that move.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import {
  classifyWebAutomationFailure,
  isWebAutomationFailureCode,
  WEB_AUTOMATION_FAILURE_CODES,
  webAutomationActionFromGatewayCommand,
  webAutomationFailureRecord
} from "@fluxiq-web-extension/domain/client";
import { scrollAction } from "../scroll";
import type { ContentActionDependencies } from "../types";
import type { BrowserActionCommand, BrowserActionResult, BrowserActionValidation } from "../../types";

/** `results.ts`'s failure builder without the page (as `next-page.test.ts` stands it in). */
function failure(action: BrowserActionCommand, error: unknown, startedAt = 1): BrowserActionResult {
  const message = error instanceof Error ? error.message : "Action failed.";
  const attached = (error as { failure?: { code?: unknown } } | undefined)?.failure;
  const record = (isWebAutomationFailureCode(attached?.code) ? attached as BrowserActionResult["failure"] : undefined)
    ?? classifyWebAutomationFailure(error, { status: "failed", actionType: action.actionType, message })
    ?? webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.UNKNOWN, { actual: message });
  return { commandId: action.commandId, actionType: action.actionType, status: "failed", validation: { status: "none", reason: "not-yet-validated" }, message, failure: record, startedAt, finishedAt: startedAt + 1 };
}

const deps = {
  failure,
  success: (action: BrowserActionCommand, startedAt: number, message: string, validation: BrowserActionValidation): BrowserActionResult => ({
    commandId: action.commandId,
    actionType: action.actionType,
    status: validation.status === "failed" ? "failed" : "succeeded",
    message,
    validation,
    startedAt,
    finishedAt: startedAt + 1
  }),
  captureSnapshot: () => undefined
} as unknown as ContentActionDependencies;

/** A page scrolled to `y` of a 4000-pixel document, recording every move asked of it. */
function page(y: number): { moves: unknown[] } {
  const moves: unknown[] = [];
  const view = {
    scrollX: 0,
    scrollY: y,
    innerWidth: 1000,
    innerHeight: 800,
    scrollTo(options: { left: number; top: number }) {
      moves.push(options);
      view.scrollX = options.left;
      view.scrollY = options.top;
    }
  };
  const documentElement = { scrollHeight: 4000, scrollWidth: 1000 };
  Object.assign(globalThis, { window: view, document: { documentElement, body: documentElement } });
  return { moves };
}

/** The command the domain maps a gateway command to, so the verb meets what the wire sends. */
function command(parameters: JsonObject): BrowserActionCommand {
  const mapped = webAutomationActionFromGatewayCommand({ commandId: "cmd-scroll", actionType: "web.dom.scroll", parameters });
  assert.equal("status" in mapped, false, "the scroll command was rejected before the verb");
  return mapped as unknown as BrowserActionCommand;
}

for (const [name, scroll] of [
  ["a request with no mode", { until: "stopsGrowing" }],
  ["a request with a key it does not have", { mode: "by", y: 640, until: "stopsGrowing" }],
  ["untilStable without maxScrolls", { mode: "untilStable" }],
  ["a mode the verb does not know", { mode: "down" }]
] as const) {
  test(`${name} is refused as INVALID_PARAMETER and moves nothing`, async () => {
    const { moves } = page(1821);
    // Core writes the node's x/y defaults on every scroll step.
    const result = await scrollAction(command({ x: 0, y: 0, smooth: false, scroll }), deps, 1);

    assert.equal(result.status, "failed");
    assert.equal(result.failure?.code, WEB_AUTOMATION_FAILURE_CODES.INVALID_PARAMETER);
    assert.equal(result.failure?.retryable, false);
    assert.deepEqual(moves, [], "the page was not moved");
    assert.match(result.message ?? "", /mode by \(x, y\), toElement, or untilStable \(maxScrolls, y\)/u);
    assert.doesNotMatch(JSON.stringify(result), /stopsGrowing/u, "the value sent is never quoted");
  });
}

test("the refusal names each key that made the request unreadable", async () => {
  page(0);
  const unread = await scrollAction(command({ scroll: { until: "stopsGrowing" } }), deps, 1);
  assert.match(unread.failure?.actual ?? "", /mode is missing; until is not a key a scroll request has/u);

  // social r4 (`run-mvfq957o-40103539`): refused "it names mode", which named nothing missing.
  const missing = await scrollAction(command({ x: 0, y: 0, smooth: false, scroll: { mode: "untilStable" } }), deps, 1);
  assert.match(missing.failure?.actual ?? "", /maxScrolls is missing; untilStable needs it/u);
  assert.doesNotMatch(missing.failure?.actual ?? "", /it names/u);

  const invalid = await scrollAction(command({ scroll: { mode: "untilStable", maxScrolls: 0 } }), deps, 1);
  assert.match(invalid.failure?.actual ?? "", /maxScrolls must be a positive whole number/u);
  assert.match((await scrollAction(command({ scroll: { mode: "down" } }), deps, 1)).failure?.actual ?? "", /mode is not by, toElement or untilStable/u);
});

test("a command that sent no scroll request still makes the legacy absolute move", async () => {
  const { moves } = page(1821);
  const result = await scrollAction(command({ x: 0, y: 300 }), deps, 1);

  assert.equal(result.status, "succeeded");
  assert.deepEqual(moves, [{ left: 0, top: 300, behavior: "instant" }]);
});

test("a request the domain read is run, not refused", async () => {
  const { moves } = page(100);
  const result = await scrollAction(command({ x: 0, y: 0, scroll: { mode: "by", y: 640 } }), deps, 1);

  assert.equal(result.status, "succeeded");
  assert.deepEqual(moves, [{ left: 0, top: 740, behavior: "instant" }]);
});
