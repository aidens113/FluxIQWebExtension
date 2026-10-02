// A web Flow step that cannot run continues where the page is, end to end
// (t243): Core's real executor (`runAutomationStudioGraph`) with the web host
// runtime's real route signer, comparator and step effect, on route states
// shaped as `webAutomationRouteState` writes them and modelled on the
// bigbox-retail fixture.
//
// Each node's `metadata.routeSignatures` ({ before, after, effect }) is written
// from the route states either side of its step with the web signer and
// effect, as a build records them. Only the page reads (`observeRouteState`)
// and the step dispatches are scripted; no browser is involved.
//
// The proofs are that a page already past a step goes on at the next step, that
// a store the site already chose is passed over by the choose-store step's own
// effect, and that the out-of-stock twin does not route and records `no_match`.

import assert from "node:assert/strict";
import test from "node:test";
import { runAutomationStudioGraph, type AutomationStudioFlowDocument, type AutomationStudioFlowNode, type AutomationStudioGraphExecutionOptions, type AutomationStudioGraphExecutionTrace } from "fluxiq/automation-studio";
import type { JsonObject } from "fluxiq/core";
import { WEB_AUTOMATION_FAILURE_CODES, webAutomationFailureRecord } from "../failure";
import { createWebAutomationHostRuntime } from "../host-runtime";

type Host = NonNullable<AutomationStudioGraphExecutionOptions["hostRuntime"]>;
type Dispatcher = NonNullable<AutomationStudioGraphExecutionOptions["effectDispatcher"]>;

/** The members a build and a run use for routing, taken from the real web boundary; the browser is never reached. */
const web = createWebAutomationHostRuntime({
  dispatch: async () => {
    throw new Error("No browser in this test.");
  }
});
const signRouteState = need(web.signRouteState, "signRouteState");
const compareRouteSignatures = need(web.compareRouteSignatures, "compareRouteSignatures");
const signRouteEffect = need(web.signRouteEffect, "signRouteEffect");
const routeEffectHolds = need(web.routeEffectHolds, "routeEffectHolds");

function need<T>(value: T | undefined, name: string): T {
  if (value === undefined) throw new Error(`The web host runtime does not bind ${name}.`);
  return value;
}

/** A route state as `webAutomationRouteState` writes one: names joined by " | ", absent fields left out. */
function routeState(page: { location: string; title: string; dialog?: string; blockedBy?: string; controls: readonly string[] }): JsonObject {
  const value: JsonObject = { location: page.location, path: new URL(page.location).pathname, title: page.title };
  if (page.dialog !== undefined) value.dialog = page.dialog;
  if (page.blockedBy !== undefined) value.blockedBy = page.blockedBy;
  value.controls = [...new Set(page.controls)].join(" | ");
  return { page: value };
}

/** The signatures and effect a build records for a step that started on `before` and left `after`. */
function recorded(before: JsonObject, after: JsonObject): JsonObject {
  return { routeSignatures: { before: signRouteState(before), after: signRouteState(after), effect: signRouteEffect(before, after) } };
}

function step(id: string, label: string, outputId: string, metadata: JsonObject): AutomationStudioFlowNode {
  return {
    id,
    definitionId: "builtin.policy.action",
    label,
    parameterValues: { outputId, parameters: { stepId: id } } as NonNullable<AutomationStudioFlowNode["parameterValues"]>,
    metadata
  };
}

function line(nodes: AutomationStudioFlowNode[]): AutomationStudioFlowDocument {
  const edges = nodes.slice(1).map((node, index) => ({ id: `${nodes[index]!.id}.success`, sourceNodeId: nodes[index]!.id, sourcePortId: "success", targetNodeId: node.id, targetPortId: "in" }));
  return { schemaVersion: "0.1", flowId: "flow.web-state-routing", ownerKind: "routine", ownerId: "routine.test", name: "Web state routing", createdAt: 1, updatedAt: 1, nodes, edges };
}

/** The page the run stands on, read through the real signer, comparator and effect. */
type Page = { current: JsonObject; observed: number };

function host(page: Page): Host {
  return {
    capabilities: ["route-state"],
    observeRouteState: () => {
      page.observed += 1;
      return page.current;
    },
    signRouteState,
    compareRouteSignatures,
    signRouteEffect,
    routeEffectHolds
  };
}

/** The domain's own failure for a target that is not on the page. */
const NOT_FOUND = webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.TARGET_NOT_FOUND);

/** Runs the step a node names. `absent` steps find no target; a step that lands moves the page to `leads[id]`, when given. */
function dispatcher(page: Page, calls: string[], absent: ReadonlySet<string>, leads: Readonly<Record<string, JsonObject>> = {}): Dispatcher {
  return (effect) => {
    const id = /"stepId":"([^"]+)"/u.exec(JSON.stringify(effect.payload ?? null))?.[1] ?? "?";
    calls.push(id);
    if (absent.has(id)) return { status: "failed", route: "failed", message: "No element matched the step's target.", failure: { ...NOT_FOUND } };
    const next = leads[id];
    if (next) page.current = next;
    return { status: "success", route: "success", outputs: { ok: true } };
  };
}

async function run(flow: AutomationStudioFlowDocument, page: Page, calls: string[], absent: ReadonlySet<string>, leads: Readonly<Record<string, JsonObject>> = {}): Promise<AutomationStudioGraphExecutionTrace> {
  return await runAutomationStudioGraph(flow, { delay: async () => undefined, hostRuntime: host(page), effectDispatcher: dispatcher(page, calls, absent, leads) });
}

// bigbox-retail, as its shell, store picker and product page render it.
const ROOT = "https://bigbox.test/scenarios/bigbox-retail/";
const TITLE = "ValueRidge";
const SHELL = ["Search", "Weekly ad", "Household Essentials", "Grocery", "Sign in", "Cart"];
const chip = (store: string) => `Pickup or delivery? ${store}`;
const FLYOUT = ["×", "Pickup", "Delivery", "Set as my store"];
const PICKER = "Pickup or delivery? store picker";
const TOWELS = `${ROOT}ip/valueridge-essentials-select-a-size-paper-towels/418830127`;
const TOWELS_CONTROLS = ["Add to cart", "See more reviews", "Quantity", "Pickup", "Delivery", "ValueRidge Essentials"];
const ADDED_PANEL = "Added to cart";

const home = (store: string) => routeState({ location: ROOT, title: TITLE, controls: [...SHELL, chip(store), "Shop paper towels", "Shop pantry"] });
const results = routeState({
  location: `${ROOT}search?q=paper+towels`,
  title: TITLE,
  controls: [...SHELL, chip("Carden Falls Supercenter"), "Sort by", "Best seller", "Price", "Brand", "ValueRidge Essentials Select-A-Size Paper Towels", "Loftwell Ultra Strong Paper Towels, 6 Double Rolls", "Softerra Pick-A-Sheet Paper Towels, 8 Triple Rolls", "Next page"]
});
const product = routeState({ location: TOWELS, title: TITLE, controls: [...SHELL, chip("Carden Falls Supercenter"), ...TOWELS_CONTROLS] });
const productAdded = routeState({ location: TOWELS, title: TITLE, blockedBy: ADDED_PANEL, controls: [...SHELL, chip("Carden Falls Supercenter"), ...TOWELS_CONTROLS, "View cart", "Continue shopping"] });

test("a page already past a step goes on at the next step, and the passed step is recorded state_routed forward", async () => {
  const flow = line([
    step("search", "Search for paper towels", "web.dom.type", recorded(home("Carden Falls Supercenter"), results)),
    step("open-result", "Open the first result", "web.dom.click", recorded(results, product)),
    step("add-to-cart", "Add to cart", "web.dom.click", recorded(product, productAdded))
  ]);
  const page: Page = { current: home("Carden Falls Supercenter"), observed: 0 };
  const calls: string[] = [];
  // The site sends a search with one strong match straight to its product page.
  const trace = await run(flow, page, calls, new Set(["open-result"]), { search: product, "add-to-cart": productAdded });

  assert.equal(trace.status, "succeeded");
  assert.deepEqual(calls, ["search", "open-result", "add-to-cart"]);
  assert.deepEqual(trace.attempts.map((attempt) => attempt.nodeId), ["search", "open-result", "add-to-cart"]);
  const passed = trace.attempts[1]!;
  assert.equal(passed.status, "succeeded");
  assert.equal(passed.route, "state_routed");
  assert.deepEqual(passed.skipped, { reason: "state_routed", code: "web.target.not_found", toNodeId: "add-to-cart", direction: "forward" });
  assert.equal(passed.stateRouting?.toNodeId, "add-to-cart");
  assert.equal(passed.stateRouting?.direction, "forward");
  // The step's own effect -- the product page it opened -- is the page, and
  // Core asks the effect before it matches pre-states, so a build that
  // recorded effects routes here by `effect_holds`, not by matching.
  assert.equal(passed.stateRouting?.outcome, "effect_holds");
  assert.equal("failure" in passed, false);
  assert.equal("recoveryDecision" in passed, false);
  assert.equal(page.observed, 1);
  assert.equal(trace.defence, undefined);
});

test("the same page past a step, on nodes recorded without an effect, routes by matching add-to-cart's pre-state", async () => {
  // A build records no effect for a step that started on a page it did not
  // capture (Core `build-routing.ts`); the step's pre- and post-states may
  // still be signed. Only the matching rule decides then.
  const withoutEffect = (before: JsonObject, after: JsonObject): JsonObject => ({ routeSignatures: { before: signRouteState(before), after: signRouteState(after) } });
  const flow = line([
    step("search", "Search for paper towels", "web.dom.type", withoutEffect(home("Carden Falls Supercenter"), results)),
    step("open-result", "Open the first result", "web.dom.click", withoutEffect(results, product)),
    step("add-to-cart", "Add to cart", "web.dom.click", withoutEffect(product, productAdded))
  ]);
  const page: Page = { current: home("Carden Falls Supercenter"), observed: 0 };
  const calls: string[] = [];
  const trace = await run(flow, page, calls, new Set(["open-result"]), { search: product, "add-to-cart": productAdded });

  assert.equal(trace.status, "succeeded");
  assert.deepEqual(calls, ["search", "open-result", "add-to-cart"]);
  const passed = trace.attempts[1]!;
  assert.equal(passed.route, "state_routed");
  assert.deepEqual(passed.skipped, { reason: "state_routed", code: "web.target.not_found", toNodeId: "add-to-cart", direction: "forward" });
  // Candidates are search and add-to-cart (the failing node never is); search
  // acted and its after-state (the results page) is not the page, so it is
  // still a candidate, and only add-to-cart's pre-state matches.
  assert.deepEqual(passed.stateRouting, { outcome: "routed", candidates: 2, matched: 1, toNodeId: "add-to-cart", direction: "forward", closeness: 1 });
  assert.equal(page.observed, 1);
});

test("a store the site already chose is passed over by the choose-store step's own effect (store-remembered)", async () => {
  // Recorded on a fresh visit: the chip named Carden Falls, the picker was
  // opened, Millbrook's "Set as my store" chosen, and the picker closed.
  const recordedHome = home("Carden Falls Supercenter");
  const recordedPicker = routeState({ location: ROOT, title: TITLE, blockedBy: PICKER, controls: [...SHELL, chip("Carden Falls Supercenter"), "Shop paper towels", "Shop pantry", ...FLYOUT] });
  const recordedChosen = home("Millbrook Crossing Supercenter");
  const recordedResults = routeState({ location: `${ROOT}search?q=paper+towels`, title: TITLE, controls: [...SHELL, chip("Millbrook Crossing Supercenter"), "Sort by", "Next page"] });
  const flow = line([
    step("open-store-picker", "Open the store picker", "web.dom.click", recorded(recordedHome, recordedPicker)),
    step("choose-millbrook", "Choose Millbrook Crossing Supercenter", "web.dom.click", recorded(recordedPicker, recordedChosen)),
    step("type-search", "Search for paper towels", "web.dom.type", recorded(recordedChosen, recordedResults))
  ]);
  // The site remembered Millbrook: opening the picker leaves it in front, the
  // chip already names Millbrook and its card offers no "Set as my store".
  const rememberedPicker = routeState({ location: ROOT, title: TITLE, blockedBy: PICKER, controls: [...SHELL, chip("Millbrook Crossing Supercenter"), "Shop paper towels", "Shop pantry", ...FLYOUT] });
  const page: Page = { current: home("Millbrook Crossing Supercenter"), observed: 0 };
  const calls: string[] = [];
  const trace = await run(flow, page, calls, new Set(["choose-millbrook"]), { "open-store-picker": rememberedPicker, "type-search": recordedResults });

  // The layer the run opened is in front, so no later pre-state matches it.
  assert.equal(compareRouteSignatures(signRouteState(recordedChosen), signRouteState(rememberedPicker)).matches, false);
  assert.equal(trace.status, "succeeded");
  assert.deepEqual(calls, ["open-store-picker", "choose-millbrook", "type-search"]);
  const passed = trace.attempts[1]!;
  assert.equal(passed.status, "succeeded");
  assert.equal(passed.route, "state_routed");
  assert.deepEqual(passed.skipped, { reason: "state_routed", code: "web.target.not_found", toNodeId: "type-search", direction: "forward" });
  assert.equal(passed.stateRouting?.outcome, "effect_holds");
  assert.equal(passed.stateRouting?.toNodeId, "type-search");
  assert.equal(passed.stateRouting?.direction, "forward");
  assert.equal("failure" in passed, false);
  assert.equal(page.observed, 1);
  // Hashes and counts only: no route state or signature reaches the trace.
  assert.doesNotMatch(JSON.stringify(trace), /Millbrook|"controls"|"added"/u);
});

test("the out-of-stock twin does not route, and records no_match", async () => {
  const flow = line([
    step("open-result", "Open the first result", "web.dom.click", recorded(results, product)),
    step("add-to-cart", "Add to cart", "web.dom.click", recorded(product, productAdded)),
    step("view-cart", "View cart", "web.dom.click", recorded(productAdded, routeState({ location: `${ROOT}cart`, title: TITLE, controls: [...SHELL, "Remove", "Check out"] })))
  ]);
  // Out of stock: the product page has no Add to cart and no cart panel opens.
  const outOfStock = routeState({ location: TOWELS, title: TITLE, controls: [...SHELL, chip("Carden Falls Supercenter"), "See more reviews", "Quantity", "Pickup", "Delivery", "ValueRidge Essentials"] });
  const page: Page = { current: results, observed: 0 };
  const calls: string[] = [];
  const trace = await run(flow, page, calls, new Set(["add-to-cart"]), { "open-result": outOfStock });

  const attempts = trace.attempts.filter((attempt) => attempt.nodeId === "add-to-cart");
  assert.ok(attempts.length > 0);
  for (const attempt of attempts) {
    assert.equal(attempt.status, "failed");
    assert.notEqual(attempt.route, "state_routed");
    assert.equal(attempt.skipped, undefined);
    assert.equal(attempt.stateRouting?.outcome, "no_match");
    assert.equal(attempt.stateRouting?.matched, 0);
    assert.equal(attempt.failure?.code, "web.target.not_found");
    assert.notEqual(attempt.recoveryDecision, undefined);
  }
  assert.equal(trace.attempts.some((attempt) => attempt.route === "state_routed"), false);
});
