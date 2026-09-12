// The byte budgets. Two consumers, two defaults, one ceiling -- and the
// failure path's number is Core's own, so a Core change reaches this packet
// instead of silently invalidating it.

import assert from "node:assert/strict";
import test from "node:test";
import { AUTOMATION_STUDIO_LLM_MAX_FAILURE_EVIDENCE_BYTES, sanitizeAutomationStudioLlmFailureEvidence } from "fluxiq/automation-studio";
import type { JsonObject } from "fluxiq/core";
import { sanitizeWebLlmSnapshot, WEB_LLM_EVIDENCE_BOUNDS, WEB_LLM_EVIDENCE_BYTE_BUDGETS, type WebLlmPageEvidence } from "..";

const bytes = (value: unknown): number => new TextEncoder().encode(JSON.stringify(value)).byteLength;

const largePage = (count: number): Record<string, unknown> => ({
  url: "https://example.test/large",
  title: "Large fixture",
  interactiveElements: Array.from({ length: count }, (_, index) => ({
    tagName: "button",
    selector: `[data-index="${index}"]`,
    visibleText: `Item ${index} ${"x".repeat(120)}`,
  })),
});

test("the failure budget is Core's own gate, and the exploration budget sits under the shared ceiling", () => {
  assert.equal(WEB_LLM_EVIDENCE_BYTE_BUDGETS.failure, AUTOMATION_STUDIO_LLM_MAX_FAILURE_EVIDENCE_BYTES);
  assert.equal(WEB_LLM_EVIDENCE_BYTE_BUDGETS.failure, 3_000);
  assert.equal(WEB_LLM_EVIDENCE_BYTE_BUDGETS.exploration, 6_000);
  assert.equal(WEB_LLM_EVIDENCE_BYTE_BUDGETS.ceiling, 12_000);
  assert.equal(WEB_LLM_EVIDENCE_BYTE_BUDGETS.failure < WEB_LLM_EVIDENCE_BYTE_BUDGETS.exploration, true);
  assert.equal(WEB_LLM_EVIDENCE_BYTE_BUDGETS.exploration < WEB_LLM_EVIDENCE_BYTE_BUDGETS.ceiling, true);
});

test("applies each path's default when the caller names no budget", () => {
  const exploration = sanitizeWebLlmSnapshot(largePage(60));
  assert.equal(bytes(exploration) <= WEB_LLM_EVIDENCE_BYTE_BUDGETS.exploration, true, `${bytes(exploration)} bytes`);
  const failure = sanitizeWebLlmSnapshot(largePage(60), { budget: "failure" });
  assert.equal(bytes(failure) <= WEB_LLM_EVIDENCE_BYTE_BUDGETS.failure, true, `${bytes(failure)} bytes`);
  assert.equal(failure.elements.length < exploration.elements.length, true);
});

test("clamps a request above the path's ceiling instead of honouring it", () => {
  // Core's parser drops a failure packet over its gate whole, taking the
  // diagnosis with it, so a host asking for more must still get 3,000.
  const failure = sanitizeWebLlmSnapshot(largePage(60), { budget: "failure", maxEvidenceBytes: 9_000 });
  assert.equal(bytes(failure) <= WEB_LLM_EVIDENCE_BYTE_BUDGETS.failure, true, `${bytes(failure)} bytes`);
  const exploration = sanitizeWebLlmSnapshot(largePage(60), { maxEvidenceBytes: 50_000 });
  assert.equal(bytes(exploration) <= WEB_LLM_EVIDENCE_BYTE_BUDGETS.ceiling, true, `${bytes(exploration)} bytes`);
});

test("refuses a budget that is not a positive bounded integer rather than falling back silently", () => {
  for (const maxEvidenceBytes of [0, -1, 1.5, 100_001, Number.NaN]) {
    assert.throws(() => sanitizeWebLlmSnapshot(largePage(2), { maxEvidenceBytes }), /positive bounded integer/u, `budget ${maxEvidenceBytes}`);
  }
});

test("reports truncation and the element count exactly at the budget boundary", () => {
  const page = largePage(12);
  const whole = sanitizeWebLlmSnapshot(page, { maxEvidenceBytes: WEB_LLM_EVIDENCE_BYTE_BUDGETS.ceiling });
  assert.equal(whole.elements.length, 12);
  assert.equal(whole.truncated, false);

  const exact = sanitizeWebLlmSnapshot(page, { maxEvidenceBytes: bytes(whole) });
  assert.equal(exact.elements.length, 12);
  assert.equal(exact.truncated, false);
  assert.equal(bytes(exact), bytes(whole));

  const oneShort = sanitizeWebLlmSnapshot(page, { maxEvidenceBytes: bytes(whole) - 1 });
  assert.equal(oneShort.elements.length, 11);
  assert.equal(oneShort.truncated, true);
  assert.equal(bytes(oneShort) <= bytes(whole) - 1, true);
});

test("gives up page facts before the last element, and refuses only when nothing is left to drop", () => {
  const page = {
    url: "https://example.test/checkout",
    title: "Checkout",
    selectedText: "order reference 4471",
    loading: { readyState: "interactive" },
    dialogs: [{ role: "dialog", name: "Confirm your order", modal: true }],
    interactiveElements: [
      { tagName: "button", selector: "#place-order", visibleText: "Place order" },
      { tagName: "button", selector: "#cancel", visibleText: "Cancel" },
    ],
  };
  // Each step asks for one byte less than the previous packet needed, so the
  // trim ladder is forced to give up exactly one more thing. The dialog
  // standing in front of the page outlives the selection, the title and the
  // loading state, because it is what explains a failed click.
  const rung = (budget: number) => sanitizeWebLlmSnapshot(page, { maxEvidenceBytes: budget });
  const shape = (evidence: ReturnType<typeof rung>) => ({
    elements: evidence.elements.length,
    selectedText: evidence.selectedText !== undefined,
    title: evidence.title !== undefined,
    loading: evidence.loading !== undefined,
    dialogs: evidence.dialogs !== undefined,
    truncated: evidence.truncated,
  });

  const whole = rung(WEB_LLM_EVIDENCE_BYTE_BUDGETS.ceiling);
  assert.deepEqual(shape(whole), { elements: 2, selectedText: true, title: true, loading: true, dialogs: true, truncated: false });
  const oneElement = rung(bytes(whole) - 1);
  assert.deepEqual(shape(oneElement), { elements: 1, selectedText: true, title: true, loading: true, dialogs: true, truncated: true });
  const noSelection = rung(bytes(oneElement) - 1);
  assert.deepEqual(shape(noSelection), { elements: 1, selectedText: false, title: true, loading: true, dialogs: true, truncated: true });
  const noTitle = rung(bytes(noSelection) - 1);
  assert.deepEqual(shape(noTitle), { elements: 1, selectedText: false, title: false, loading: true, dialogs: true, truncated: true });
  const noLoading = rung(bytes(noTitle) - 1);
  assert.deepEqual(shape(noLoading), { elements: 1, selectedText: false, title: false, loading: false, dialogs: true, truncated: true });
  const noDialogs = rung(bytes(noLoading) - 1);
  assert.deepEqual(shape(noDialogs), { elements: 1, selectedText: false, title: false, loading: false, dialogs: false, truncated: true });
  const nothing = rung(bytes(noDialogs) - 1);
  assert.deepEqual(shape(nothing), { elements: 0, selectedText: false, title: false, loading: false, dialogs: false, truncated: true });

  assert.throws(() => rung(bytes(nothing) - 1), /exceeds the evidence byte limit/u);
});

test("a failure packet passes Core's failure-evidence gate whole", () => {
  const evidence = sanitizeWebLlmSnapshot({
    url: "https://example.test/checkout?session=private",
    title: "Checkout",
    frame: { isTop: true },
    selectedText: "order reference 4471",
    loading: { readyState: "interactive", busy: true },
    navigation: { pending: true, to: "https://example.test/receipt" },
    dialogs: [{ role: "dialog", name: "Confirm your order", modal: true, selector: "#confirm" }],
    blockingOverlay: { selector: "#cookie-wall", tagName: "div", name: "We use cookies" },
    elementTotal: 240,
    focusedElement: { tagName: "input", selector: "#coupon", name: "Coupon" },
    interactiveElements: Array.from({ length: 60 }, (_, index) => ({
      tagName: "button",
      selector: `[data-testid="row-${index}"]`,
      name: `Add item ${index}`,
      attributes: { "data-fluxiq-frame-id": index % 2 === 0 ? "0" : "4" },
      context: { formId: "checkout", landmark: "main", heading: "Your basket", listPosition: { index, total: 240 } },
    })),
  }, { budget: "failure" });

  const gated = sanitizeAutomationStudioLlmFailureEvidence("runtime_diagnosis", evidence as unknown as JsonObject);
  assert.deepEqual(gated, JSON.parse(JSON.stringify(evidence)) as WebLlmPageEvidence);
  assert.equal(bytes(gated) <= AUTOMATION_STUDIO_LLM_MAX_FAILURE_EVIDENCE_BYTES, true, `${bytes(gated)} bytes`);
  assert.equal(evidence.truncated, true);
  assert.equal(evidence.elements.length > 0, true);
  assert.equal(evidence.elements.length <= WEB_LLM_EVIDENCE_BOUNDS.elements, true);
  assert.doesNotMatch(JSON.stringify(evidence), /session=private/u);
});
