import assert from "node:assert/strict";
import test from "node:test";
import { replayWorkflowSelection } from "../workflow-selection.js";

/**
 * `lab replay --variant`: the free pre-flight before a paid gate round. A Flow
 * built on the unchanged site is replayed, with no model, against the armed
 * drift, so whether the drift forces a failure is known before anyone pays.
 */
test("the task's own workflow and variant are replayed when no variant is named", () => {
  assert.deepEqual(replayWorkflowSelection({ workflowId: "pickup", variantId: undefined }), { workflowId: "pickup" });
  assert.deepEqual(replayWorkflowSelection({ workflowId: undefined, variantId: "redesigned-buy-box" }), { variantId: "redesigned-buy-box" });
});

test("a named variant is armed in place of the task's own, on the task's workflow", () => {
  assert.deepEqual(replayWorkflowSelection({ workflowId: "pickup", variantId: undefined }, "redesigned-buy-box"), { workflowId: "pickup", variantId: "redesigned-buy-box" });
  assert.deepEqual(replayWorkflowSelection({ workflowId: undefined, variantId: "other-drift" }, "redesigned-buy-box"), { variantId: "redesigned-buy-box" });
});
