import assert from "node:assert/strict";
import test from "node:test";
import { resolveScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { VOLTBAY_OFFICIAL_ID } from "../catalog/index.js";
import { CROSSBORDER_MARKETPLACE_LIVE_TASKS } from "../live-tasks.js";
import { crossborderMarketplaceManifest as manifest, MARKET_SEED } from "../manifest/index.js";
import { PERSON_CHECKS } from "../person-check.js";
import { crossborderMarketplaceScenario as scenario } from "../scenario.js";
import type { MarketState } from "../state/index.js";

/**
 * The timed check (`state/timed-check.ts`) on the server side: what the
 * `timed-check` variant arms, that every storefront page carries the box on a
 * timer rather than at load until a person passes it, that loading pages
 * never passes it, and that the task armed with it asks and is judged exactly
 * as the unarmed read. That it comes up in a browser with nothing done, stays,
 * and leaves in place once pressed is `timed-check-browser.test.ts`.
 */
const context = { runToken: "crossborder-timed-check-token", seed: MARKET_SEED };
const TEMPLATE = 'id="fb-tpl-timed-check"';
const WORKFLOW = "free-hubs-under-ten";
const apply = (state: MarketState, operation: string, payload: unknown = {}) => scenario.mutate(state, operation, payload);
const variant = () => manifest.workflows!.find(({ id }) => id === WORKFLOW)!.variants!.find(({ id }) => id === "timed-check")!;
const armed = () => apply(scenario.createState(MARKET_SEED), variant().arm.operation, variant().arm.payload);
const bootOf = (body: string) => JSON.parse(/const boot = (\{.*\});/u.exec(body)![1]!) as { timedCheck: unknown };

/** A storefront page as the server serves it, and the state its load leaves; the home page reports its own load. */
function load(state: MarketState, subpath: string): { body: string; state: MarketState } {
  if (subpath === "") return { body: scenario.render(state, context), state: apply(state, "beacon") };
  const response = scenario.route!(state, { subpath, query: new URLSearchParams(subpath === "search" ? "q=usb+c+hub" : ""), method: "GET" }, context);
  assert.ok(response, `${subpath} is served`);
  return { body: response.body ?? "", state: response.mutation ? apply(state, response.mutation.operation, response.mutation.payload) : state };
}

/** The timed check's own markup, as the template carries it. */
const layerOf = (body: string) => /<template id="fb-tpl-timed-check">([\s\S]*?)<\/template>/u.exec(body)?.[1] ?? "";

test("the variant starts the visit over with the check waiting on a timer; an arm the fixture cannot read changes nothing", () => {
  const busy = apply(apply(scenario.createState(MARKET_SEED), "consent", { choice: "all" }), "add-to-cart", { listingId: VOLTBAY_OFFICIAL_ID, color: "Space Grey", spec: "7-in-1", origin: "Spain", quantity: 1 });
  const state = apply(busy, variant().arm.operation, variant().arm.payload);
  assert.deepEqual([state.mode, state.cart, state.consent, state.interruption], ["baseline", [], "pending", null]);
  assert.deepEqual(state.timedCheck, { delayMs: 1500, status: "waiting" });
  assert.equal(scenario.createState(MARKET_SEED).timedCheck, null, "the site as it ships has none");
  for (const timedCheck of [{ delayMs: 0 }, { delayMs: 10_001 }, { delayMs: 1.5 }, { delayMs: "1000" }, { delayMs: 1000, extra: true }, {}, "soon", null]) {
    assert.equal(apply(busy, "set-mode", { mode: "baseline", timedCheck }), busy, JSON.stringify(timedCheck));
  }
});

test("every storefront page carries the check on its timer, never at load, and loading pages never passes it", () => {
  let state = armed();
  for (const subpath of ["", "search", `item/${VOLTBAY_OFFICIAL_ID}`, "cart", "", "search"]) {
    const served = load(state, subpath);
    assert.ok(served.body.includes(TEMPLATE), `${subpath || "home"} carries the check`);
    assert.deepEqual(bootOf(served.body).timedCheck, { delayMs: 1500 }, `${subpath || "home"} stamps it on its timer`);
    state = served.state;
    assert.equal(state.timedCheck?.status, "waiting", "a load is not a person passing it");
  }
});

test("the check asks a person to prove something, says nothing of checking by itself, and offers no way past but its box", () => {
  const layer = layerOf(load(armed(), "").body);
  assert.match(layer, /role="dialog" aria-modal="true"/u, "drawn as a modal dialog, as the checks it stands for are");
  assert.match(layer, /<h2[^>]*>Please confirm you are human<\/h2>/u);
  assert.match(layer, /Verify you are human/u);
  assert.doesNotMatch(layer, /checking (?:that |if |whether )?your browser|again automatically|verifying you are human/iu, "nothing tells a visitor it will clear by itself");
  assert.doesNotMatch(layer, /×|title="Close"|No thanks/u, "no close control");
  assert.match(layer, /z-index:90/u, "above every other layer, the welcome coupons' included");
  const timed = PERSON_CHECKS.checks.find(({ id }) => id === "timed-check")!;
  assert.ok(layer.includes(timed.shows), "it shows the words the Lab's person looks for");
  assert.deepEqual(timed.steps, [{ action: "click", text: "Verify you are human" }]);
  assert.equal(timed.clears, "in-place");
  assert.ok(!layer.includes("I'm not a robot"), "never taken for the traffic screen");
});

test("a person's pass takes it away for the rest of the visit; nothing else passes it", () => {
  const state = load(armed(), "").state;
  assert.equal(apply(state, "timed-check", { action: "close" }), state, "only a pass passes it");
  const passed = apply(state, "timed-check", { action: "pass" });
  assert.deepEqual(passed.timedCheck, { delayMs: 1500, status: "passed" });
  assert.equal(apply(passed, "timed-check", { action: "pass" }), passed, "passed once is passed");
  for (const subpath of ["", "search", `item/${VOLTBAY_OFFICIAL_ID}`]) {
    const served = load(passed, subpath);
    assert.ok(!served.body.includes(TEMPLATE), `${subpath || "home"} no longer carries it`);
    assert.equal(bootOf(served.body).timedCheck, null);
  }
  const unarmed = scenario.createState(MARKET_SEED);
  assert.equal(apply(unarmed, "timed-check", { action: "pass" }), unarmed, "no check armed, nothing to pass");
  assert.ok(!load(unarmed, "").body.includes(TEMPLATE), "the site as it ships shows none");
});

test("the traffic screen is unchanged by the check: the third results load is still the screen, with no timed box on it", () => {
  let state = armed();
  let body = "";
  for (let loads = 0; loads < 3; loads += 1) ({ body, state } = load(state, "search"));
  assert.equal(state.search.challenged, true);
  assert.ok(body.includes("I'm not a robot") && !body.includes(TEMPLATE));
});

test("the task armed with the check asks exactly what the read asks and is judged by the read's own oracle", () => {
  const base = CROSSBORDER_MARKETPLACE_LIVE_TASKS.find(({ id }) => id === "crossborder-marketplace-free-hubs-under-ten")!;
  const row = CROSSBORDER_MARKETPLACE_LIVE_TASKS.find(({ id }) => id === "crossborder-marketplace-free-hubs-under-ten-timed-check");
  assert.ok(row, "the row is in the catalog");
  assert.deepEqual({ ...row, id: base.id, personCheck: base.personCheck }, { ...base, variantId: "timed-check" }, "the same words, dataset and judge, armed for the build as well");
  assert.deepEqual(row.personCheck, { person: "completes", required: true, because: PERSON_CHECKS.handOffs.find(({ variantId }) => variantId === "timed-check")!.because });
  const unarmed = resolveScenarioWorkflow(manifest, { workflowId: WORKFLOW }).expected;
  const withCheck = resolveScenarioWorkflow(manifest, { workflowId: WORKFLOW, variantId: "timed-check" }).expected;
  assert.deepEqual(withCheck, unarmed, "the oracle, the final state and the console allowance are the read's");
});
