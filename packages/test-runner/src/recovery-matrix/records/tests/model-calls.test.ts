import assert from "node:assert/strict";
import test from "node:test";
import { matrixModelCalls } from "../model-calls.js";

test("Core's cost accounting is the count", () => {
  assert.deepEqual(matrixModelCalls({ providerCallCount: 0, llmGate: { invoked: false }, interventions: [] }), { calls: 0, source: "cost-accounting", gateCode: null, interventions: 0, itemizedCalls: 0 });
});

test("a gate that declined and called nothing says zero, with its code", () => {
  assert.deepEqual(matrixModelCalls({ llmGate: { invoked: false, code: "llm.gate.training_mode" }, interventions: [] }), { calls: 0, source: "gate-declined", gateCode: "llm.gate.training_mode", interventions: 0, itemizedCalls: 0 });
});

test("no gate record, or an invoked gate without accounting, is unknown; itemized calls are calls", () => {
  assert.equal(matrixModelCalls({}).calls, null);
  assert.equal(matrixModelCalls({ llmGate: { invoked: true } }).calls, null);
  assert.equal(matrixModelCalls({ llmGate: { invoked: false }, providerCallsOmitted: 2 }).calls, 2);
});
