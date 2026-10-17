import assert from "node:assert/strict";
import test from "node:test";
import { resolveScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { listingById, searchResults, skuStock, VOLTBAY_LOOKALIKE_ID, VOLTBAY_OFFICIAL_ID, type SearchQuery } from "../catalog/index.js";
import { CROSSBORDER_MARKETPLACE_LIVE_TASKS } from "../live-tasks.js";
import { crossborderMarketplaceManifest as manifest, MARKET_SEED } from "../manifest/index.js";
import { crossborderMarketplaceScenario as scenario } from "../scenario.js";
import type { MarketState } from "../state/index.js";

/**
 * The breadth round's four tasks (t697), judged without a browser: each names
 * the one workflow whose dataset it is judged by, and each dataset is the one
 * the fixture data gives, read here as literal values rather than recomputed.
 */
const TASKS: Readonly<Record<string, string>> = {
  "crossborder-marketplace-free-hubs-under-ten": "free-hubs-under-ten",
  "crossborder-marketplace-follow-official-store": "follow-official-store",
  "crossborder-marketplace-mint-hub-fallback": "mint-hub-fallback",
  "crossborder-marketplace-uk-express-quote": "uk-express-quote",
};

const context = { runToken: "crossborder-breadth-token", seed: MARKET_SEED };
const fresh = () => scenario.createState(MARKET_SEED);
const apply = (state: MarketState, operation: string, payload: unknown = {}) => scenario.mutate(state, operation, payload);
const page = (state: MarketState, subpath: string) => scenario.route!(state, { subpath, query: new URLSearchParams(), method: "GET" }, context)?.body ?? "";
const query = (overrides: Partial<SearchQuery>): SearchQuery => ({ q: "usb c hub", shipFrom: [], freeShipping: false, fourStars: false, minCents: null, maxCents: null, sort: "default", page: 1, ...overrides });
const datasetOf = (workflowId: string) => resolveScenarioWorkflow(manifest, { workflowId }).expected.extracted![0]!;

test("each breadth task is judged by its own workflow's dataset, with every column named and no drift variant", () => {
  for (const [taskId, workflowId] of Object.entries(TASKS)) {
    const task = CROSSBORDER_MARKETPLACE_LIVE_TASKS.find(({ id }) => id === taskId);
    assert.ok(task, taskId);
    assert.equal(task.judgeBy, "expected-dataset");
    assert.equal(task.variantId, undefined, `${taskId}: drift variants belong to the adaptation gate`);
    assert.equal(task.permissionPoint, undefined, `${taskId}: no money, deletion or send`);
    const dataset = datasetOf(workflowId);
    assert.equal(task.expectedDatasetId, dataset.step);
    assert.ok(Array.isArray(dataset.records) && dataset.records.length > 0 && dataset.count === dataset.records.length, taskId);
    for (const key of Object.keys(dataset.records[0]!)) assert.match(task.instruction, new RegExp(`\\b${key}\\b`, "u"), `${taskId}: column ${key}`);
    assert.ok((resolveScenarioWorkflow(manifest, { workflowId }).expected.finalState ?? []).length > 0, `${taskId}: a final state is judged too`);
  }
});

test("free-hubs-under-ten: ten free-shipping hubs at 10,00 € or less, cheapest first, as the narrowed and sorted search lists them", () => {
  const records = datasetOf("free-hubs-under-ten").records!;
  assert.deepEqual(records.map(({ price }) => price), ["2,89 €", "5,42 €", "6,99 €", "7,99 €", "8,20 €", "8,49 €", "8,99 €", "9,15 €", "9,49 €", "9,87 €"]);
  assert.deepEqual(records[0], { title: listingById("1005008119640")!.title, store: "Lumora Tech Store", price: "2,89 €", rating: "4.7" });
  assert.deepEqual(records.at(-1), { title: listingById("1005008401187")!.title, store: "Hubsmith Global Store", price: "9,87 €", rating: "4.9" });
  const narrowed = searchResults(query({ freeShipping: true, maxCents: 1000, sort: "price_asc" }));
  assert.equal(narrowed.pageCount, 1);
  assert.deepEqual(narrowed.slots.filter((slot) => !slot.sponsored).map((slot) => slot.listing.title), records.map(({ title }) => title));
  assert.equal(narrowed.slots.length, 12, "ten results and two of the three paid placements fit the page");
  assert.ok(narrowed.slots.filter((slot) => slot.sponsored).every((slot) => slot.listing.priceCents > 1000), "the paid placements ignore the ceiling");
  const ceilingOnly = searchResults(query({ maxCents: 1000, sort: "price_asc" })).slots.filter((slot) => !slot.sponsored).map((slot) => slot.listing.id);
  for (const conditional of ["1005008250944", "1005008037751", "1005008330158"]) assert.ok(ceilingOnly.includes(conditional), `${conditional} charges shipping on its own and is under the ceiling`);
});

test("follow-official-store: the account starts with three followed stores, Follow adds one, a second press removes it", () => {
  const start = fresh();
  assert.deepEqual(start.following, ["hubsmith", "mirafone", "qinport"]);
  assert.match(page(start, "flyouts"), /Followed stores: Hubsmith Global Store; Mirafone Accessories; Qinport Official Store</u);
  const followed = apply(start, "follow-store", { storeId: "voltbay-official", follow: true });
  assert.deepEqual(datasetOf("follow-official-store").records, [{ following: "Followed stores: Hubsmith Global Store; Mirafone Accessories; Qinport Official Store; Voltbay Official Store" }]);
  assert.ok(page(followed, "flyouts").includes(datasetOf("follow-official-store").records![0]!.following!));
  assert.equal(apply(followed, "follow-store", { storeId: "voltbay-official", follow: true }), followed, "following twice changes nothing");
  assert.deepEqual(apply(followed, "follow-store", { storeId: "voltbay-official", follow: false }).following, start.following);
  assert.deepEqual(apply(start, "follow-store", { storeId: "voltbay-lookalike", follow: true }).following.at(-1), "voltbay-lookalike");
  assert.equal(apply(start, "follow-store", { storeId: "no-such-store", follow: true }), start);
  assert.equal(apply(start, "follow-store", { storeId: "voltbay-official" }), start, "a payload the page could not have sent");
  assert.ok(page(followed, `item/${VOLTBAY_OFFICIAL_ID}`).includes(">Following</span>"));
  assert.ok(page(start, `item/${VOLTBAY_OFFICIAL_ID}`).includes(">Follow</span>"));
});

test("mint-hub-fallback: the official Mint 10-in-1 is sold out everywhere, the lookalike's is not, and the fallback is in stock", () => {
  const official = listingById(VOLTBAY_OFFICIAL_ID)!;
  const lookalike = listingById(VOLTBAY_LOOKALIKE_ID)!;
  for (const origin of official.origins) assert.equal(skuStock(official, { color: "Mint", spec: "10-in-1", origin }), 0, origin);
  assert.ok(skuStock(lookalike, { color: "Mint", spec: "10-in-1", origin: "Spain" }) >= 2, "the careless path finds it at the lookalike");
  assert.ok(skuStock(official, { color: "Mint", spec: "7-in-1", origin: "Spain" }) >= 2);
  assert.deepEqual(datasetOf("mint-hub-fallback").records, [{ store: "Voltbay Official Store", item: official.title, options: "Mint · 7-in-1 · Ships from Spain", quantity: "2" }]);
  const added = apply(fresh(), "add-to-cart", { listingId: VOLTBAY_OFFICIAL_ID, color: "Mint", spec: "7-in-1", origin: "Spain", quantity: 2 });
  assert.ok(page(added, "cart").includes("Mint · 7-in-1 · Ships from Spain"));
});

test("uk-express-quote: shipped to the United Kingdom with express, the checkout reads £17.16, £6.01 and £23.17; standard ships free", () => {
  assert.deepEqual(datasetOf("uk-express-quote").records, [{ items: "£17.16", shipping: "£6.01", total: "£23.17" }]);
  const checkout = apply(apply(fresh(), "region", { region: "GB" }), "buy-now", { listingId: "1005008698840", color: "Silver", spec: "", origin: "Spain", quantity: 1 });
  const standard = page(checkout, "checkout");
  assert.ok(standard.includes("<span>Shipping</span><span>Free</span>") && standard.includes("<span>Total</span><span>£17.16</span>"));
  const express = page(apply(checkout, "checkout-shipping", { storeId: "keelson", method: "express" }), "checkout");
  for (const value of ["<span>Items total</span><span>£17.16</span>", "<span>Shipping</span><span>£6.01</span>", "<span>Total</span><span>£23.17</span>"]) assert.ok(express.includes(value), value);
  assert.ok(page(apply(fresh(), "buy-now", { listingId: "1005008698840", color: "Silver", spec: "", origin: "Spain", quantity: 1 }), "checkout").includes("19,95 €"), "without the region change the checkout is in euros");
});
