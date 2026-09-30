// The generated automation and a test run's outcome are read from relays this
// lane does not own, so every shape is checked: unknown becomes undefined, and
// a step line that looks like a selector or an id is never shown.

import assert from "node:assert/strict";
import test from "node:test";
import { generatedPreview } from "../generated-preview";
import { testOutcome } from "../test-outcome";

const wrap = (result: unknown) => ({ ok: true, payload: { result } });

test("a proposal with a Flow previews its name, node labels and ids", () => {
  const preview = generatedPreview(wrap({
    proposal: { id: "prop-1", title: "Reorder coffee" },
    flow: {
      id: "flow-1",
      name: "Reorder coffee beans",
      nodes: [
        { id: "n1", label: "Open shop.example.com" },
        { id: "n2", data: { title: "Search for beans" } },
        { id: "n3", label: "#buy-button" },
        { id: "node_3f2a9c1e" },
        { id: "n5", title: "Add to cart" }
      ]
    }
  }));
  assert.deepEqual(preview, {
    name: "Reorder coffee beans",
    steps: ["Open shop.example.com", "Search for beans", "Add to cart"],
    more: 0,
    proposalId: "prop-1",
    flowId: "flow-1"
  });
});

test("at most eight step lines, with the rest counted", () => {
  const nodes = Array.from({ length: 11 }, (_, index) => ({ label: `Step number ${index + 1}` }));
  const preview = generatedPreview(wrap({ flow: { nodes } }));
  assert.equal(preview?.steps.length, 8);
  assert.equal(preview?.steps[7], "Step number 8");
  assert.equal(preview?.more, 3);
  assert.equal(preview?.name, "Your new automation");
});

test("the Flow may sit under the proposal, and nodes may be a map", () => {
  const preview = generatedPreview(wrap({ proposal: { id: "p", flow: { title: "Check prices", nodes: { a: { label: "Read the price" } } } } }));
  assert.equal(preview?.name, "Check prices");
  assert.deepEqual(preview?.steps, ["Read the price"]);
  assert.equal(preview?.proposalId, "p");
  assert.equal(preview?.flowId, undefined);
});

test("a reply with nothing to preview is undefined", () => {
  for (const reply of [undefined, null, "x", { ok: true }, { ok: true, payload: {} }, { payload: { result: [] } }, wrap({ unrelated: 1 })]) {
    assert.equal(generatedPreview(reply), undefined, JSON.stringify(reply));
  }
});

test("a test outcome reads runSummary.status and interventionCount", () => {
  assert.deepEqual(testOutcome({ ok: true, payload: { runSummary: { status: "succeeded" }, interventionCount: 2 } }), { passed: true, interventions: 2 });
  assert.deepEqual(testOutcome({ ok: true, payload: { runSummary: { status: "failed" }, interventionCount: 0 } }), { passed: false, interventions: 0 });
  assert.deepEqual(testOutcome({ ok: true, payload: { runSummary: "succeeded", interventionCount: "3" } }), { passed: false, interventions: 0 });
  assert.deepEqual(testOutcome({ ok: true, payload: { interventionCount: -1.5 } }), { passed: false, interventions: 0 });
  assert.equal(testOutcome({ ok: true }), undefined);
  assert.equal(testOutcome(undefined), undefined);
});
