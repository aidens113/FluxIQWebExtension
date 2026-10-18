import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { miniCartText } from "../../cart/index.js";
import { formatMoney, PAPER_TOWELS, variantTitle } from "../../catalog/index.js";
import { BIGBOX_RETAIL_LIVE_TASKS } from "../../live-tasks.js";
import { bigboxRetailManifest } from "../../manifest/index.js";
import { createBigboxState, mutateBigboxState } from "../../state/index.js";
import type { BigboxState } from "../../types.js";
import { NEW_STORE_CHEAPEST_TOWELS_WORKFLOW, soapQuantityAccountFacts } from "../index.js";

const { expected } = NEW_STORE_CHEAPEST_TOWELS_WORKFLOW;
const cheapestAt = (storeId: string) => PAPER_TOWELS.filter((product) => product.department === "Paper Towels" && product.variants[0]!.pickup[storeId] === "today" && product.rating >= 4.5)
  .reduce((best, product) => (product.variants[0]!.priceCents < best.variants[0]!.priceCents ? product : best));
const shop = (storeId: string, productId: string, sku: string) => mutateBigboxState(mutateBigboxState(createBigboxState(), "set-store", { storeId }), "add-to-cart", { productId, sku, qty: 1, fulfilment: "pickup" });
const holds = (state: BigboxState) => {
  const text = miniCartText(state);
  return expected.finalState!.every((fact) => fact.value === (fact.subject === "bigbox-soap-account" ? soapQuantityAccountFacts(state)
    : fact.subject === "mini-cart-store" ? text.store : fact.subject === "mini-cart-summary" ? text.summary : text.lines.find((line) => line.testId === fact.subject)?.text));
};

test("the task names the workflow's one dataset and the manifest resolves it unchanged", () => {
  const task = BIGBOX_RETAIL_LIVE_TASKS.find(({ id }) => id === "bigbox-retail-new-store-cheapest-towels")!;
  const resolved = resolveScenarioWorkflow(bigboxRetailManifest, { workflowId: "new-store-cheapest-towels" });
  assert.equal(task.expectedDatasetId, resolved.expected.extracted![0]!.step);
  assert.deepEqual(resolved.expected, expected);
  assert.equal(task.permissionPoint, undefined, "a store switch and an add move no money");
});

test("counting every size of every product, as the instruction says, the new store's lowest qualifying price is still the single roll", () => {
  const sizes = PAPER_TOWELS.filter((product) => product.department === "Paper Towels" && product.rating >= 4.5)
    .flatMap((product) => product.variants.filter((variant) => variant.pickup["4419"] === "today").map((variant) => ({ sku: variant.sku, cents: variant.priceCents })))
    .sort((left, right) => left.cents - right.cents);
  assert.equal(sizes[0]!.sku, "5510204");
  assert.ok(sizes[1]!.cents > sizes[0]!.cents, "and nothing ties it");
});

test("the cheapest qualifying pack exists only at the new store: the home store's is another", () => {
  const atNewStore = cheapestAt("4419");
  assert.equal(atNewStore.id, "418830166");
  assert.deepEqual(expected.extracted![0]!.records![1], { item: variantTitle(atNewStore, atNewStore.variants[0]!), quantity: "1", price: formatMoney(atNewStore.variants[0]!.priceCents) });
  assert.equal(cheapestAt("2291").name, "Kindleaf Unbleached Paper Towels, 4 Rolls");
});

test("switching store then adding the roll holds the final facts; the other Millbrook store, no switch, or the home store's answer do not", () => {
  assert.equal(expected.pageFacts![0]!.value, soapQuantityAccountFacts(createBigboxState()));
  assert.ok(holds(shop("4419", "418830166", "5510204")));
  assert.equal(holds(shop("1187", "418830166", "5510204")), false, "Millbrook Crossing Supercenter is the wrong store");
  assert.equal(holds(mutateBigboxState(createBigboxState(), "add-to-cart", { productId: "418830166", sku: "5510204", qty: 1, fulfilment: "pickup" })), false, "the store was never switched");
  assert.equal(holds(shop("4419", "439018290", "5570103")), false, "the home store's cheapest qualifying pack");
});
