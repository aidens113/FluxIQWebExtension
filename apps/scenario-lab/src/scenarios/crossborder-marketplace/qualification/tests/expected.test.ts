import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { CROSSBORDER_MARKETPLACE_LIVE_TASKS } from "../../live-tasks.js";
import { crossborderMarketplaceManifest } from "../../manifest/index.js";
import { couponOnlyExpected } from "../index.js";

test("the coupon-only dataset also demands no platform coupon, checkout, cart or order", () => {
  const task = CROSSBORDER_MARKETPLACE_LIVE_TASKS.find(({ id }) => id === "crossborder-marketplace-collect-official-coupon-only")!;
  const resolved = resolveScenarioWorkflow(crossborderMarketplaceManifest, { workflowId: "collect-official-coupon-only" });
  assert.equal(task.judgeBy, "expected-dataset");
  assert.deepEqual(resolved.expected, couponOnlyExpected);
  assert.equal(task.expectedDatasetId, resolved.expected.extracted![0]!.step);
  assert.deepEqual(resolved.expected.extracted![0]!.records, [{ coupon: "Store coupons: Voltbay Official Store 2,00 € off orders over 25,00 €" }]);
  assert.deepEqual(JSON.parse(String(resolved.expected.finalState!.find(({ subject }) => subject === "coupon-only-account")!.value)), { platformCoupon: false, checkoutOpen: false, orders: 0 });
  assert.ok(!resolved.recordingScript.some(({ target }) => target === 'text="Buy now"' || target === "testid:add-to-cart"));
});
