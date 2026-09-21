import assert from "node:assert/strict";
import test from "node:test";
import { resolveScenarioWorkflow, scenarioPageFactSchedule, validateWebScenario } from "@fluxiq-web-extension/test-contracts";
import { AD_ONLY_LISTINGS, listingById, ORGANIC_LISTINGS, searchResults, STORES, VOLTBAY_LOOKALIKE_ID, VOLTBAY_OFFICIAL_ID, type SearchQuery } from "../catalog/index.js";
import { formatMoney } from "../locale/index.js";
import { cartLineText, crossborderMarketplaceManifest as manifest, MARKET_SEED, orderRecord, spainHubRecords } from "../manifest/index.js";
import { crossborderMarketplaceScenario as scenario } from "../scenario.js";
import { marketModes, orderNumber, type MarketMode, type MarketState } from "../state/index.js";
import { marketClasses } from "../styles/index.js";

type Selection = { workflowId?: string; variantId?: string };

const context = { runToken: "crossborder-unit-token", seed: MARKET_SEED };
const fresh = () => scenario.createState(MARKET_SEED);
const apply = (state: MarketState, operation: string, payload: unknown = {}) => scenario.mutate(state, operation, payload);
const armed = (mode: MarketMode) => apply(fresh(), "set-mode", { mode });
const route = (state: MarketState, subpath: string, query = "") => scenario.route!(state, { subpath, query: new URLSearchParams(query), method: "GET" }, context);
/** A GET as the server serves it: the response, then the state its mutation leaves behind. */
function visit(state: MarketState, subpath: string, query = ""): { body: string; status: number; headers: Record<string, string>; state: MarketState } {
  const response = route(state, subpath, query);
  assert.ok(response, `${subpath} is served`);
  const next = response.mutation ? apply(state, response.mutation.operation, response.mutation.payload) : state;
  return { body: response.body ?? "", status: response.status, headers: response.headers ?? {}, state: next };
}
const query = (overrides: Partial<SearchQuery> = {}): SearchQuery => ({ q: "usb c hub", shipFrom: [], freeShipping: false, fourStars: false, minCents: null, maxCents: null, sort: "default", page: 1, ...overrides });
const HUB_LINE = { listingId: VOLTBAY_OFFICIAL_ID, color: "Space Grey", spec: "7-in-1", origin: "Spain" };

function selections(): Selection[] {
  return [undefined, ...(manifest.workflows ?? []).map(({ id }) => id)].flatMap((workflowId) => {
    const workflow = workflowId === undefined ? manifest : manifest.workflows?.find(({ id }) => id === workflowId);
    return [undefined, ...(workflow?.variants ?? []).map(({ id }) => id)]
      .map((variantId): Selection => ({ ...(workflowId ? { workflowId } : {}), ...(variantId ? { variantId } : {}) }));
  });
}

test("the manifest is valid, with three workflows and three variants, each arming one mode and judged on succeeding", () => {
  const result = validateWebScenario(manifest);
  assert.equal(result.valid, true, result.valid ? "" : JSON.stringify(result.issues));
  assert.deepEqual(manifest.workflows?.map(({ id }) => id), ["spain-hubs", "place-order"]);
  assert.deepEqual([manifest, ...(manifest.workflows ?? [])].map((workflow) => (workflow.variants ?? []).map(({ id }) => id)), [["basket-redesign", "flash-deal"], ["list-layout"], []]);
  for (const variant of [...(manifest.variants ?? []), ...(manifest.workflows ?? []).flatMap(({ variants }) => variants ?? [])]) {
    assert.deepEqual(variant.arm, { operation: "set-mode", payload: { mode: variant.id } });
    assert.ok((marketModes as readonly string[]).includes(variant.id));
  }
  for (const selection of selections()) {
    const { expected } = resolveScenarioWorkflow(manifest, selection);
    assert.ok((expected.finalState ?? []).length > 0, JSON.stringify(selection));
    assert.equal(expected.failure, undefined, JSON.stringify(selection));
    const { atLoad, afterArm } = scenarioPageFactSchedule(manifest, selection, "arms-after-loading");
    assert.ok(atLoad.length > 0);
    if (selection.variantId !== undefined) assert.ok(afterArm.length > 0);
  }
});

test("state depends on the seed only where a build or an order sequence would, and an arm starts the visit over", () => {
  assert.deepEqual(scenario.createState(MARKET_SEED), scenario.createState(MARKET_SEED));
  const other = scenario.createState(1);
  assert.deepEqual({ ...other, seed: MARKET_SEED }, fresh());
  const busy = apply(apply(fresh(), "consent", { choice: "all" }), "add-to-cart", { ...HUB_LINE, quantity: 1 });
  const rearmed = apply(busy, "set-mode", { mode: "flash-deal" });
  assert.equal(rearmed.consent, "pending");
  assert.deepEqual(rearmed.cart, []);
  assert.equal(rearmed.mode, "flash-deal");
  const untouched = fresh();
  assert.equal(apply(untouched, "set-mode", { mode: "nonsense" }), untouched);
  assert.equal(apply(fresh(), "no-such-operation").activity.length, 0);
  assert.notDeepEqual(marketClasses(1, "baseline"), marketClasses(MARKET_SEED, "baseline"));
  const shipped = marketClasses(MARKET_SEED, "baseline");
  const redesigned = marketClasses(MARKET_SEED, "basket-redesign");
  const renamed = (Object.keys(shipped) as Array<keyof typeof shipped>).filter((role) => shipped[role] !== redesigned[role]);
  assert.deepEqual(renamed.sort(), ["addCart", "buyBar", "buyNow", "buyTotal"], "the redesign restyled the buy bar and nothing else");
  const names = Object.values(shipped);
  assert.equal(new Set(names).size, names.length, "every role has its own hash");
});

test("the catalogue: forty-five organic hubs, five paid-only listings, and exactly thirteen that meet the Spain task", () => {
  assert.equal(ORGANIC_LISTINGS.length, 45);
  assert.equal(AD_ONLY_LISTINGS.length, 5);
  const ids = [...ORGANIC_LISTINGS, ...AD_ONLY_LISTINGS].map(({ id }) => id);
  assert.equal(new Set(ids).size, ids.length);
  for (const listing of [...ORGANIC_LISTINGS, ...AD_ONLY_LISTINGS]) {
    assert.ok(STORES.has(listing.storeId), listing.id);
    assert.match(listing.id, /^\d{13}$/u);
    assert.ok(listing.originalCents > listing.priceCents, listing.id);
  }
  assert.equal(listingById(VOLTBAY_OFFICIAL_ID)!.title, listingById(VOLTBAY_LOOKALIKE_ID)!.title, "the lookalike copied the title");
  assert.equal(ORGANIC_LISTINGS.filter((listing) => listing.origins.includes("Spain")).length, 20);
  const records = spainHubRecords();
  assert.equal(records.length, 13);
  assert.equal(new Set(records.map(({ title, store }) => `${title}|${store}`)).size, 13);
  assert.ok(records.some(({ store }) => store === "VoltBay Store") && records.some(({ store }) => store === "Voltbay Official Store"), "both Voltbay listings qualify, and they are two records");
  assert.deepEqual(records[0], { title: listingById("1005008633510")!.title, store: "Castellan Gadgets ES", price: "16,49 €", rating: "4.8" });
});

test("broad results page as the live search does: three pages, paid slots at 2, 9 and 16, and three results repeated across pages", () => {
  const pages = [1, 2, 3].map((page) => searchResults(query({ page })));
  assert.deepEqual(pages.map(({ slots }) => slots.length), [20, 20, 17]);
  assert.ok(pages.every(({ pageCount, unfilteredCount }) => pageCount === 3 && unfilteredCount === 45));
  for (const { slots } of pages) assert.deepEqual(slots.flatMap((slot, index) => (slot.sponsored ? [index] : [])), [1, 8, 15]);
  const organicIds = pages.flatMap(({ slots }) => slots.filter((slot) => !slot.sponsored).map((slot) => slot.listing.id));
  assert.equal(organicIds.length, 48);
  assert.equal(new Set(organicIds).size, 45);
  assert.deepEqual(pages[1]!.slots.filter((slot) => !slot.sponsored).slice(0, 2).map((slot) => slot.listing.id), [ORGANIC_LISTINGS[16]!.id, ORGANIC_LISTINGS[14]!.id]);
  assert.equal(pages[2]!.slots[0]!.listing.id, ORGANIC_LISTINGS[31]!.id);
  const narrowed = searchResults(query({ shipFrom: ["Spain"], freeShipping: true, fourStars: true }));
  assert.equal(narrowed.pageCount, 1);
  assert.equal(narrowed.slots.length, 19);
  assert.equal(narrowed.unfilteredCount, 45, "the header count stays the unfiltered one");
  assert.ok(narrowed.slots.some((slot) => slot.sponsored && slot.listing.category.includes("Chargers")), "a sponsored slot ignores the filters");
  assert.equal(searchResults(query({ shipFrom: ["Spain"] })).pageCount, 2);
  assert.equal(searchResults(query({ q: "garden hose" })).slots.length, 0);
  const cheapest = searchResults(query({ sort: "price_asc" })).slots.filter((slot) => !slot.sponsored);
  assert.ok(cheapest.every((slot, index) => index === 0 || cheapest[index - 1]!.listing.priceCents <= slot.listing.priceCents));
});

test("every third results page is the traffic check until it is answered, and answering it resets the count", () => {
  let state = fresh();
  const bodies: string[] = [];
  for (const page of ["", "&page=2", "&page=3", "&page=3"]) {
    const served = visit(state, "search", `q=usb+c+hub${page}`);
    bodies.push(served.body.includes("I'm not a robot") ? "check" : "results");
    state = served.state;
  }
  assert.deepEqual(bodies, ["results", "results", "check", "check"]);
  assert.equal(state.search.challenged, true);
  state = apply(state, "verify-human");
  assert.deepEqual(state.search, { loadsSinceCheck: 0, challenged: false, checksPassed: 1 });
  const unchallenged = fresh();
  assert.equal(apply(unchallenged, "verify-human"), unchallenged, "there is nothing to answer before the check appears");
  assert.ok(visit(state, "search", "q=usb+c+hub&page=3").body.includes("results for “usb c hub”"));
});

test("the feed refuses its second request with 429 and a retry-after, and serves the retry", () => {
  let state = fresh();
  const statuses: number[] = [];
  for (const page of [2, 3, 3, 4]) {
    const served = visit(state, "feed", `page=${page}`);
    statuses.push(served.status);
    if (served.status === 429) assert.equal(served.headers["retry-after"], "3");
    state = served.state;
  }
  assert.deepEqual(statuses, [200, 429, 200, 200]);
  assert.equal(route(fresh(), "feed", "page=9"), undefined);
});

test("the coupon's first claim fails and its second collects it, and a store without one has nothing to claim", () => {
  const once = apply(fresh(), "claim-coupon", { storeId: "voltbay-official" });
  assert.deepEqual(once.coupons.stores, []);
  const twice = apply(once, "claim-coupon", { storeId: "voltbay-official" });
  assert.deepEqual(twice.coupons.stores, ["voltbay-official"]);
  assert.equal(apply(twice, "claim-coupon", { storeId: "voltbay-official" }), twice);
  const noCoupon = fresh();
  assert.equal(apply(noCoupon, "claim-coupon", { storeId: "hubsmith" }), noCoupon, "a store with no coupon has nothing to claim");
});

test("the cart takes only option sets the listing sells, within stock, and tops up an identical line", () => {
  const state = fresh();
  assert.deepEqual(apply(state, "add-to-cart", { ...HUB_LINE, quantity: 5 }).cart, [], "only four in stock");
  assert.deepEqual(apply(state, "add-to-cart", { ...HUB_LINE, origin: "Poland", quantity: 1 }).cart, [], "sold out in Poland");
  assert.deepEqual(apply(state, "add-to-cart", { ...HUB_LINE, spec: "", quantity: 1 }).cart, [], "a hub needs a specification");
  const three = apply(state, "add-to-cart", { ...HUB_LINE, quantity: 3 });
  assert.deepEqual(three.cart.map(({ quantity }) => quantity), [3]);
  assert.equal(apply(three, "add-to-cart", { ...HUB_LINE, quantity: 2 }), three, "three plus two is past the stock");
  assert.deepEqual(apply(three, "add-to-cart", { ...HUB_LINE, quantity: 1 }).cart.map(({ quantity }) => quantity), [4]);
  const both = apply(three, "add-to-cart", { ...HUB_LINE, listingId: VOLTBAY_LOOKALIKE_ID, quantity: 1 });
  assert.equal(both.cart.length, 2);
  const withCoupon = apply(apply(three, "claim-coupon", { storeId: "voltbay-official" }), "claim-coupon", { storeId: "voltbay-official" });
  const page = visit(withCoupon, "cart").body;
  assert.ok(page.includes(cartLineText()), "the cart flyout writes the line the goal expects");
  assert.ok(visit(withCoupon, "flyouts").body.includes("Voltbay Official Store 2,00 € off orders over 25,00 €"));
});

test("an order needs the Visa; a filled fax field holds it for review; a clean one is paid, numbered and uses up the coupon", () => {
  let state = apply(apply(fresh(), "claim-coupon", { storeId: "voltbay-official" }), "claim-coupon", { storeId: "voltbay-official" });
  state = apply(state, "buy-now", { ...HUB_LINE, quantity: 2 });
  assert.equal(apply(state, "place-order", { fax: "" }), state, "no payment method chosen");
  assert.equal(apply(state, "choose-payment", { methodId: "mc-9021" }), state, "the Mastercard has expired");
  const paying = apply(state, "choose-payment", { methodId: "visa-4417" });
  const held = apply(paying, "place-order", { fax: "+49 30 1" });
  assert.deepEqual(held.orders.map(({ status }) => status), ["review"]);
  assert.deepEqual(held.coupons.stores, ["voltbay-official"], "a held order takes nothing");
  assert.equal(route(held, `order/${held.orders[0]!.number}`), undefined, "a held order has no confirmation page");
  const paid = apply(paying, "place-order", { fax: "", note: "Please pack carefully" });
  const order = paid.orders[0]!;
  assert.equal(order.status, "paid");
  assert.equal(order.number, orderNumber(MARKET_SEED, 0));
  assert.match(order.number, /^81\d{14}$/u);
  assert.equal(formatMoney(order.totals.totalCents, "DE"), "43,98 €");
  assert.deepEqual(paid.coupons.stores, []);
  assert.equal(paid.checkout, null);
  const confirmation = visit(paid, `order/${order.number}`).body;
  for (const value of Object.values(orderRecord())) assert.ok(confirmation.includes(value), value);
});

test("prices and dates follow the buyer's region", () => {
  assert.equal(formatMoney(123456, "DE"), "1.234,56 €");
  assert.equal(formatMoney(2299, "GB"), "£19.77");
  assert.equal(formatMoney(2299, "US"), "US $25.06");
  const british = visit(apply(fresh(), "region", { region: "GB" }), `item/${VOLTBAY_OFFICIAL_ID}`).body;
  assert.ok(british.includes("£10.74"));
  assert.ok(british.includes("6 – 14 Oct"));
});

test("ids are minted per page load, and the only test id on a control is the shipping buy bar's", () => {
  const first = visit(fresh(), `item/${VOLTBAY_OFFICIAL_ID}`);
  const second = visit(first.state, `item/${VOLTBAY_OFFICIAL_ID}`);
  const ids = (html: string) => [...html.matchAll(/ id="(fb[0-9a-z]+)"/gu)].map((match) => match[1]);
  assert.ok(ids(first.body).length >= 4);
  assert.notDeepEqual(ids(first.body), ids(second.body));
  const testIds = new Set([...first.body.matchAll(/data-testid="([^"]+)"/gu)].map((match) => match[1]));
  assert.deepEqual([...testIds].sort(), ["add-to-cart", "build-marker", "mini-cart-count", "orders-summary", "store-coupons"]);
  const redesigned = visit(armed("basket-redesign"), `item/${VOLTBAY_OFFICIAL_ID}`).body;
  assert.ok(!redesigned.includes('data-testid="add-to-cart"'));
  assert.ok(redesigned.indexOf("Add to basket") < redesigned.indexOf("Buy now"), "Buy now now sits where Add to cart did");
  const home = scenario.render(fresh(), context);
  assert.ok(!/aria-label|role="button"/u.test(home.slice(0, home.indexOf("<script"))), "no accessibility helpers the live site lacks");
});
