import assert from "node:assert/strict";
import test from "node:test";
import { resolveScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { HOUSEHOLD, TIDEWELL_KETTLES, resultsPage, searchCatalog, type PriceBand, type SearchFilters, type SortOrder } from "../catalog/index.js";
import { checkoutSessionFacts, placedOrdersFacts, restoreClothsAccountFacts } from "../qualification/index.js";
import { everythingStoreScenario as scenario } from "../scenario.js";
import type { StoreState } from "../state/index.js";
import { earbudRecords } from "../workflows/index.js";

/**
 * Final-state facts that must read the same on whichever page a run ends on
 * (answer-first audit, 2026-11-05): each is a fact on an element every store
 * page carries, the honest ending satisfies it, and a plausible wrong ending
 * does not.
 */
const fresh = () => scenario.createState(scenario.seed);
const apply = (state: StoreState, operation: string, payload: unknown = {}) => scenario.mutate(state, operation, payload);
const factOf = (workflowId: string | undefined, factId: string) => {
  const fact = resolveScenarioWorkflow(scenario.manifest, workflowId === undefined ? {} : { workflowId }).expected.finalState?.find(({ id }) => id === factId);
  assert.ok(fact, factId);
  return fact;
};
const SAGE_17 = TIDEWELL_KETTLES.find((child) => child.variant?.colour === "Sage Green" && child.variant.capacity === "1.7 L")!;
const saveCase = (state: StoreState) => {
  // The first Save for later of a session fails and changes nothing; the retry is the one that lands.
  const first = apply(state, "save-for-later", { lineId: "L2" });
  return first.saved.length === state.saved.length ? apply(first, "save-for-later", { lineId: "L2" }) : first;
};

test("kettle-to-cart: the account element holds the right ending, and each wrong ending reads differently", () => {
  const fact = factOf("add-to-cart", "kettles-in-cart-case-saved");
  assert.equal(fact.subject, "everything-saved-cloths-account");
  const honest = saveCase(apply(fresh(), "add-to-cart", { sku: SAGE_17.sku, quantity: 2 }));
  assert.equal(restoreClothsAccountFacts(honest), fact.value);
  const addedTwice = saveCase(apply(apply(fresh(), "add-to-cart", { sku: SAGE_17.sku, quantity: 1 }), "add-to-cart", { sku: SAGE_17.sku, quantity: 1 }));
  assert.equal(restoreClothsAccountFacts(addedTwice), fact.value, "two single adds merge into the same line");
  const wrong: Record<string, StoreState> = {
    "case deleted instead of saved": apply(apply(fresh(), "add-to-cart", { sku: SAGE_17.sku, quantity: 2 }), "delete-line", { lineId: "L2" }),
    "case still in the cart": apply(fresh(), "add-to-cart", { sku: SAGE_17.sku, quantity: 2 }),
    "one kettle": saveCase(apply(fresh(), "add-to-cart", { sku: SAGE_17.sku, quantity: 1 })),
    "another colour": saveCase(apply(fresh(), "add-to-cart", { sku: TIDEWELL_KETTLES.find((child) => child.variant?.colour === "Matte Black")!.sku, quantity: 2 })),
    "nothing done": fresh(),
  };
  for (const [name, state] of Object.entries(wrong)) assert.notEqual(restoreClothsAccountFacts(state), fact.value, name);
});

test("buy-kettle: the placed-orders element holds the one right order, and each wrong order reads differently", () => {
  const order = factOf(undefined, "order-is-one-kettle-home-standard-visa");
  assert.equal(order.subject, "everything-placed-orders");
  const black = TIDEWELL_KETTLES.find((child) => child.variant?.colour === "Matte Black" && child.variant.capacity === "1.7 L")!;
  const checkout = (sku: string, set: ReadonlyArray<readonly [string, unknown]> = []) =>
    set.reduce((state, [operation, payload]) => apply(state, operation, payload), apply(fresh(), "start-checkout", { pipeline: "buy-now", sku, quantity: 1 }));
  assert.equal(placedOrdersFacts(fresh()), "[]");
  const honest = apply(checkout(black.sku, [["set-address", { addressId: "home" }], ["set-payment", { paymentId: "visa-4417" }], ["set-delivery", { option: "standard" }], ["set-plus-trial", { enabled: false }]]), "place-order");
  assert.equal(placedOrdersFacts(honest), order.value);
  assert.equal(honest.cart.length, 2, "the other things in the cart stay where they are");
  const wrong: Record<string, StoreState> = {
    "no order placed": checkout(black.sku),
    "another kettle": apply(checkout(TIDEWELL_KETTLES.find((child) => child.variant?.colour === "Sage Green")!.sku), "place-order"),
    "office address": apply(checkout(black.sku, [["set-address", { addressId: "office" }]]), "place-order"),
    "gift card applied": apply(checkout(black.sku, [["set-gift-card", { apply: true }]]), "place-order"),
    "Plus trial left on": apply(checkout(black.sku, [["set-plus-trial", { enabled: true }]]), "place-order"),
    "ordered twice": apply(apply(honest, "start-checkout", { pipeline: "buy-now", sku: black.sku, quantity: 1 }), "place-order"),
    "batteries instead": apply(checkout(HOUSEHOLD.batteries.sku), "place-order"),
  };
  for (const [name, state] of Object.entries(wrong)) assert.notEqual(placedOrdersFacts(state), order.value, name);
  assert.equal(checkoutSessionFacts(honest), "null", "the order closed the checkout");
});

/**
 * The first-page task's `result-count` fact was page-bound (results page only), so it is gone from the final state.
 * That is sound only if the task's own dataset already fixes everything the count said: the same search with any
 * other filter, sort or department that yields the very same first-page records must also give the same total, so
 * the count could never have separated a right answer from a wrong one.
 */
test("first-page: no other results page gives the dataset's records with another total, so the dropped count added nothing", () => {
  const records = (filters: SearchFilters, sort: SortOrder, department: "all" | "electronics" | "home" | "grocery" | "toys") => {
    const outcome = searchCatalog({ keywords: "wireless earbuds", department, filters, sort, page: 1 });
    return { records: earbudRecords(resultsPage(outcome, 1).organic), total: outcome.organic.length };
  };
  const bands: Array<PriceBand | null> = [null, "under-25", "25-50", "50-100", "100-up"];
  const sorts: SortOrder[] = ["featured", "price-asc", "price-desc", "review"];
  const departments = ["all", "electronics", "home", "grocery", "toys"] as const;
  const right = records({ plus: true, stars4: false, band: null, low: null, high: null, brands: [] }, "featured", "all");
  const expected = resolveScenarioWorkflow(scenario.manifest, { workflowId: "first-page-earbuds" }).expected.extracted?.[0]?.records;
  assert.deepEqual(right.records, expected);
  let tried = 0;
  for (const plus of [true, false]) for (const stars4 of [true, false]) for (const band of bands) for (const sort of sorts) for (const department of departments) {
    const other = records({ plus, stars4, band, low: null, high: null, brands: [] }, sort, department);
    tried += 1;
    if (JSON.stringify(other.records) === JSON.stringify(right.records)) assert.equal(other.total, right.total, `plus=${plus} stars4=${stars4} band=${band} sort=${sort} department=${department}`);
  }
  assert.equal(tried, 2 * 2 * 5 * 4 * 5);
});
