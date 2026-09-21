import assert from "node:assert/strict";
import test from "node:test";
import { resolveScenarioWorkflow, validateWebScenario } from "@fluxiq-web-extension/test-contracts";
import { LIVE_INSTRUCTION_TASKS, LIVE_REPAIR_TASKS } from "../../index.js";
import { miniCartText } from "../cart/index.js";
import { formatMoney, PAPER_TOWELS, variantTitle } from "../catalog/index.js";
import { BIGBOX_RETAIL_LIVE_TASKS, BIGBOX_RETAIL_REPAIR_TASKS, bigboxRetailScenario } from "../index.js";
import { ORDER_FINAL_FACTS, ORDER_RECORDS, PICKUP_CART_FACTS, PICKUP_TOWEL_RECORDS, START_FACTS } from "../manifest/index.js";
import { readSearchState, runSearch } from "../search/index.js";
import { CHECKOUT_ERRORS, createBigboxState, mutateBigboxState } from "../state/index.js";
import type { BigboxState } from "../types.js";

const { manifest, render, route } = bigboxRetailScenario;
const context = { runToken: "bigbox-retail-test-token", seed: 239, alternateOrigin: "http://127.0.0.1:9" };
const get = (state: BigboxState, subpath: string, query = "") => route!(state, { subpath, query: new URLSearchParams(query), method: "GET" }, context);
const apply = (state: BigboxState, ...operations: Array<[string, unknown]>) => operations.reduce((current, [operation, payload]) => mutateBigboxState(current, operation, payload), state);
const factText = (facts: ReadonlyArray<{ subject: string; value: unknown }>, subject: string) => facts.find((fact) => fact.subject === subject)?.value;
const CONTACT = { firstName: "Dana", lastName: "Whitfield", email: "dana.whitfield@example.com", phone: "555-014-2290", company_website: "", payment: "pickup", slotId: "2291-0921-14" };
const FILTERED = "q=paper+towels&facet=" + encodeURIComponent("dept:Paper Towels||retailer_type:ValueRidge||fulfillment_method:Pickup||fulfillment_speed:Today||customer_rating:4 & up");

test("the manifest is valid, loopback-only, and declares the three workflows and their variants", () => {
  assert.deepEqual(validateWebScenario(manifest), { valid: true, value: manifest });
  assert.equal(manifest.networkPolicy, "loopback-only");
  assert.deepEqual([manifest.id, manifest.seed, manifest.startPath], ["bigbox-retail", 239, "/scenarios/bigbox-retail/"]);
  assert.deepEqual(manifest.variants?.map((variant) => variant.id), ["redesigned-buy-box"]);
  assert.deepEqual(manifest.workflows?.map((workflow) => [workflow.id, (workflow.variants ?? []).map((variant) => variant.id)]), [["pickup-towels", ["list-layout"]], ["pickup-order", []]]);
  for (const selection of [{}, { variantId: "redesigned-buy-box" }, { workflowId: "pickup-towels" }, { workflowId: "pickup-towels", variantId: "list-layout" }, { workflowId: "pickup-order" }]) {
    assert.equal(resolveScenarioWorkflow(manifest, selection).expected.failure, undefined, JSON.stringify(selection));
  }
});

test("the nine expected listings are exactly the catalog's store-sold paper towels picked up today at the home store and rated 4.5 or better", () => {
  const derived = PAPER_TOWELS.filter((product) => product.seller === "ValueRidge" && product.department === "Paper Towels" && product.variants[0]!.pickup["2291"] === "today" && product.rating >= 4.5)
    .map((product) => ({ name: variantTitle(product, product.variants[0]!), price: formatMoney(product.variants[0]!.priceCents), unitPrice: product.variants[0]!.unit, rating: product.rating.toFixed(1) }));
  assert.deepEqual(derived, PICKUP_TOWEL_RECORDS);
});

test("unfiltered, the search runs to three pages of twelve, twelve and eight, with three ads on each that ignore every filter", () => {
  const pages = [1, 2, 3].map((page) => runSearch(readSearchState(new URLSearchParams(`q=paper+towels&page=${page}`)), "2291"));
  assert.deepEqual(pages.map((result) => [result.total, result.pageCount, result.entries.filter((entry) => !entry.sponsored).length, result.entries.filter((entry) => entry.sponsored).length]), [[32, 3, 12, 3], [32, 3, 12, 3], [32, 3, 8, 3]]);
  const filtered = runSearch(readSearchState(new URLSearchParams(FILTERED)), "2291");
  assert.deepEqual([filtered.total, filtered.pageCount, filtered.entries.filter((entry) => entry.sponsored).length], [13, 2, 3]);
  const firstPage = filtered.entries.map((entry) => entry.product.id);
  assert.ok(firstPage.length > new Set(firstPage).size, "an ad repeats a listing on the same filtered page");
  assert.equal(filtered.facets.find(({ group }) => group.key === "retailer_type")?.options[0]?.count, 23, "counts are the query's, before any filter: 32 listings less 9 marketplace ones");
});

test("the filters cannot say pickup today or 4.5 stars: four of the thirteen filtered listings are wrong for the job", () => {
  const filtered = [1, 2].flatMap((page) => runSearch(readSearchState(new URLSearchParams(`${FILTERED}&page=${page}`)), "2291").entries.filter((entry) => !entry.sponsored).map((entry) => variantTitle(entry.product, entry.product.variants[0]!)));
  const wanted = new Set(PICKUP_TOWEL_RECORDS.map((record) => record.name));
  assert.deepEqual(filtered.filter((name) => !wanted.has(name)), [
    "Softerra Pick-A-Sheet Paper Towels, 8 Triple Rolls",
    "Hearthside Kitchen Paper Towels, 2 Rolls",
    "Loftwell Paper Towels, Prints, 6 Double Rolls",
    "Northmere Paper Towels, 12 Rolls",
  ]);
  assert.deepEqual(filtered.filter((name) => wanted.has(name)), PICKUP_TOWEL_RECORDS.map((record) => record.name), "the rest are the answer, in order");
});

test("page numbers keep every filter and the Next arrow keeps only the query", () => {
  const html = get(createBigboxState(), "search", FILTERED)!.body!;
  assert.match(html, /href="\/scenarios\/bigbox-retail\/search\?q=paper\+towels&amp;facet=[^"]+&amp;page=2">2</u);
  assert.match(html, /href="\/scenarios\/bigbox-retail\/search\?q=paper%20towels&amp;page=2" aria-label="Next page"/u);
});

test("the third results document raises the bot check, which holds until it is held or waited out, and challenged loads are not counted", () => {
  let state = createBigboxState();
  const served: string[] = [];
  for (let load = 0; load < 4; load += 1) {
    const response = get(state, "search", "q=paper+towels")!;
    served.push(response.body!.includes("Robot or human?") ? "check" : "results");
    if (response.mutation) state = mutateBigboxState(state, response.mutation.operation, response.mutation.payload);
  }
  assert.deepEqual(served, ["results", "results", "check", "check"]);
  assert.deepEqual(state.robot, { searchLoads: 3, status: "challenged", clearedBy: "" });
  assert.equal(apply(state, ["clear-robot-check", { how: "clicked" }]).robot.status, "challenged");
  assert.deepEqual(apply(state, ["clear-robot-check", { how: "held" }]).robot, { searchLoads: 3, status: "cleared", clearedBy: "held" });
  assert.equal(apply(createBigboxState(), ["clear-robot-check", { how: "waited" }]).robot.status, "idle", "nothing to clear before the check");
});

test("the first request for pickup times is refused with a Retry-After; the next is answered", () => {
  const first = get(createBigboxState(), "checkout/slots")!;
  assert.deepEqual([first.status, first.headers?.["retry-after"], first.mutation?.operation], [429, "2", "slots-fetch"]);
  const second = get(apply(createBigboxState(), ["slots-fetch", {}]), "checkout/slots")!;
  assert.equal(second.status, 200);
  assert.match(second.body!, /disabled>1pm–2pm <small>Full<\/small>/u);
  assert.match(second.body!, /value="2291-0921-14">2pm–3pm</u);
});

test("the cart goal's facts are what the mini cart prints for the goal's cart, and adding before switching store misses them", () => {
  const honest = apply(createBigboxState(), ["set-store", { storeId: "1187" }],
    ["add-to-cart", { productId: "418830127", sku: "5510202", qty: 2, fulfilment: "pickup" }],
    ["add-to-cart", { productId: "418831402", sku: "5530102", qty: 1, fulfilment: "pickup" }]);
  const text = miniCartText(honest);
  assert.equal(factText(PICKUP_CART_FACTS, "mini-cart-store"), text.store);
  assert.equal(factText(PICKUP_CART_FACTS, "mini-cart-summary"), text.summary);
  for (const line of text.lines) assert.equal(factText(PICKUP_CART_FACTS, line.testId), line.text);
  assert.equal(text.lines.length, 3);
  const early = createBigboxState();
  assert.equal(apply(early, ["add-to-cart", { productId: "418830127", sku: "5510202", qty: 2, fulfilment: "pickup" }]), early, "the home store cannot hand the 12-roll pack over, so pickup is refused");
  const delivered = apply(early, ["add-to-cart", { productId: "418830127", sku: "5510202", qty: 2, fulfilment: "delivery" }], ["set-store", { storeId: "1187" }]);
  assert.notEqual(miniCartText(delivered).lines.find((line) => line.testId.startsWith("mini-cart-line-5510202"))?.testId, "mini-cart-line-5510202-pickup");
  assert.equal(factText(START_FACTS, "mini-cart-summary"), miniCartText(createBigboxState()).summary);
});

test("a line tops up to twelve at most, and the cart page's controls move lines between cart and saved", () => {
  const add = (qty: number) => ["add-to-cart", { productId: "402917554", sku: "5520101", qty, fulfilment: "pickup" }] as [string, unknown];
  const topped = apply(createBigboxState(), add(10), add(5));
  assert.deepEqual(topped.cart.map((line) => line.qty), [1, 12]);
  const saved = apply(topped, ["save-for-later", { lineId: "L1" }]);
  assert.deepEqual([saved.cart.length, saved.saved.length], [1, 1]);
  assert.deepEqual(apply(saved, ["move-to-cart", { lineId: "L1" }]).cart.map((line) => line.sku), ["5520101", "5530601"]);
  assert.equal(apply(saved, ["remove-line", { lineId: "L1" }]).saved.length, 0);
  assert.equal(apply(topped, ["update-qty", { lineId: "L2", qty: 13 }]), topped, "thirteen is refused, not clamped");
});

test("the order's expected record and final facts follow from an honest checkout, and the second order is numbered after it", () => {
  const ready = apply(createBigboxState(), ["add-to-cart", { productId: "418830127", sku: "5510201", qty: 1, fulfilment: "pickup" }], ["save-for-later", { lineId: "L1" }], ["start-guest-checkout", {}]);
  const placed = apply(ready, ["place-order", CONTACT]);
  const [order] = placed.orders;
  assert.ok(order);
  assert.deepEqual({ order: order.number, total: formatMoney(order.subtotalCents + order.taxCents) }, { order: ORDER_RECORDS[0]!.order, total: ORDER_RECORDS[0]!.total });
  const text = miniCartText(placed);
  assert.deepEqual([text.summary, text.saved], [factText(ORDER_FINAL_FACTS, "mini-cart-summary"), factText(ORDER_FINAL_FACTS, "mini-cart-saved")]);
  const again = apply(placed, ["add-to-cart", { productId: "402917554", sku: "5520101", qty: 1, fulfilment: "pickup" }], ["place-order", CONTACT]);
  assert.deepEqual(again.orders.map((entry) => entry.number), ["2000958-40713", "2000958-40714"]);
  const html = get(placed, `order/${order.number}`)!.body!;
  assert.match(html, /Pickup window: <span>Mon, Sep 21, 2pm–3pm<\/span>/u);
  assert.match(html, /<dt>Total<\/dt><dd>\$9\.62<\/dd>/u);
});

test("checkout refuses the hidden field, missing contact details, a full slot and an untokenised card, and places nothing", () => {
  const ready = apply(createBigboxState(), ["start-guest-checkout", {}]);
  const cases: Array<[Record<string, unknown>, string]> = [
    [{ ...CONTACT, company_website: "https://valueridge.example" }, CHECKOUT_ERRORS.flagged],
    [{ ...CONTACT, phone: "" }, CHECKOUT_ERRORS.contact],
    [{ ...CONTACT, slotId: "2291-0921-13" }, CHECKOUT_ERRORS.slot],
    [{ ...CONTACT, payment: "card", cardToken: "" }, CHECKOUT_ERRORS.card],
  ];
  for (const [payload, error] of cases) {
    const refused = apply(ready, ["place-order", payload]);
    assert.deepEqual([refused.orders.length, refused.checkoutError], [0, error]);
  }
  assert.equal(apply(ready, ["place-order", cases[0]![0]]).flaggedOrders, 1);
  assert.equal(apply(createBigboxState(), ["place-order", CONTACT]).checkoutError, CHECKOUT_ERRORS.notGuest);
  assert.equal(apply(ready, ["place-order", { ...CONTACT, payment: "card", cardToken: "tok_1111card" }]).orders.length, 1);
});

test("Buy now checks out one item alone and leaves the cart as it was; visiting the cart forgets it", () => {
  const express = apply(createBigboxState(), ["buy-now", { productId: "402917554", sku: "5520101", qty: 1, fulfilment: "pickup" }], ["start-guest-checkout", {}]);
  assert.deepEqual(express.cart.map((line) => line.sku), ["5530601"]);
  const placed = apply(express, ["place-order", CONTACT]);
  assert.deepEqual([placed.orders[0]?.lines.map((line) => line.sku), placed.cart.length, placed.express], [["5520101"], 1, null]);
  assert.equal(get(express, "cart")?.mutation?.operation, "clear-express");
});

test("arming starts the shopper over, and the product-page redesign removes the recorded Add to cart", () => {
  const busy = apply(createBigboxState(), ["consent", { choice: "accept" }], ["set-store", { storeId: "1187" }]);
  assert.deepEqual(apply(busy, ["set-mode", { mode: "redesigned-buy-box" }]), createBigboxState("redesigned-buy-box"));
  assert.equal(apply(busy, ["set-mode", { mode: "nope" }]), busy);
  const baseline = get(createBigboxState(), "ip/x/418830127")!.body!;
  const redesigned = get(createBigboxState("redesigned-buy-box"), "ip/x/418830127")!.body!;
  assert.match(baseline, /data-testid="atc">Add to cart</u);
  assert.doesNotMatch(redesigned, /data-testid="atc"/u);
  assert.match(redesigned, />Buy now</u);
  for (const fact of [...START_FACTS]) assert.match(render(createBigboxState(), context), new RegExp(`data-testid="${fact.subject}"`, "u"));
});

test("markup is deterministic per seed, every class is generated, and a new seed renames them all", () => {
  const home = render(createBigboxState(), context);
  assert.equal(home, render(createBigboxState(), context));
  const markup = (html: string) => html.replace(/<script[\s\S]*?<\/script>/gu, "");
  const classes = (html: string) => new Set([...markup(html).matchAll(/class="([^"]+)"/gu)].flatMap((match) => (match[1] ?? "").split(" ")).filter(Boolean));
  const mine = classes(home);
  assert.ok(mine.size > 40);
  for (const name of mine) assert.match(name, /^css-[a-z0-9]+$/u, name);
  const other = classes(render(createBigboxState(), { ...context, seed: 240 }));
  assert.equal([...mine].filter((name) => other.has(name)).length, 0);
  for (const html of [home, get(createBigboxState(), "search", "q=paper+towels")!.body!, get(createBigboxState(), "checkout")!.body!]) {
    assert.doesNotMatch(html, /Math\.random|Date\.now|new Date\(/u);
    assert.doesNotMatch(html, /walmart|amazon|target\.com/iu, "a fictional brand, never a real one");
  }
});

test("the site's live and repair tasks are in the shared catalogs, and every testid the recordings press is rendered", () => {
  for (const task of BIGBOX_RETAIL_LIVE_TASKS) assert.ok(LIVE_INSTRUCTION_TASKS.some((entry) => entry.id === task.id), task.id);
  for (const task of BIGBOX_RETAIL_REPAIR_TASKS) assert.ok(LIVE_REPAIR_TASKS.some((entry) => entry.id === task.id), task.id);
  const targets = [manifest.recordingScript, ...(manifest.workflows ?? []).map((workflow) => workflow.recordingScript)].flat().flatMap((step) => (step.target?.startsWith("testid:") ? [step.target.slice("testid:".length)] : []));
  assert.deepEqual([...new Set(targets)], ["atc"]);
});
