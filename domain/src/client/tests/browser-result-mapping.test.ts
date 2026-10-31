// The gateway result a content result becomes (`../browser-result-mapping.ts`):
// the one builder the extension's background answers a live command with and
// the offline reevaluator answers a changed read with. Moved here from the
// extension's `runtime/result-mapping.ts` (t749) with its rows.

import assert from "node:assert/strict";
import { test } from "node:test";
import { parseAutomationStudioFailureRecord } from "fluxiq/automation-studio";
import type { JsonObject } from "fluxiq/core";
import type { WebAutomationActionResult } from "../../actions/types";
import { WEB_AUTOMATION_FAILURE_CODES, webAutomationFailureRecord } from "../../runtime/failure";
import { gatewayActionResultFromBrowserResult } from "../browser-result-mapping";

function browserResult(overrides: Partial<WebAutomationActionResult> = {}): WebAutomationActionResult {
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

test("actionability uses only the existing open payload and keeps legacy gateway keys unchanged", () => {
  const legacy = browserResult({ message: "Clicked." });
  const baseline = gatewayActionResultFromBrowserResult(legacy);
  for (const actionability of [{ actionable: true }, { actionable: false, cause: "hidden" }, { actionable: false, cause: "disabled" }, { actionable: false, cause: "covered" }] as const) {
    const original = browserResult({ ...legacy, actionability });
    const wire = gatewayActionResultFromBrowserResult(original);
    assert.deepEqual(Object.keys(wire).sort(), Object.keys(baseline).sort());
    assert.equal("actionability" in wire, false);
    assert.deepEqual(wire.payload?.actionability, actionability);
    assert.notEqual(wire.payload?.actionability, actionability);
    assert.equal(wire.status, baseline.status);
    assert.equal(wire.failure, baseline.failure);
    assert.equal(original.actionability, actionability);
  }
  assert.equal(baseline.payload?.actionability, undefined, "old browsers have no invented measurement");
  const malformed = Object.assign(browserResult(), { actionability: { actionable: false, cause: "covered", text: "private_actionability" } });
  const wire = gatewayActionResultFromBrowserResult(malformed);
  assert.equal(wire.payload?.actionability, undefined);
  assert.doesNotMatch(JSON.stringify(wire), /private_actionability/u);
  let getters = 0;
  const getter = Object.defineProperty(browserResult(), "actionability", {
    get() {
      getters += 1;
      throw new Error("private");
    }
  });
  assert.equal(gatewayActionResultFromBrowserResult(getter).status, "succeeded");
  assert.equal(getters, 0);
});

const button: JsonObject = { tagName: "button", selector: "#buy", name: "Buy now", bounds: { x: 10, y: 20, width: 80, height: 30 } };

test("a snapshot's structure detection reaches the gateway payload, copied without anything a producer added", () => {
  const structure = {
    ok: true as const,
    proposal: {
      container: '[data-testid="product-list"]',
      item: '[data-testid="product-card"]',
      itemCount: 8,
      fields: [{ key: "product-name", label: "product-name", spec: { kind: "text" as const, selector: '[data-testid="product-name"]', required: true }, coverage: 1 }],
      pagination: { next: '[data-testid="pagination-next"]', maxPages: 3 },
      confidence: 1
    }
  };
  const noisy = { ...structure, sample: "Ember Scented Candle" };
  const result = gatewayActionResultFromBrowserResult(browserResult({ actionType: "web.dom.capture_snapshot", structure: noisy }));
  assert.deepEqual(result.payload?.structure, structure);
  assert.equal(JSON.stringify(result).includes("Ember Scented Candle"), false);
  const refused = gatewayActionResultFromBrowserResult(browserResult({ actionType: "web.dom.capture_snapshot", structure: { ok: false, refused: "sensitive_region" } }));
  assert.deepEqual(refused.payload?.structure, { ok: false, refused: "sensitive_region" });
});

test("a robot check that cleared by itself reaches the gateway payload as checkWait, and nothing is said when none did", () => {
  const waited = gatewayActionResultFromBrowserResult(browserResult({ checkWait: { waitedMs: 8_412 } }));
  assert.deepEqual(waited.payload?.checkWait, { waitedMs: 8_412 });
  const navigated = gatewayActionResultFromBrowserResult(browserResult({ actionType: "web.browser.navigate", checkWait: { waitedMs: 5_020 } }));
  assert.deepEqual(navigated.payload?.checkWait, { waitedMs: 5_020 });
  assert.equal("checkWait" in (gatewayActionResultFromBrowserResult(browserResult()).payload ?? {}), false);
  // Bounded on the way out: a wait past ten minutes is a malformed result, not a long wait.
  assert.equal("checkWait" in (gatewayActionResultFromBrowserResult(browserResult({ checkWait: { waitedMs: 600_001 } })).payload ?? {}), false);
});

test("gateway evidence carries only the worker's bounded tab and frame identity", () => {
  const result = browserResult({ actionType: "web.dom.capture_snapshot" });
  assert.equal(gatewayActionResultFromBrowserResult(result, { tabId: 17 }).payload?.sourceId, "tab:17:frame:0");
  assert.equal(gatewayActionResultFromBrowserResult(result, { tabId: 17, frameId: 4 }).payload?.sourceId, "tab:17:frame:4");
  assert.notEqual(gatewayActionResultFromBrowserResult(result, { tabId: 18 }).payload?.sourceId, gatewayActionResultFromBrowserResult(result, { tabId: 17 }).payload?.sourceId);
  for (const source of [undefined, {}, { tabId: -1 }, { tabId: NaN }, { tabId: 1.5 }, { tabId: 17, frameId: -1 }]) {
    assert.equal("sourceId" in (gatewayActionResultFromBrowserResult(result, source).payload ?? {}), false);
  }
  const pageSupplied = Object.assign({}, result, { sourceId: "tab:999:frame:0" });
  assert.equal("sourceId" in (gatewayActionResultFromBrowserResult(pageSupplied).payload ?? {}), false, "page fields cannot invent a trusted resource");
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
  // Built the way a producer builds it, so the category, the retryable flag
  // and the stage cannot drift away from the code's own row.
  const failure = webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.OUTPUT_NOT_OBSERVED, {
    expected: "the field to read back \"shoes\"",
    actual: "the field is empty"
  });
  const result = gatewayActionResultFromBrowserResult(browserResult({ status: "failed", message: "Value not observed.", failure }));
  assert.deepEqual(result.failure, failure);
  assert.deepEqual(parseAutomationStudioFailureRecord(result.failure), failure, "what reaches the wire survives Core's parser");
});

test("a result with no failure record sends none, rather than an empty one", () => {
  const result = gatewayActionResultFromBrowserResult(browserResult({ message: "Clicked." }));
  assert.equal("failure" in result, false);
});

test("the snapshot's page evidence and the descriptors' activity flags reach the gateway payload", () => {
  // The builder hands the snapshot to the domain payload builder whole, which
  // is what carries the page evidence and each descriptor's activity flags; a
  // builder that started copying field by field would drop the lot silently.
  const evidence: JsonObject = {
    elements: { scanned: 900, candidates: 120, matched: 40, returned: 40, truncated: false, changed: 2, recentlyInteracted: 1 },
    loading: { documentState: "complete", busy: false, busyRegions: [], indicators: [], pendingNavigation: false },
    navigation: { url: "https://example.test/cart", origin: "https://example.test", path: "/cart", historyLength: 3, visibility: "visible" },
    dialogs: { open: [{ selector: "#confirm", role: "dialog", modal: true, native: false }], modal: true },
    repeating: [{ containerSelector: "#items", signature: "li||item-#|row", itemCount: 12, representative: { selector: "#items > li:nth-of-type(1)", testId: "item-1" } }]
  };
  const changedButton: JsonObject = { ...button, changed: true, recentlyInteracted: true };
  const snapshot: JsonObject = {
    url: "https://example.test/cart",
    title: "Cart",
    viewport: { width: 1_280, height: 720, scrollX: 0, scrollY: 0 },
    interactiveElements: [changedButton],
    evidence
  };
  const result = gatewayActionResultFromBrowserResult(browserResult({ element: changedButton, snapshot }));
  const payloadSnapshot = result.payload?.snapshot;
  assert.ok(payloadSnapshot && typeof payloadSnapshot === "object" && !Array.isArray(payloadSnapshot));
  assert.deepEqual(payloadSnapshot["evidence"], evidence, "the page evidence is carried, not summarized away");
  assert.deepEqual(payloadSnapshot["interactiveElements"], [changedButton], "the activity flags travel with the descriptors");
  assert.deepEqual(result.payload?.element, changedButton);
});

test("timed_out and cancelled keep their status and carry their message as the error", () => {
  for (const status of ["timed_out", "cancelled", "unknown"] as const) {
    const result = gatewayActionResultFromBrowserResult(browserResult({ status, message: "The wait ran out of time." }));
    assert.equal(result.status, status, status);
    assert.equal(result.error, "The wait ran out of time.", status);
  }
});

test("cleared waits reach the generic gateway field for success and failure, screened to milliseconds", () => {
  for (const status of ["succeeded", "failed", "timed_out", "cancelled"] as const) {
    const result = gatewayActionResultFromBrowserResult(browserResult({ status, checkWait: { waitedMs: 12 } }));
    assert.deepEqual(result.clearedWait, { waitedMs: 12 });
  }
  assert.equal("clearedWait" in gatewayActionResultFromBrowserResult(browserResult()), false);
  assert.equal("clearedWait" in gatewayActionResultFromBrowserResult(browserResult({ checkWait: { waitedMs: -1 } })), false);
});
