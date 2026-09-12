// T1 coverage of result-mapping.ts: a gateway command becomes the browser
// command the extension runs, or a rejection carrying Core's failure record,
// answered at once when its action type is unknown; a browser result becomes
// the gateway result.

import assert from "node:assert/strict";
import { test } from "node:test";
import { parseAutomationStudioFailureRecord } from "fluxiq/automation-studio";
import { WEB_AUTOMATION_ACTION_TYPES } from "@fluxiq-web-extension/domain/client";
import type { PageEvidence } from "../../content/evidence";
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

test("a structured failure reaches the gateway instead of being dropped at the boundary", () => {
  // The content script and the worker both build Core failure records. Until
  // Phase 1.2 step 4 this mapper copied everything but `failure`, so every
  // record was assembled and then thrown away one call short of the wire.
  const failure = {
    category: "output_not_observed" as const,
    code: "web.validation.output_not_observed",
    retryable: true,
    stage: "verification" as const,
    expected: "the field to read back \"shoes\"",
    actual: "the field is empty"
  };
  const result = gatewayActionResultFromBrowserResult(browserResult({ status: "failed", message: "Value not observed.", failure }));
  assert.deepEqual(result.failure, failure);
  assert.deepEqual(parseAutomationStudioFailureRecord(result.failure), failure, "what reaches the wire survives Core's parser");
});

test("a result with no failure record sends none, rather than an empty one", () => {
  const result = gatewayActionResultFromBrowserResult(browserResult({ message: "Clicked." }));
  assert.equal("failure" in result, false);
});

test("the snapshot's page evidence and the descriptors' activity flags reach the gateway payload", () => {
  // Phase 1.4 puts the page-level evidence on the snapshot and two activity
  // flags on each descriptor. Neither is declared on the gateway's own shapes:
  // the mapper hands the snapshot to the domain payload builder whole, which is
  // what carries them, so a mapper that started copying field by field would
  // drop the lot silently and every gate would still pass.
  const evidence: PageEvidence = {
    elements: { scanned: 900, candidates: 120, matched: 40, returned: 40, truncated: false, changed: 2, recentlyInteracted: 1 },
    loading: { documentState: "complete", busy: false, busyRegions: [], indicators: [], pendingNavigation: false },
    navigation: { url: "https://example.test/cart", origin: "https://example.test", path: "/cart", historyLength: 3, visibility: "visible" },
    dialogs: { open: [{ selector: "#confirm", role: "dialog", modal: true, native: false }], modal: true },
    repeating: [{
      containerSelector: "#items",
      signature: "li||item-#|row",
      itemCount: 12,
      representative: { selector: "#items > li:nth-of-type(1)", testId: "item-1" }
    }]
  };
  const changedButton: DomElementDescriptor & { changed?: boolean; recentlyInteracted?: boolean } = {
    ...button,
    changed: true,
    recentlyInteracted: true
  };
  const snapshot = {
    url: "https://example.test/cart",
    title: "Cart",
    viewport: { width: 1_280, height: 720, scrollX: 0, scrollY: 0 },
    interactiveElements: [changedButton],
    evidence
  } satisfies NonNullable<BrowserActionResult["snapshot"]> & { evidence: PageEvidence };

  const result = gatewayActionResultFromBrowserResult(browserResult({ element: changedButton, snapshot }));
  const payloadSnapshot = result.payload?.snapshot;
  assert.ok(payloadSnapshot && typeof payloadSnapshot === "object" && !Array.isArray(payloadSnapshot));
  assert.deepEqual(payloadSnapshot["evidence"], evidence, "the page evidence is carried, not summarized away");
  assert.deepEqual(payloadSnapshot["interactiveElements"], [changedButton], "the activity flags travel with the descriptors");
  assert.deepEqual(result.payload?.element, changedButton);
});

test("timed_out and cancelled keep their status and carry their message as the error", () => {
  // RuntimeStatusTracker shows every non-succeeded result as failed with an
  // error; these two used to reach the gateway with no `error` at all, so the
  // panel and the wire disagreed about the same result (found by
  // w1-extension-unit-tests).
  for (const status of ["timed_out", "cancelled", "unknown"] as const) {
    const result = gatewayActionResultFromBrowserResult(browserResult({ status, message: "The wait ran out of time." }));
    assert.equal(result.status, status, status);
    assert.equal(result.error, "The wait ran out of time.", status);
  }
});
