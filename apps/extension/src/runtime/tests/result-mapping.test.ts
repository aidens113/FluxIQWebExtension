// T1 coverage of result-mapping.ts: a gateway command becomes the browser
// command the extension runs, or a rejection carrying Core's failure record,
// answered at once when its action type is unknown; a browser result becomes
// the gateway result.

import assert from "node:assert/strict";
import { test } from "node:test";
import { parseAutomationStudioFailureRecord } from "fluxiq/automation-studio";
import { WEB_AUTOMATION_ACTION_TYPES } from "@fluxiq-web-extension/domain/client";
import type { BrowserActionResult, ClientGatewayActionCommand, DomElementDescriptor } from "../../shared/protocol";
import {
  browserActionFromGatewayCommand,
  gatewayActionResultFromBrowserResult,
  gatewayActionResultFromRejection,
  isWebAutomationActionRejection
} from "../result-mapping";

function command(actionType: string, overrides: Partial<ClientGatewayActionCommand> = {}): ClientGatewayActionCommand & { commandId: string } {
  return { commandId: "cmd-1", actionType, ...overrides };
}

function browserResult(overrides: Partial<BrowserActionResult> = {}): BrowserActionResult {
  return { commandId: "cmd-1", actionType: "web.dom.click", status: "succeeded", startedAt: 100, finishedAt: 180, ...overrides };
}

function statePathOf(value: unknown): unknown {
  return value && typeof value === "object" && "statePath" in value ? value.statePath : undefined;
}

const button: DomElementDescriptor = { tagName: "button", selector: "#buy", name: "Buy now", bounds: { x: 10, y: 20, width: 80, height: 30 } };

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

test("a succeeded browser result maps to a gateway result with a target and no error", () => {
  const result = gatewayActionResultFromBrowserResult(browserResult({ message: "Clicked.", element: button }));
  assert.equal(result.commandId, "cmd-1");
  assert.equal(result.status, "succeeded");
  assert.equal(result.startedAt, 100);
  assert.equal(result.completedAt, 180);
  assert.equal(result.message, "Clicked.");
  assert.equal("error" in result, false);
  assert.equal(result.target?.selector, "#buy");
  assert.equal(result.target?.label, "Buy now");
  assert.equal(result.payload?.actionType, "web.dom.click");
  assert.equal(result.payload?.status, "succeeded");
  assert.deepEqual(result.payload?.element, button);
  assert.equal(typeof statePathOf(result.payload?.visualTarget), "string", "a visual target is derived from the element");
});

test("a failed browser result carries its message as the error", () => {
  const result = gatewayActionResultFromBrowserResult(browserResult({ status: "failed", message: "No element matched #buy." }));
  assert.equal(result.status, "failed");
  assert.equal(result.error, "No element matched #buy.");
  assert.equal("target" in result, false, "no element, no target");
  assert.ok(result.payload);
  assert.equal("visualTarget" in result.payload, false, "no element, no visual target");
});

test("an explicit visual target wins over one derived from the element, and extracted data is kept", () => {
  const visualTarget = { namespace: "web" as const, statePath: "web.elements.custom", selector: "#buy" };
  const result = gatewayActionResultFromBrowserResult(browserResult({
    actionType: "web.dom.extract",
    element: button,
    visualTarget,
    extracted: { rows: [{ name: "Lamp", price: "12.00" }] }
  }));
  assert.deepEqual(result.payload?.visualTarget, visualTarget);
  assert.deepEqual(result.payload?.extracted, { rows: [{ name: "Lamp", price: "12.00" }] });
});
