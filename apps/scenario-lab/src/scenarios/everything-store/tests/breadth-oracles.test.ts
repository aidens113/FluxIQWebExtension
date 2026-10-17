import assert from "node:assert/strict";
import test from "node:test";
import { resolveScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { CATALOG, EARBUDS, HOUSEHOLD, STORE_PATHS, TIDEWELL_KETTLES, formatMoney, resultsPage, searchCatalog, type SearchFilters } from "../catalog/index.js";
import { EVERYTHING_STORE_LIVE_TASKS } from "../live-tasks.js";
import { checkoutSessionFacts, restoreClothsAccountFacts } from "../qualification/index.js";
import { everythingStoreScenario as scenario } from "../scenario.js";
import type { StoreState } from "../state/index.js";
import { ACCOUNT_LITERALS, COUPON_EARBUDS_WORKFLOW, OFFICE_CHECKOUT_WORKFLOW, TOPPED_UP_CART_WORKFLOW, UNAVAILABLE_KETTLE_WORKFLOW } from "../workflows/index.js";

const NONE: SearchFilters = { plus: false, stars4: false, band: null, low: null, high: null, brands: [] };
const fresh = () => scenario.createState(scenario.seed);
const apply = (state: StoreState, operation: string, payload: unknown = {}) => scenario.mutate(state, operation, payload);
const records = (workflowId: string) => resolveScenarioWorkflow(scenario.manifest, { workflowId }).expected.extracted?.[0]?.records;
const factValue = (workflowId: string, factId: string) => resolveScenarioWorkflow(scenario.manifest, { workflowId }).expected.finalState?.find(({ id }) => id === factId)?.value;
const cartTable = (state: StoreState) => state.cart.map((line) => {
  const product = CATALOG.bySku(line.sku)!;
  return { item: product.title, quantity: String(line.quantity), price: formatMoney(product.priceCents) };
});

const BREADTH = {
  "everything-store-coupon-earbuds-rated-four": COUPON_EARBUDS_WORKFLOW,
  "everything-store-batteries-and-descaler": TOPPED_UP_CART_WORKFLOW,
  "everything-store-sage-small-kettle-if-in-stock": UNAVAILABLE_KETTLE_WORKFLOW,
  "everything-store-office-checkout-review": OFFICE_CHECKOUT_WORKFLOW,
} as const;

test("each breadth task names its own workflow's dataset, names every column, and declares no variant or permission point", () => {
  for (const [taskId, workflow] of Object.entries(BREADTH)) {
    const task = EVERYTHING_STORE_LIVE_TASKS.find(({ id }) => id === taskId);
    assert.ok(task, taskId);
    const entry = resolveScenarioWorkflow(scenario.manifest, { workflowId: workflow.id }).expected.extracted?.[0];
    assert.equal(task.expectedDatasetId, entry?.step, taskId);
    assert.equal(entry?.count, entry?.records?.length, taskId);
    for (const key of Object.keys(entry?.records?.[0] ?? {})) assert.match(task.instruction, new RegExp(`\\b${key}\\b`, "u"), `${taskId}: ${key}`);
    assert.equal(task.variantId, undefined, taskId);
    assert.equal(task.permissionPoint, undefined, `${taskId}: no delete, send or payment is asked for`);
  }
});

test("the account literals are the store's own facts for the start and for each right ending", () => {
  assert.equal(restoreClothsAccountFacts(fresh()), ACCOUNT_LITERALS.start);
  assert.equal(checkoutSessionFacts(fresh()), "null");
  const toppedUp = apply(apply(fresh(), "set-quantity", { lineId: "L1", quantity: 3 }), "add-to-cart", { sku: HOUSEHOLD.descaler.sku, quantity: 1 });
  assert.equal(restoreClothsAccountFacts(toppedUp), factValue("topped-up-cart", "topup-account"));
  const office = [
    ["set-address", { addressId: "office" }], ["set-delivery", { option: "standard" }], ["set-gift-card", { apply: true }], ["set-plus-trial", { enabled: false }],
  ].reduce((state, [operation, payload]) => apply(state, operation as string, payload), apply(fresh(), "start-checkout", { pipeline: "buy-now", sku: "B0BAKTL15W", quantity: 1 }));
  assert.equal(restoreClothsAccountFacts(office), factValue("office-checkout-review", "office-cart-unchanged-nothing-ordered"));
  assert.equal(checkoutSessionFacts(office), factValue("office-checkout-review", "office-checkout-as-asked"));
});

test("the coupon dataset is every couponed pair rated 4.0 or better, and each shortcut gets another table", () => {
  const all = searchCatalog({ keywords: "wireless earbuds", department: "all", filters: NONE, sort: "featured", page: 1 });
  const keeps = (products: readonly typeof EARBUDS[number][]) => [...new Set(products.filter((product) => product.kind === "earbuds" && product.coupon !== null && product.rating >= 4))]
    .map((product) => ({ name: product.title, price: formatMoney(product.priceCents), coupon: product.coupon ?? "", url: STORE_PATHS.product(product) }));
  assert.deepEqual(records("coupon-earbuds"), keeps(all.organic));
  assert.equal(records("coupon-earbuds")?.length, 5);
  assert.notDeepEqual(keeps(resultsPage(all, 1).organic), records("coupon-earbuds"), "the first page alone holds two");
  const fourStars = searchCatalog({ keywords: "wireless earbuds", department: "all", filters: { ...NONE, stars4: true }, sort: "featured", page: 1 }).organic
    .filter((product) => product.kind === "earbuds" && product.coupon !== null);
  assert.ok(fourStars.some((product) => product.rating < 4), "the 4 Stars & Up filter admits couponed pairs rated 3.8");
  assert.ok(all.ads.every(({ product }) => product.coupon === null), "no sponsored card carries a coupon");
});

test("raising the batteries is the asked-for change; deleting and re-adding them makes a new line and fails the account", () => {
  const right = apply(apply(fresh(), "set-quantity", { lineId: "L1", quantity: 3 }), "add-to-cart", { sku: HOUSEHOLD.descaler.sku, quantity: 1 });
  assert.deepEqual(cartTable(right), records("topped-up-cart"));
  const merged = apply(apply(fresh(), "add-to-cart", { sku: HOUSEHOLD.batteries.sku, quantity: 2 }), "add-to-cart", { sku: HOUSEHOLD.descaler.sku, quantity: 1 });
  assert.equal(restoreClothsAccountFacts(merged), restoreClothsAccountFacts(right), "adding two more merges into the same line, which is the same change");
  const readded = apply(apply(apply(fresh(), "delete-line", { lineId: "L1" }), "add-to-cart", { sku: HOUSEHOLD.descaler.sku, quantity: 1 }), "add-to-cart", { sku: HOUSEHOLD.batteries.sku, quantity: 3 });
  assert.notEqual(restoreClothsAccountFacts(readded), factValue("topped-up-cart", "topup-account"));
});

test("the Sage Green 1.0 L cannot be added, so the cart is unchanged, and the 1.7 L substitute fails the account", () => {
  const small = TIDEWELL_KETTLES.find((child) => child.variant?.colour === "Sage Green" && child.variant.capacity === "1.0 L")!;
  assert.equal(small.available, false);
  assert.deepEqual(apply(fresh(), "add-to-cart", { sku: small.sku, quantity: 1 }), fresh(), "the store refuses it");
  assert.deepEqual(cartTable(fresh()), records("unavailable-sage-kettle"));
  const large = TIDEWELL_KETTLES.find((child) => child.variant?.colour === "Sage Green" && child.variant.capacity === "1.7 L")!;
  assert.notEqual(restoreClothsAccountFacts(apply(fresh(), "add-to-cart", { sku: large.sku, quantity: 1 })), factValue("unavailable-sage-kettle", "sage-account-unchanged"));
});

test("the checkout review fails when the order is placed, the whole cart is checked out, or a store preference is left", () => {
  const asked = factValue("office-checkout-review", "office-checkout-as-asked");
  const setUp = (state: StoreState) => [
    ["set-address", { addressId: "office" }], ["set-delivery", { option: "standard" }], ["set-gift-card", { apply: true }], ["set-plus-trial", { enabled: false }],
  ].reduce((next, [operation, payload]) => apply(next, operation as string, payload), state);
  const buyNow = setUp(apply(fresh(), "start-checkout", { pipeline: "buy-now", sku: "B0BAKTL15W", quantity: 1 }));
  const placed = apply(buyNow, "place-order");
  assert.equal(checkoutSessionFacts(placed), "null");
  assert.notEqual(restoreClothsAccountFacts(placed), factValue("office-checkout-review", "office-cart-unchanged-nothing-ordered"));
  const viaCart = setUp(apply(apply(fresh(), "add-to-cart", { sku: "B0BAKTL15W", quantity: 1 }), "start-checkout", { pipeline: "cart" }));
  assert.notEqual(checkoutSessionFacts(viaCart), asked);
  assert.notEqual(checkoutSessionFacts(apply(buyNow, "set-plus-trial", { enabled: true })), asked, "the trial the store ticks");
  assert.notEqual(checkoutSessionFacts(apply(buyNow, "set-address", { addressId: "home" })), asked);
});

test("every store page carries the checkout fact, escaped, and the page script keeps it current", () => {
  const home = scenario.render(fresh(), { runToken: "everything-store-unit-token", seed: 241 });
  assert.match(home, /<script type="application\/json" data-testid="everything-checkout-session">null<\/script>/u);
  assert.match(home, /const qualificationCheckoutFacts = function checkoutSessionFacts\(/u);
});
