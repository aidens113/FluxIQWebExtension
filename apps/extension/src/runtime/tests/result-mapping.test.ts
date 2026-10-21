// T1 coverage of result-mapping.ts: a gateway command becomes the browser
// command the extension runs, or a rejection carrying Core's failure record,
// answered at once when its action type is unknown. A browser result becomes
// the gateway result through the domain's builder
// (`domain/src/client/browser-result-mapping.ts`), whose rows live beside it.

import assert from "node:assert/strict";
import { test } from "node:test";
import { parseAutomationStudioFailureRecord } from "fluxiq/automation-studio";
import { WEB_AUTOMATION_ACTION_TYPES } from "@fluxiq-web-extension/domain/client";
import type { BrowserActionResult, ClientGatewayActionCommand } from "../../shared/protocol";
import { browserActionFromGatewayCommand, gatewayActionResultFromRejection, isWebAutomationActionRejection } from "../result-mapping";

function command(actionType: string, overrides: Partial<ClientGatewayActionCommand> = {}): ClientGatewayActionCommand & { commandId: string } {
  return { commandId: "cmd-1", actionType, ...overrides };
}

function browserResult(overrides: Partial<BrowserActionResult> = {}): BrowserActionResult {
  return {
    commandId: "cmd-1",
    actionType: "web.dom.click",
    status: "succeeded",
    validation: { status: "none", reason: "not-yet-validated" },
    startedAt: 100,
    finishedAt: 180,
    ...overrides
  };
}

test("an unknown action type becomes a failed gateway result carrying Core's failure record and the requested type", (t) => {
  t.mock.method(Date, "now", () => 7_000);
  const mapped = browserActionFromGatewayCommand(command("web.dom.hover", { parameters: { selector: "#menu" } }));
  assert.ok(isWebAutomationActionRejection(mapped), "the command is rejected, not rewritten into another action");
  assert.match(mapped.message, /web\.dom\.hover/);
  const result = gatewayActionResultFromRejection(mapped);
  assert.deepEqual(result, {
    commandId: "cmd-1",
    status: "failed",
    completedAt: 7_000,
    message: mapped.message,
    error: mapped.message,
    failure: { category: "blocked_by_capability_or_policy", code: "web.action.unsupported_type", retryable: false, stage: "dispatch" },
    metadata: { requestedActionType: "web.dom.hover" }
  });
  // Core drops a failure record its parser refuses, so what reaches the wire must survive it whole.
  assert.deepEqual(parseAutomationStudioFailureRecord(result.failure), result.failure);
});

test("a rejection reports the requested type exactly as it was sent", () => {
  for (const requested of ["", "WEB.DOM.CLICK", "click", "web.dom.hover"]) {
    const mapped = browserActionFromGatewayCommand(command(requested));
    assert.ok(isWebAutomationActionRejection(mapped), `${JSON.stringify(requested)} is rejected`);
    assert.equal(gatewayActionResultFromRejection(mapped).metadata?.requestedActionType, requested);
  }
});

test("a known action type passes through unchanged", () => {
  for (const actionType of WEB_AUTOMATION_ACTION_TYPES) {
    const mapped = browserActionFromGatewayCommand(command(actionType));
    assert.equal(isWebAutomationActionRejection(mapped), false, actionType);
    assert.deepEqual(mapped, { commandId: "cmd-1", actionType, options: {} }, actionType);
  }
});

test("a known command's target and parameters become the browser command's fields", () => {
  const mapped = browserActionFromGatewayCommand(command("web.dom.type", {
    target: { selector: "#q", coordinates: { x: 4, y: 8 } },
    parameters: { text: "shoes", timeoutMs: 2_000 }
  }));
  assert.deepEqual(mapped, {
    commandId: "cmd-1",
    actionType: "web.dom.type",
    selector: "#q",
    text: "shoes",
    timeoutMs: 2_000,
    coordinates: { x: 4, y: 8 },
    options: { text: "shoes", timeoutMs: 2_000 }
  });
});

test("a legacy dotted alias arrives as its canonical type", () => {
  const mapped = browserActionFromGatewayCommand(command("dom.click", { parameters: { selector: "#go" } }));
  assert.equal(isWebAutomationActionRejection(mapped), false);
  assert.equal(mapped.actionType, "web.dom.click");
});

test("a result carrying a record written out by hand does not compile", () => {
  // The protocol's end of the closed set. `BrowserActionResult` is the domain's
  // result bound to this extension's element and snapshot shapes, so its
  // `failure` is the domain's narrowed record and not Core's permissive one --
  // Core types `code` as a bare `string` because it does not own the codes, and
  // that string is what let a record written out at a call site carry anything
  // at all. The structured-failure row (now beside the domain's builder) used to
  // be such a record, and it compiled.
  //
  // `@ts-expect-error` is the assertion: if this ever compiles, the seam has
  // been widened back and `check` says so here. The runtime half is unchanged
  // and still needed -- `content/action-runtime/results.ts` guards a record
  // read off a thrown value, which no compiler can vouch for.
  const result = browserResult({
    status: "failed",
    // @ts-expect-error - "web.assert.state_mismatch" is not one of the closed set's codes
    failure: { category: "unexpected_state", code: "web.assert.state_mismatch", retryable: false, stage: "verification" }
  });
  assert.equal(result.failure?.code, "web.assert.state_mismatch", "the value is still built; it is the type that refuses it");
});
