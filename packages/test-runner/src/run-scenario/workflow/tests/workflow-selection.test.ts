import assert from "node:assert/strict";
import test from "node:test";
import { workflowSelection } from "../workflow-selection.js";

test("a selection carries only the ids the run actually named", () => {
  assert.deepEqual(workflowSelection({}), {}, "a run that named neither selects the primary workflow unarmed");
  assert.deepEqual(workflowSelection({ workflowId: "search" }), { workflowId: "search" });
  assert.deepEqual(workflowSelection({ variantId: "expired" }), { variantId: "expired" });
  assert.deepEqual(workflowSelection({ workflowId: "search", variantId: "expired" }), { workflowId: "search", variantId: "expired" });
});

/**
 * The reason this is a function and not a spread at each call site. Under
 * `exactOptionalPropertyTypes` a present-but-undefined key is a different value
 * from an absent one, and the contract's resolvers read absence as "the primary
 * workflow" -- so a selection built by hand from `{ workflowId: options.workflowId }`
 * asks for a workflow whose id is `undefined` and is refused.
 */
test("an absent id is absent from the selection, never present holding undefined", () => {
  assert.equal("workflowId" in workflowSelection({ variantId: "expired" }), false);
  assert.equal("variantId" in workflowSelection({ workflowId: "search" }), false);
});
