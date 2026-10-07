import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { BIGBOX_RETAIL_LIVE_TASKS } from "../../live-tasks.js";
import { bigboxRetailManifest } from "../../manifest/index.js";
import { createBigboxState, mutateBigboxState } from "../../state/index.js";
import { soapQuantityAccountFacts, soapQuantityExpected } from "../index.js";

test("soap total three preserves L1/store/nextLine and is idempotent, while incrementing fails", () => {
  const task = BIGBOX_RETAIL_LIVE_TASKS.find(({ id }) => id === "bigbox-retail-ensure-soap-quantity")!;
  const resolved = resolveScenarioWorkflow(bigboxRetailManifest, { workflowId: "ensure-soap-quantity" });
  assert.equal(task.expectedDatasetId, resolved.expected.extracted![0]!.step);
  assert.deepEqual(resolved.expected, soapQuantityExpected);
  const fresh = createBigboxState();
  assert.equal(soapQuantityAccountFacts(fresh), soapQuantityExpected.pageFacts![0]!.value);
  const correct = mutateBigboxState(fresh, "update-qty", { lineId: "L1", qty: 3 });
  assert.equal(soapQuantityAccountFacts(correct), soapQuantityExpected.finalState![0]!.value);
  const repeated = mutateBigboxState(correct, "update-qty", { lineId: "L1", qty: 3 });
  assert.equal(soapQuantityAccountFacts(repeated), soapQuantityAccountFacts(correct));
  assert.deepEqual(repeated.cart, [{ lineId: "L1", productId: "418832007", sku: "5530601", qty: 3, fulfilment: "pickup" }]);
  assert.notEqual(soapQuantityAccountFacts(mutateBigboxState(correct, "update-qty", { lineId: "L1", qty: 5 })), soapQuantityExpected.finalState![0]!.value);
});
