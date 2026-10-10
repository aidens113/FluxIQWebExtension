import assert from "node:assert/strict";
import test from "node:test";
import { CROSSBORDER_MARKETPLACE_LIVE_TASKS, crossborderMarketplaceManifest } from "../index.js";

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
