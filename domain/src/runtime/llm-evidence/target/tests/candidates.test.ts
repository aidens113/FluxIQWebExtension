import assert from "node:assert/strict";
import test from "node:test";
import type { WebLlmEvidenceElement } from "../../elements";
import { projectWebRepairCandidates } from "../candidates";

const elements: WebLlmEvidenceElement[] = [
  { target: "target.1", tag: "button", name: "Save", form: "settings" },
  { target: "target.2", tag: "input", name: "Account", changed: true },
  { target: "target.3", tag: "select", name: "Plan", focused: true },
  { target: "target.4", tag: "div", name: "Status" },
];

test("a known action lists every compatible opaque handle, in document order, scoring none of them", () => {
  const projected = projectWebRepairCandidates(elements, { definitionId: "web.output.dom-click" });
  assert.deepEqual(projected, {
    schemaVersion: "web-repair-candidates.v2",
    status: "listed",
    action: "known",
    parameter: "element",
    role: "clickable",
    // Focus, change and recency once ranked these; the page's order is kept.
    candidates: [
      { target: "target.1", match: "compatible" },
      { target: "target.2", match: "compatible" },
      { target: "target.3", match: "compatible" },
    ],
    refusals: [{ category: "incompatible", count: 1 }],
  });
});

test("a recorded action lists every candidate in document order and names the closed roles each could fill", () => {
  const projected = projectWebRepairCandidates(elements, { definitionId: "builtin.policy.action" });
  assert.deepEqual(projected.candidates.map((candidate) => candidate.target), ["target.1", "target.2", "target.3"]);
  assert.deepEqual(projected.candidates[2], { target: "target.3", match: "action_unknown", roles: ["selectable", "clickable", "keyable", "observable"] });
  assert.deepEqual(projected.refusals, [{ category: "incompatible", count: 1 }]);
  assert.doesNotMatch(JSON.stringify(projected), /Save|Account|Plan|Status|selector|html/u);
});

test("every compatible element is a candidate: no count and no byte size cuts the list", () => {
  const many = Array.from({ length: 500 }, (_, index): WebLlmEvidenceElement => ({ target: `target.${index + 1}`, tag: "button", name: `Action ${index + 1}` }));
  const projected = projectWebRepairCandidates(many, { definitionId: "builtin.policy.action" });
  assert.equal(projected.candidates.length, 500);
  assert.deepEqual(projected.candidates.map((candidate) => candidate.target), many.map((element) => element.target));
  assert.deepEqual(projected.refusals, []);
});

test("an action with no repair seam returns only a closed refusal", () => {
  assert.deepEqual(projectWebRepairCandidates(elements, { definitionId: "web.output.browser-navigate" }), {
    schemaVersion: "web-repair-candidates.v2",
    status: "action_not_repairable",
    action: "not_repairable",
    parameter: "element",
    candidates: [],
    refusals: [{ category: "action_not_repairable", count: 1 }],
  });
});
