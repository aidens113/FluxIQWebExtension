import assert from "node:assert/strict";
import test from "node:test";
import { VOLTBAY_OFFICIAL_ID } from "../catalog/index.js";
import { crossborderMarketplaceManifest as manifest, INTERRUPTIONS, MARKET_SEED } from "../manifest/index.js";
import { crossborderMarketplaceScenario as scenario } from "../scenario.js";
import type { MarketState } from "../state/index.js";

/**
 * The interruption switch (`state/interruption.ts`) on the server side: which
 * load of which page the promotion stands over, that it keeps coming back
 * until closed, and that an inert close never closes it. The browser side --
 * that it is on the page before any step and that the inert glyph does nothing
 * -- is `browser-paths.test.ts`.
 */
const context = { runToken: "crossborder-interruption-token", seed: MARKET_SEED };
const TEMPLATE = 'id="fb-tpl-interrupt"';
const apply = (state: MarketState, operation: string, payload: unknown = {}) => scenario.mutate(state, operation, payload);
const armedWith = (variantId: string) => {
  const variant = manifest.variants!.find(({ id }) => id === variantId)!;
  return apply(scenario.createState(MARKET_SEED), variant.arm.operation, variant.arm.payload);
};

/** A GET as the server serves it: the page drawn from the state, then the state its load leaves behind. */
function load(state: MarketState, subpath: string): { body: string; state: MarketState } {
  const response = scenario.route!(state, { subpath, query: new URLSearchParams(), method: "GET" }, context);
  assert.ok(response, `${subpath} is served`);
  return { body: response.body ?? "", state: response.mutation ? apply(state, response.mutation.operation, response.mutation.payload) : state };
}

/** The home page as the browser gets it, then its own report of the load. */
function loadHome(state: MarketState): { body: string; state: MarketState } {
  return { body: scenario.render(state, context), state: apply(state, "beacon") };
}

const item = `item/${VOLTBAY_OFFICIAL_ID}`;
const bootOf = (body: string) => JSON.parse(/const boot = (\{.*\});/u.exec(body)![1]!) as { interruption: unknown };

test("an arm with an interruption starts the visit over on the chosen build; one the switch cannot read changes nothing", () => {
  const busy = apply(apply(scenario.createState(MARKET_SEED), "consent", { choice: "all" }), "add-to-cart", { listingId: VOLTBAY_OFFICIAL_ID, color: "Space Grey", spec: "7-in-1", origin: "Spain", quantity: 1 });
  const armed = apply(busy, "set-mode", { mode: "basket-redesign", interruption: { page: "cart", visit: 3, dismiss: "inert", delayMs: 500 } });
  assert.deepEqual([armed.mode, armed.cart, armed.consent], ["basket-redesign", [], "pending"]);
  assert.deepEqual(armed.interruption, { page: "cart", visit: 3, dismiss: "inert", delayMs: 500, loads: 0, status: "waiting" });
  assert.equal(apply(busy, "set-mode", { mode: "flash-deal" }).interruption, null, "a mode alone arms no interruption");
  for (const interruption of [
    { page: "order", visit: 1, dismiss: "closes" },
    { page: "item", visit: 0, dismiss: "closes" },
    { page: "item", visit: 1.5, dismiss: "closes" },
    { page: "item", visit: 1, dismiss: "sometimes" },
    { page: "item", visit: 1, dismiss: "closes", delayMs: -1 },
    { page: "item", visit: 1, dismiss: "closes", extra: true },
    "item",
  ]) assert.equal(apply(busy, "set-mode", { mode: "baseline", interruption }), busy, JSON.stringify(interruption));
});

test("before the first action: the home page's first load carries the promotion, opened at load, and every home load does until it is closed", () => {
  let state = armedWith("flash-deal-on-arrival");
  const first = loadHome(state);
  assert.ok(first.body.includes(TEMPLATE));
  assert.deepEqual(bootOf(first.body).interruption, { dismiss: "closes", delayMs: 0 });
  state = first.state;
  assert.equal(load(state, item).body.includes(TEMPLATE), false, "only the chosen page");
  const again = loadHome(state);
  assert.ok(again.body.includes(TEMPLATE), "unanswered, it comes back");
  state = apply(again.state, "interruption", { action: "close" });
  assert.equal(state.interruption?.status, "closed");
  const after = loadHome(state);
  assert.equal(after.body.includes(TEMPLATE), false);
  assert.equal(bootOf(after.body).interruption, null);
});

test("a chosen loop pass: the second product page carries the promotion and the first does not; other pages never count", () => {
  let state = armedWith("flash-deal-second-item");
  for (const subpath of ["cart", "search", "cart"]) state = load(state, subpath).state;
  state = loadHome(state).state;
  const first = load(state, item);
  assert.equal(first.body.includes(TEMPLATE), false, "the first pass is clear");
  const second = load(first.state, item);
  assert.ok(second.body.includes(TEMPLATE), "the second pass meets it");
  assert.equal(apply(first.state, "interruption", { action: "close" }), first.state, "nothing showing, nothing to close");
  const third = load(second.state, item);
  assert.ok(third.body.includes(TEMPLATE), "left open, it stands over the third pass too");
  const closed = apply(third.state, "interruption", { action: "close" });
  assert.equal(load(closed, item).body.includes(TEMPLATE), false);
});

test("an inert close: the promotion stands over the first product page and every one after it, and no close ever lands", () => {
  let state = armedWith("flash-deal-stuck");
  for (let pass = 1; pass <= 4; pass += 1) {
    const page = load(state, item);
    assert.ok(page.body.includes(TEMPLATE), `pass ${pass}`);
    assert.deepEqual(bootOf(page.body).interruption, { dismiss: "inert", delayMs: 0 });
    state = page.state;
    assert.equal(apply(state, "interruption", { action: "close" }), state, `pass ${pass}: the close is refused`);
  }
  assert.equal(state.interruption?.loads, 4);
});

test("unarmed and under every existing mode the switch is off", () => {
  for (const mode of ["baseline", "flash-deal", "basket-redesign", "list-layout"]) {
    const state = apply(scenario.createState(MARKET_SEED), "set-mode", { mode });
    assert.equal(loadHome(state).body.includes(TEMPLATE), false, mode);
    assert.equal(load(state, item).body.includes(TEMPLATE), false, mode);
  }
  assert.deepEqual(INTERRUPTIONS.stuck, { page: "item", visit: 1, dismiss: "inert" });
});
