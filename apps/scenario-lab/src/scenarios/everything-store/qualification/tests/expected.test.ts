import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { EVERYTHING_STORE_LIVE_TASKS } from "../../live-tasks.js";
import { everythingStoreManifest } from "../../manifest.js";
import { createStoreState, mutateStoreState } from "../../state/index.js";
import { restoreClothsAccountFacts, restoreClothsExpected } from "../index.js";

test("restoring saved S1 differs from adding a new cloth pack with the same active titles", () => {
  const task = EVERYTHING_STORE_LIVE_TASKS.find(({ id }) => id === "everything-store-restore-saved-cloths")!;
  const resolved = resolveScenarioWorkflow(everythingStoreManifest, { workflowId: "restore-saved-cloths" });
  assert.equal(task.expectedDatasetId, resolved.expected.extracted![0]!.step);
  assert.deepEqual(resolved.expected, restoreClothsExpected);
  const fresh = createStoreState(241);
  assert.equal(restoreClothsAccountFacts(fresh), restoreClothsExpected.pageFacts![0]!.value);
  const correct = mutateStoreState(fresh, "move-to-cart", { lineId: "S1" });
  assert.equal(restoreClothsAccountFacts(correct), restoreClothsExpected.finalState![0]!.value);
  const wrong = mutateStoreState(fresh, "add-to-cart", { sku: "B0BAMFC24P", quantity: 1 });
  assert.deepEqual(wrong.cart.map(({ sku, quantity }) => ({ sku, quantity })), correct.cart.map(({ sku, quantity }) => ({ sku, quantity })));
  assert.notEqual(restoreClothsAccountFacts(wrong), restoreClothsExpected.finalState![0]!.value);
  assert.equal(wrong.cart[0]!.lineId, "L3");
  assert.equal(wrong.nextLine, 4);
  assert.deepEqual(correct.saved.map(({ lineId }) => lineId), ["S2"]);
});
