import assert from "node:assert/strict";
import test from "node:test";
import { resolveScenarioWorkflow, validateWebScenario } from "@fluxiq-web-extension/test-contracts";
import type { ScenarioRouteResponse } from "../../../types.js";
import { multiTabScenario as scenario } from "../scenario.js";
import type { MultiTabState } from "../transitions.js";

const context = { runToken: "fixture-run-token-1234", seed: 118 };
const SEED_118_ORDERS = [
  { order: "PO-4471", supplier: "Litware Office Supply", status: "Awaiting approval", buyer: "S. Moreau", delivery: "2026-10-14", total: "$3,022.18" },
  { order: "PO-4472", supplier: "Tailspin Freight", status: "Awaiting approval", buyer: "J. Lindqvist", delivery: "2026-10-05", total: "$7,183.04" },
  { order: "PO-4473", supplier: "Fabrikam Industrial", status: "Approved", buyer: "M. Okafor", delivery: "2026-11-27", total: "$5,505.08" },
  { order: "PO-4474", supplier: "Adatum Lab Goods", status: "Partially received", buyer: "M. Okafor", delivery: "2026-10-20", total: "$5,423.57" },
];
const ORDER_NUMBERS = ["PO-4471", "PO-4472", "PO-4473", "PO-4474"];

const fresh = (seed = 118) => scenario.createState(seed);
const apply = (state: MultiTabState, operation: string, payload: unknown = {}) => scenario.mutate(state, operation, payload);

function route(state: MultiTabState, subpath: string, query = "", method: "GET" | "HEAD" = "GET"): ScenarioRouteResponse | undefined {
  if (!scenario.route) throw new Error("multi-tab must define a route");
  return scenario.route(state, { subpath, query: new URLSearchParams(query), method }, context);
}

/** Runs `action` with `Math.random` and `Date.now` replaced by functions that throw. */
function withoutRandomOrClock<T>(action: () => T): T {
  const random = Math.random;
  const now = Date.now;
  Math.random = () => { throw new Error("multi-tab used Math.random"); };
  Date.now = () => { throw new Error("multi-tab read the clock"); };
  try { return action(); } finally { Math.random = random; Date.now = now; }
}

test("the manifest is a valid W15 workflow whose every target exists where its step runs", () => {
  const manifest = scenario.manifest;
  const result = validateWebScenario(manifest);
  assert.ok(result.valid, JSON.stringify(result));
  assert.deepEqual([manifest.id, manifest.seed, manifest.startPath], ["multi-tab", 118, "/scenarios/multi-tab/"]);
  assert.equal(manifest.networkPolicy, "loopback-only");
  assert.equal(manifest.workflows, undefined);
  assert.deepEqual(manifest.recordingScript.map((step) => step.operation),
    ["click", "switchTab", "waitForState", "extract", "closeTab", "waitForState", "click", "waitForState", "checkpoint"]);

  const list = scenario.render(fresh(), context);
  const link = /<a href="([^"]+)" target="_blank" rel="noopener" data-open-order="PO-4472" data-testid="open-details-po-4472"/.exec(list);
  assert.ok(link, "the clicked link opens a new tab");
  const switchStep = manifest.recordingScript.find((step) => step.operation === "switchTab");
  assert.equal(new URL(link[1]!, "http://127.0.0.1").pathname, switchStep?.path);

  const details = route(fresh(), "details/PO-4472", "via=link")?.body ?? "";
  const reviewedList = scenario.render(apply(apply(fresh(), "record-visit", { order: "PO-4472", via: "link" }), "confirm-review", { order: "PO-4472" }), context);
  const pageFor: Record<string, string> = {
    "open-order-details": list, "details-loaded": details, "extract-order-details": details,
    "order-list-restored": list, "confirm-order-review": list, "review-recorded": reviewedList,
  };
  for (const step of manifest.recordingScript.filter((candidate) => candidate.target)) {
    assert.match(pageFor[step.id] ?? "", new RegExp(`data-testid="${step.target!.slice("testid:".length)}"`), step.id);
  }
  assert.doesNotMatch(list, /data-testid="reviewed-po-4472"/);

  assert.deepEqual(manifest.expected.extracted, [{ step: "extract-order-details", count: 1, records: [SEED_118_ORDERS[1]] }]);
  const extract = manifest.recordingScript.find((step) => step.operation === "extract");
  for (const [field, selector] of Object.entries(extract?.fields ?? {})) {
    const testId = /^\[data-testid="([^"]+)"\]$/.exec(selector)?.[1];
    const value = SEED_118_ORDERS[1]![field as keyof (typeof SEED_118_ORDERS)[number]];
    assert.ok(details.includes(`<dd data-testid="${testId}">${value}</dd>`), `${field} is read from ${selector}`);
  }
});

test("popup-blocked is armed by block-popups and expects output_not_observed with no extraction", () => {
  const primary = resolveScenarioWorkflow(scenario.manifest);
  const blocked = resolveScenarioWorkflow(scenario.manifest, { variantId: "popup-blocked" });
  assert.deepEqual(blocked.variant?.arm, { operation: "block-popups" });
  assert.deepEqual(blocked.recordingScript, primary.recordingScript);
  assert.deepEqual(blocked.expected.failure, { category: "output_not_observed" });
  assert.deepEqual(blocked.expected.extracted, []);
  assert.deepEqual(blocked.expected.actions, [{ action: "web.dom.click" }]);
  assert.deepEqual(blocked.expected.pageFacts, primary.expected.pageFacts);
  assert.deepEqual(blocked.expected.finalState?.map((fact) => [fact.subject, fact.predicate, fact.value]), [
    ["document", "path", "/scenarios/multi-tab/"],
    ["open-notice", "contains", "Pop-up blocked: PO-4472 did not open."],
    ["reviewed-po-4472", "exists", false],
  ]);
  assert.equal(primary.expected.failure, undefined);
  assert.equal(apply(fresh(), blocked.variant!.arm.operation, blocked.variant!.arm.payload).popupsBlocked, true);
});

test("state is a pure function of the seed: fixed order numbers, seeded content, no Math.random or clock", () => {
  const state = withoutRandomOrClock(() => fresh());
  assert.deepEqual(state, { seed: 118, orders: SEED_118_ORDERS, popupsBlocked: false, detailsVisits: [], blockedOpens: [], reviewedOrders: [] });
  assert.deepEqual(fresh(), state);
  const other = fresh(119);
  assert.deepEqual(other.orders.map((order) => order.order), ORDER_NUMBERS);
  assert.notDeepEqual(other.orders, state.orders);
  for (const seed of [-1, 0, 2 ** 40]) assert.deepEqual(fresh(seed).orders.map((order) => order.order), ORDER_NUMBERS);

  const renders = withoutRandomOrClock(() => [scenario.render(state, context), route(state, "details/PO-4472", "via=link")?.body]);
  assert.deepEqual(renders, [scenario.render(state, context), route(state, "details/PO-4472", "via=link")?.body]);
});

test("record-visit and record-blocked-open accept only known orders and open paths, bounded to 50", () => {
  const state = fresh();
  const visited = apply(state, "record-visit", { order: "PO-4472", via: "link" });
  assert.deepEqual(visited.detailsVisits, [{ order: "PO-4472", via: "link" }]);
  for (const payload of [{ order: "PO-9999", via: "link" }, { order: "PO-4472", via: "tab" }, { order: "PO-4472" }, "PO-4472", null]) {
    assert.equal(apply(state, "record-visit", payload), state, JSON.stringify(payload));
  }

  assert.equal(apply(state, "record-blocked-open", { order: "PO-4472", via: "link" }), state, "ignored while not armed");
  const armed = apply(state, "block-popups");
  assert.equal(armed.popupsBlocked, true);
  assert.equal(apply(armed, "block-popups"), armed, "arming twice changes nothing");
  const refused = apply(apply(armed, "record-blocked-open", { order: "PO-4472", via: "link" }), "record-blocked-open", { order: "PO-4474", via: "window" });
  assert.deepEqual(refused.blockedOpens, [{ order: "PO-4472", via: "link" }, { order: "PO-4474", via: "window" }]);
  assert.equal(apply(armed, "record-blocked-open", { order: "PO-4472", via: "direct" }), armed, "a typed URL is never blocked");
  assert.equal(apply(armed, "record-blocked-open", { order: "PO-0000", via: "link" }), armed);

  let busy = state;
  for (let index = 0; index < 60; index += 1) busy = apply(busy, "record-visit", { order: ORDER_NUMBERS[index % 4], via: "direct" });
  assert.equal(busy.detailsVisits.length, 50);
  assert.deepEqual(busy.detailsVisits[0], { order: "PO-4473", via: "direct" });
  assert.equal(apply(state, "unknown-operation", { order: "PO-4472", via: "link" }), state);
});

test("confirm-review is accepted once, and only for an order whose details were visited", () => {
  const state = fresh();
  assert.equal(apply(state, "confirm-review", { order: "PO-4472" }), state, "refused before the details were visited");
  const visited = apply(state, "record-visit", { order: "PO-4472", via: "link" });
  const reviewed = apply(visited, "confirm-review", { order: "PO-4472" });
  assert.deepEqual(reviewed.reviewedOrders, ["PO-4472"]);
  assert.equal(apply(reviewed, "confirm-review", { order: "PO-4472" }), reviewed, "a second confirmation changes nothing");
  assert.equal(apply(visited, "confirm-review", { order: "PO-4471" }), visited, "another order's visit does not count");
  assert.equal(apply(visited, "confirm-review", { order: "PO-9999" }), visited);
});

test("the details route serves every order, records how its tab was opened, and 404s everything else", () => {
  const state = fresh();
  const response = route(state, "details/PO-4472", "via=link");
  assert.equal(response?.status, 200);
  assert.deepEqual(response?.mutation, { operation: "record-visit", payload: { order: "PO-4472", via: "link" } });
  assert.match(response?.body ?? "", /<h1 data-testid="details-heading">Purchase order PO-4472<\/h1>/);
  assert.match(response?.body ?? "", /<section aria-labelledby="order-summary-heading" data-testid="order-details" data-entity-id="PO-4472">/);
  assert.deepEqual(apply(state, response!.mutation!.operation, response!.mutation!.payload).detailsVisits, [{ order: "PO-4472", via: "link" }]);

  for (const [query, via] of [["via=window", "window"], ["", "direct"], ["via=tab", "direct"]] as const) {
    assert.deepEqual(route(state, "details/PO-4472", query)?.mutation?.payload, { order: "PO-4472", via }, query);
  }
  for (const [index, order] of ORDER_NUMBERS.entries()) {
    const body = route(state, `details/${order}`)?.body ?? "";
    for (const value of Object.values(SEED_118_ORDERS[index]!)) assert.ok(body.includes(`>${value}</dd>`), `${order} shows ${value}`);
  }
  assert.equal(route(state, "details/PO-4472", "via=link", "HEAD")?.status, 200);
  assert.equal(route(apply(state, "block-popups"), "details/PO-4472")?.status, 200, "only the list's open paths are blocked");
  for (const subpath of ["details/PO-9999", "details/po-4472", "details/PO-4472/print", "details", "details/", "print/PO-4472"]) {
    assert.equal(route(state, subpath), undefined, subpath);
  }
});

test("the list renders four new-tab links, one window.open control, an empty notice, and only the armed flag differs", () => {
  const baseline = scenario.render(fresh(), context);
  assert.equal(baseline.match(/target="_blank"/g)?.length, 4);
  for (const order of ORDER_NUMBERS) assert.ok(baseline.includes(`href="/scenarios/multi-tab/details/${order}?via=link" target="_blank"`), order);
  assert.equal(baseline.match(/window\.open\(/g)?.length, 1);
  assert.match(baseline, /data-testid="open-newest-window" data-open-order="PO-4474">Open newest order in a new window<\/button>/);
  assert.match(baseline, /<p data-testid="open-notice" role="alert"><\/p>/);
  assert.match(baseline, /const popupsBlocked = false;/);

  const armed = scenario.render(apply(fresh(), "block-popups"), context);
  assert.match(armed, /const popupsBlocked = true;/);
  assert.equal(armed.replace("const popupsBlocked = true;", "const popupsBlocked = false;"), baseline, "the variant changes behaviour, not markup");

  const reviewed = scenario.render(apply(apply(fresh(), "record-visit", { order: "PO-4472", via: "link" }), "confirm-review", { order: "PO-4472" }), context);
  assert.match(reviewed, /<td data-testid="review-state-po-4472"><strong data-testid="reviewed-po-4472">Reviewed<\/strong><\/td>/);
});
