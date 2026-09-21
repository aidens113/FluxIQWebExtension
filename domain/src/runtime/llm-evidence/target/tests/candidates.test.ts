import assert from "node:assert/strict";
import test from "node:test";
import type { WebLlmEvidenceElement } from "../../elements";
import { projectWebRepairCandidates, WEB_REPAIR_CANDIDATE_LIMIT } from "../candidates";

const elements: WebLlmEvidenceElement[] = [
  { target: "target.1", tag: "button", name: "Save", form: "settings" },
  { target: "target.2", tag: "input", name: "Account", changed: true },
  { target: "target.3", tag: "select", name: "Plan", focused: true },
  { target: "target.4", tag: "div", name: "Status" },
];

test("known action ranks only compatible opaque handles", () => {
  const projected = projectWebRepairCandidates(elements, { definitionId: "web.output.dom-click" }, 1_024);
  assert.deepEqual(projected, {
    schemaVersion: "web-repair-candidates.v1",
    status: "ranked",
    action: "known",
    parameter: "element",
    role: "clickable",
    candidates: [
      { target: "target.3", match: "compatible" },
      { target: "target.2", match: "compatible" },
      { target: "target.1", match: "compatible" },
    ],
    refusals: [{ category: "incompatible", count: 1 }],
  });
});
test("recorded action keeps semantic priority and names closed possible roles", () => {
  const projected = projectWebRepairCandidates(elements, { definitionId: "builtin.policy.action" }, 1_024)!;
  assert.deepEqual(projected.candidates.map(candidate => candidate.target), ["target.3", "target.2", "target.1"]);
  assert.deepEqual(projected.candidates[0], { target: "target.3", match: "action_unknown", roles: ["selectable", "clickable", "keyable", "observable"] });
  assert.deepEqual(projected.refusals, [{ category: "incompatible", count: 1 }]);
  assert.doesNotMatch(JSON.stringify(projected), /Save|Account|Plan|Status|selector|html/u);
});

test("projection is capped by count and serialized bytes", () => {
  const many = Array.from({ length: 20 }, (_, index): WebLlmEvidenceElement => ({ target: `target.${index + 1}`, tag: "button", name: `Action ${index + 1}` }));
  const projected = projectWebRepairCandidates(many, { definitionId: "builtin.policy.action" }, 520)!;
  assert.ok(projected.candidates.length <= WEB_REPAIR_CANDIDATE_LIMIT);
  assert.ok(Buffer.byteLength(JSON.stringify(projected), "utf8") <= 520);
  assert.equal(projected.refusals.find(item => item.category === "limit")?.count, 20 - projected.candidates.length);
});

test("an action with no repair seam returns only a closed refusal", () => {
  assert.deepEqual(projectWebRepairCandidates(elements, { definitionId: "web.output.browser-navigate" }, 1_024), {
    schemaVersion: "web-repair-candidates.v1",
    status: "action_not_repairable",
    action: "not_repairable",
    parameter: "element",
    candidates: [],
    refusals: [{ category: "action_not_repairable", count: 1 }],
  });
});
