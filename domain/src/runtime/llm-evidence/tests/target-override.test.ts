import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeWebLlmSnapshot, validateWebRuntimeTargetOverrideEvidence } from "..";

test("validates target overrides only when one exact selector has semantics compatible with the failed action", () => {
  const evidence = sanitizeWebLlmSnapshot({
    url: "https://example.test/form",
    interactiveElements: [
      { tagName: "textarea", selector: "#name", name: "Name" },
      { tagName: "select", selector: "#plan", name: "Plan", options: [{ value: "team", label: "Team" }] },
      { tagName: "button", selector: "#unique", name: "Unique" },
      { tagName: "button", selector: ".duplicate", name: "First" },
      { tagName: "button", selector: ".duplicate", name: "Second" },
    ],
  });
  const typeAction = { nodeId: "name", definitionId: "web.output.dom-type" };
  assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(evidence, { selector: "#name" }, typeAction), { status: "matched" });
  assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(evidence, { selector: "#plan" }, typeAction), { status: "resolved", target: { selector: "#name" } });
  assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(evidence, { selector: "#unique" }, typeAction), { status: "resolved", target: { selector: "#name" } });
  assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(evidence, { selector: "#missing" }, typeAction), { status: "resolved", target: { selector: "#name" } });
  assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(evidence, { selector: ".duplicate" }, { nodeId: "submit", definitionId: "web.output.dom-click" }), { status: "ambiguous" });
  assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(evidence, { selector: "#plan" }, { nodeId: "plan", definitionId: "web.output.dom-select" }), { status: "matched" });
  assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(evidence, { selector: "#unique" }, { nodeId: "submit", definitionId: "web.output.dom-click" }), { status: "matched" });

  const noTypeableTarget = sanitizeWebLlmSnapshot({ url: "https://example.test/form", interactiveElements: [{ tagName: "select", selector: "#plan" }] });
  assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(noTypeableTarget, { selector: "#missing" }, typeAction), { status: "absent" });
  const multipleTypeableTargets = sanitizeWebLlmSnapshot({ url: "https://example.test/form", interactiveElements: [{ tagName: "input", selector: "#first" }, { tagName: "textarea", selector: "#second" }] });
  assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(multipleTypeableTargets, { selector: "#missing" }, typeAction), { status: "ambiguous" });
});

test("matches a child-frame target on the selector that works inside its frame", () => {
  const evidence = sanitizeWebLlmSnapshot({
    url: "https://example.test/checkout",
    interactiveElements: [
      { tagName: "input", selector: "frame[3] >> #card-name", name: "Name on card", attributes: { "data-fluxiq-frame-id": "3" } },
    ],
  });
  const typeAction = { nodeId: "card", definitionId: "web.output.dom-type" };
  assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(evidence, { selector: "#card-name" }, typeAction), { status: "matched" });
  assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(evidence, { selector: "frame[3] >> #card-name" }, typeAction), { status: "resolved", target: { selector: "#card-name" } });
});
