import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { AUCTION_MARKETPLACE_LIVE_TASKS } from "../../live-tasks.js";
import { auctionMarketplaceManifest } from "../../manifest.js";
import { createAuctionState } from "../../state.js";
import { accountFacts } from "../index.js";

/**
 * The four breadth tasks' oracles, written out by hand as well as derived from
 * the catalog, so a change to the fixture data that moves an answer has to
 * move it here too, on purpose.
 */
const OWED: Readonly<Record<string, { workflowId: string; records: Array<Record<string, string>> }>> = {
  "auction-marketplace-cheap-accessory-auctions": {
    workflowId: "cheap-accessories",
    records: [
      { title: "Original lens cap for Kestrel 35", price: "£9.50", bids: "6 bids" },
      { title: "Kestrel 35 instruction manual (reprint)", price: "£4.20", bids: "2 bids" },
      { title: "Selbstauslöser / self-timer for Kestrel 35", price: "EUR 6,50", bids: "2 bids" },
      { title: "Kestrel K-35 flashgun for Kestrel cameras", price: "£8.00", bids: "1 bid" },
      { title: "Kestrel 35 camera strap, genuine", price: "£7.00", bids: "1 bid" },
      { title: "UV filter 40.5mm, fits Kestrel 35", price: "£5.00", bids: "0 bids" },
    ],
  },
  "auction-marketplace-save-mark-ii-sellers": {
    workflowId: "save-mark-ii-sellers",
    records: [{ seller: "fotokiste-utrecht" }, { seller: "kameraboden" }, { seller: "northgate_photo" }, { seller: "sprocket-and-spool" }],
  },
  "auction-marketplace-buy-it-now-quote": {
    workflowId: "buy-it-now-quote",
    records: [{ title: "Kestrel 35 rangefinder camera body + original leather case", price: "£140.00", postage: "+£6.50 postage" }],
  },
  "auction-marketplace-lens-hood-seller-shop": {
    workflowId: "lens-hood-seller-shop",
    records: [
      { title: "Kestrel 50 Deluxe 35mm film camera", price: "£39.00" },
      { title: "Kestrel 350 SLR body only", price: "£47.00" },
      { title: "Kestrel 35 boxed, near mint, with instructions", price: "£165.00" },
      { title: "Kestrel 35 camera with flash & manual — refurbished by seller", price: "£122.00" },
      { title: "Lens hood for Kestrel 35 / 35S, 40.5mm", price: "£11.00" },
      { title: "UV filter 40.5mm, fits Kestrel 35", price: "£5.00" },
      { title: "Ostara 50mm f/1.8 lens, M39 mount, clean glass", price: "£68.00" },
      { title: "Vantor V2 rangefinder with 50mm f/2 — serviced", price: "£219.00" },
    ],
  },
};

test("each breadth task names its own workflow's dataset, which lists exactly the records owed", () => {
  for (const [taskId, owed] of Object.entries(OWED)) {
    const task = AUCTION_MARKETPLACE_LIVE_TASKS.find(({ id }) => id === taskId);
    assert.ok(task, taskId);
    assert.equal(task.judgeBy, "expected-dataset");
    assert.equal(task.variantId, undefined, `${taskId} carries no drift variant`);
    const { expected } = resolveScenarioWorkflow(auctionMarketplaceManifest, { workflowId: owed.workflowId });
    const dataset = expected.extracted!.find(({ step }) => step === task.expectedDatasetId);
    assert.ok(dataset, `${taskId}: ${owed.workflowId} declares no ${task.expectedDatasetId}`);
    assert.deepEqual(dataset.records, owed.records, taskId);
    assert.equal(dataset.count, owed.records.length, taskId);
    for (const column of Object.keys(owed.records[0]!)) assert.match(task.instruction, new RegExp(`\\b${column}\\b`, "u"), `${taskId} names ${column}`);
  }
});

test("only the seller task changes the account, and its oracle is the four Mark II sellers saved and nothing else", () => {
  const unchanged = accountFacts(createAuctionState(), "x").map(({ subject, value }) => ({ subject, value }));
  for (const workflowId of ["cheap-accessories", "buy-it-now-quote", "lens-hood-seller-shop"]) {
    const { expected } = resolveScenarioWorkflow(auctionMarketplaceManifest, { workflowId });
    assert.deepEqual(expected.finalState!.map(({ subject, value }) => ({ subject, value })), unchanged, workflowId);
  }
  const { expected } = resolveScenarioWorkflow(auctionMarketplaceManifest, { workflowId: "save-mark-ii-sellers" });
  const facts = Object.fromEntries(expected.finalState!.map(({ subject, value }) => [subject, value]));
  assert.equal(facts["followed-sellers"], "fotokiste-utrechtkamerabodennorthgate_photosprocket-and-spool");
  assert.equal(facts["watch-flyout"], unchanged.find(({ subject }) => subject === "watch-flyout")!.value);
  assert.equal(facts["bids-flyout"], "");
  assert.equal(facts["purchases-flyout"], "");
});

test("no breadth task declares a permission point: none of them pays, deletes, sends or publishes", () => {
  for (const taskId of Object.keys(OWED)) {
    assert.equal(AUCTION_MARKETPLACE_LIVE_TASKS.find(({ id }) => id === taskId)!.permissionPoint, undefined, taskId);
  }
});
