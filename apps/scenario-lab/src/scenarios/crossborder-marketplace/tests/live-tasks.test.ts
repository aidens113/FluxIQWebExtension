import assert from "node:assert/strict";
import test from "node:test";
import { resolveScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { CROSSBORDER_MARKETPLACE_LIVE_TASKS, crossborderMarketplaceManifest } from "../index.js";
import { orderRecord, spainHubRecords } from "../manifest/index.js";

const VARIANT_ID = "basket-redesign";

// A Flow built from chat on the base site meets the redesigned buy bar only at
// playback, so only a repair that re-points the add-to-cart press can pass it.
test("the live catalog builds the hub-to-cart job on the base site and plays it back with the basket redesign", () => {
  const row = CROSSBORDER_MARKETPLACE_LIVE_TASKS.find((task) => task.id === "crossborder-marketplace-hub-to-cart-basket-redesign-after-creation");
  const base = CROSSBORDER_MARKETPLACE_LIVE_TASKS.find((task) => task.id === "crossborder-marketplace-hub-to-cart");
  assert.ok(row && base, "the row is in the catalog");
  assert.deepEqual({ ...row, id: base.id }, { ...base, variantId: VARIANT_ID, variantArmedAfterBuild: true }, "the same instruction and judge as the base row, armed only for playback");
  assert.ok(crossborderMarketplaceManifest.variants?.some((candidate) => candidate.id === VARIANT_ID), "the variant it arms exists");
});

// The build meets the flash-deal promotion as well as the playback, so the
// model can write what the run does about it into the Flow it saves.
test("the live catalog builds and plays the hub-to-cart job with the flash deal armed throughout", () => {
  const row = CROSSBORDER_MARKETPLACE_LIVE_TASKS.find((task) => task.id === "crossborder-marketplace-hub-to-cart-flash-deal-during-build");
  const base = CROSSBORDER_MARKETPLACE_LIVE_TASKS.find((task) => task.id === "crossborder-marketplace-hub-to-cart");
  assert.ok(row && base, "the row is in the catalog");
  assert.deepEqual({ ...row, id: base.id }, { ...base, variantId: "flash-deal" }, "the same instruction and judge as the base row, armed for the build too");
  assert.equal(row.variantArmedAfterBuild, undefined, "not armed only after the build");
  assert.ok(crossborderMarketplaceManifest.variants?.some((candidate) => candidate.id === "flash-deal"), "the variant it arms exists");
});

const instructionOf = (id: string) => {
  const task = CROSSBORDER_MARKETPLACE_LIVE_TASKS.find((candidate) => candidate.id === `crossborder-marketplace-${id}`);
  assert.ok(task, id);
  return task.instruction;
};
const recordsOf = (workflowId: string) => resolveScenarioWorkflow(crossborderMarketplaceManifest, { workflowId }).expected.extracted![0]!.records!;

// The task audit (t709): each instruction names what its exact oracle compares.

test("an answer read off the account flyout is named by the line's own label, which the oracle's value starts with", () => {
  for (const [task, workflowId, column, label] of [
    ["collect-official-coupon-only", "collect-official-coupon-only", "coupon", "Store coupons"],
    ["follow-official-store", "follow-official-store", "following", "Followed stores"],
  ] as const) {
    assert.ok(recordsOf(workflowId)[0]![column]!.startsWith(`${label}: `), `${task}: the oracle keeps the label`);
    assert.ok(instructionOf(task).includes(`"${label}" line`) && instructionOf(task).includes("label included"), `${task}: the instruction asks for the whole line`);
  }
});

test("spain-hubs asks for every item, because a right answer is a docking station whose title never says hub", () => {
  assert.ok(spainHubRecords().some(({ title }) => !/hubs?/iu.test(title!)), "one of the thirteen is titled a docking station");
  for (const id of ["spain-hubs", "spain-hubs-list-layout"]) {
    assert.ok(instructionOf(id).includes("collect every item that ships from Spain"), id);
    assert.ok(!/every hub/u.test(instructionOf(id)), id);
  }
});

test("buy-hub asks for the confirmation's values as written, which is what the order oracle holds", () => {
  assert.equal(orderRecord().options, "Space Grey · 7-in-1 · Ships from Spain");
  assert.ok(instructionOf("buy-hub").includes("written exactly as the confirmation shows them"));
  assert.ok(instructionOf("buy-hub").includes("order (its order ID)") && instructionOf("buy-hub").includes("total (the total paid)"));
});
