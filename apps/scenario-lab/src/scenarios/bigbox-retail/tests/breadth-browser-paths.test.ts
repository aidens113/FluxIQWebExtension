import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { chromium, type Browser } from "@playwright/test";
import type { ScenarioStep, ScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { ORDER_CONTACT } from "../manifest/index.js";
import { CHECKOUT_QUOTE_WORKFLOW, NAPKINS_FOR_DELIVERY_WORKFLOW, NEW_STORE_CHEAPEST_TOWELS_WORKFLOW, RATED_DELIVERY_TOWELS_WORKFLOW } from "../qualification/index.js";
import { extractRecords, failingFacts, openHarness, runSteps, type Harness } from "./browser-harness.js";

/**
 * The four breadth workflows (t698) in a real browser. Each honest test
 * replays the workflow's recording with the Lab's own step semantics and
 * judges it by the workflow's own records and final facts; each naive test
 * takes the plausible wrong turn a careless Flow takes and shows the oracle
 * refuses it.
 */
let browser: Browser;
before(async () => { browser = await chromium.launch({ channel: "chromium", headless: true }); });
after(async () => { await browser?.close(); });

const TIMEOUT = { timeout: 150_000 };

async function withHarness(run: (harness: Harness) => Promise<void>): Promise<void> {
  const harness = await openHarness(browser);
  try { await run(harness); } finally { await harness.close(); }
}

const extractOf = (workflow: ScenarioWorkflow) => workflow.recordingScript.find((step) => step.operation === "extract")!;
const recordsOf = (workflow: ScenarioWorkflow) => workflow.expected.extracted![0]!.records!;
const stepsBefore = (workflow: ScenarioWorkflow, id: string) => workflow.recordingScript.slice(0, workflow.recordingScript.findIndex((step) => step.id === id));
const without = (workflow: ScenarioWorkflow, ids: readonly string[]): ScenarioStep[] => workflow.recordingScript.filter((step) => !ids.includes(step.id));

/** The workflow's start facts held, its script read its records, its final facts hold, and the page raised no console error it does not allow. */
async function assertHonest(harness: Harness, workflow: ScenarioWorkflow): Promise<void> {
  await harness.open();
  assert.deepEqual(await failingFacts(harness.page, workflow.expected.pageFacts ?? []), []);
  const extracted = await runSteps(harness, workflow.recordingScript);
  assert.deepEqual(extracted.get(extractOf(workflow).id), recordsOf(workflow));
  assert.deepEqual(await failingFacts(harness.page, workflow.expected.finalState ?? []), []);
  assert.deepEqual(harness.offLoopback, []);
  const allowed = workflow.expected.allowedConsoleErrors ?? [];
  assert.deepEqual(harness.consoleErrors.filter((error) => !allowed.some((pattern) => error.includes(pattern))), []);
}

describe("breadth honest paths pass every oracle", { concurrency: true }, () => {
  test("rated delivery towels: filters, the bot check waited out, the rating sort and the page numbers read the sixteen records", TIMEOUT, () => withHarness(async (harness) => {
    await assertHonest(harness, RATED_DELIVERY_TOWELS_WORKFLOW);
    assert.equal((await harness.state()).robot.clearedBy, "waited");
  }));

  test("napkins for delivery: the 500 Count size, Delivery and two packs make the one new cart line", TIMEOUT, () => withHarness(async (harness) => {
    await assertHonest(harness, NAPKINS_FOR_DELIVERY_WORKFLOW);
    assert.deepEqual((await harness.state()).cart.map(({ sku, qty, fulfilment }) => `${sku}:${qty}:${fulfilment}`), ["5530601:1:pickup", "5530103:2:delivery"]);
  }));

  test("checkout quote: a guest checkout's earliest open slot and total are read and no order is placed", TIMEOUT, () => withHarness(async (harness) => {
    await assertHonest(harness, CHECKOUT_QUOTE_WORKFLOW);
    const state = await harness.state();
    assert.deepEqual([state.orders.length, state.checkout, state.slotFetches], [0, "guest", 2]);
  }));

  test("new store cheapest towels: the Neighborhood Market's cheapest qualifying pack is added and the cart read", TIMEOUT, () => withHarness(async (harness) => {
    await assertHonest(harness, NEW_STORE_CHEAPEST_TOWELS_WORKFLOW);
    const state = await harness.state();
    assert.deepEqual([state.storeId, state.cart.map(({ sku }) => sku)], ["4419", ["5530601", "5510204"]]);
  }));
});

describe("breadth naive paths fail", { concurrency: true }, () => {
  test("rated delivery towels: following the Next arrow drops the filters and the sort, and the records fail", TIMEOUT, () => withHarness(async (harness) => {
    const step = extractOf(RATED_DELIVERY_TOWELS_WORKFLOW);
    await harness.open();
    await runSteps(harness, stepsBefore(RATED_DELIVERY_TOWELS_WORKFLOW, step.id));
    const naive = await extractRecords(harness.page, { ...step, pagination: { next: "a[aria-label=\"Next page\"]", maxPages: 5 } });
    assert.notDeepEqual(naive, recordsOf(RATED_DELIVERY_TOWELS_WORKFLOW));
    assert.deepEqual(naive.slice(0, 12), recordsOf(RATED_DELIVERY_TOWELS_WORKFLOW).slice(0, 12), "the first page was right");
  }));

  test("rated delivery towels: reading in Best match order, never re-sorted, fails the records", TIMEOUT, () => withHarness(async (harness) => {
    await harness.open();
    const extracted = await runSteps(harness, without(RATED_DELIVERY_TOWELS_WORKFLOW, ["rated-best-first", "rated-sorted"]));
    const naive = extracted.get(extractOf(RATED_DELIVERY_TOWELS_WORKFLOW).id)!;
    assert.equal(naive.length, 16, "the same rows");
    assert.notDeepEqual(naive, recordsOf(RATED_DELIVERY_TOWELS_WORKFLOW), "in the wrong order");
  }));

  test("napkins for delivery: adding with the buy box's own size and method fails the final facts", TIMEOUT, () => withHarness(async (harness) => {
    await harness.open();
    const extracted = await runSteps(harness, without(NAPKINS_FOR_DELIVERY_WORKFLOW, ["choose-500", "choose-delivery"]));
    assert.notDeepEqual(extracted.get(extractOf(NAPKINS_FOR_DELIVERY_WORKFLOW).id), recordsOf(NAPKINS_FOR_DELIVERY_WORKFLOW));
    assert.notDeepEqual(await failingFacts(harness.page, NAPKINS_FOR_DELIVERY_WORKFLOW.expected.finalState!), []);
    assert.deepEqual((await harness.state()).cart.map(({ sku, qty, fulfilment }) => `${sku}:${qty}:${fulfilment}`), ["5530601:1:pickup", "5530101:2:pickup"]);
  }));

  test("checkout quote: the first slot button is a full one, and pressing on to Place order fails the final facts", TIMEOUT, () => withHarness(async (harness) => {
    const step = extractOf(CHECKOUT_QUOTE_WORKFLOW);
    await harness.open();
    await runSteps(harness, CHECKOUT_QUOTE_WORKFLOW.recordingScript);
    assert.deepEqual(await extractRecords(harness.page, { ...step, fields: { ...step.fields, pickup: "button" } }), [{ pickup: "11am–12pm Full", total: "$4.26" }]);
    await runSteps(harness, [
      { id: "naive-slot", operation: "click", target: "button:text-is(\"2pm–3pm\") >> nth=0" },
      { id: "naive-first", operation: "type", target: "role:textbox:First name", value: ORDER_CONTACT.firstName },
      { id: "naive-last", operation: "type", target: "role:textbox:Last name", value: ORDER_CONTACT.lastName },
      { id: "naive-email", operation: "type", target: "role:textbox:Email address", value: ORDER_CONTACT.email },
      { id: "naive-phone", operation: "type", target: "role:textbox:Phone number", value: ORDER_CONTACT.phone },
      { id: "naive-pay-at-pickup", operation: "click", target: "role:radio:Pay at pickup" },
      { id: "naive-place-order", operation: "click", target: "role:button:Place order" },
      { id: "naive-confirmed", operation: "waitForState", target: "h1:has-text(\"Thanks for your order\")", timeoutMs: 8000 },
    ]);
    assert.notDeepEqual(await failingFacts(harness.page, CHECKOUT_QUOTE_WORKFLOW.expected.finalState!), []);
    assert.equal((await harness.state()).orders.length, 1);
  }));

  test("new store cheapest towels: the other Millbrook Crossing store's card sets the wrong store and fails the final facts", TIMEOUT, () => withHarness(async (harness) => {
    const script = NEW_STORE_CHEAPEST_TOWELS_WORKFLOW.recordingScript.map((step) => (step.target?.includes("Millbrook Crossing Neighborhood Market")
      ? { ...step, target: step.target.replace("Millbrook Crossing Neighborhood Market", "Millbrook Crossing Supercenter") } : step));
    await harness.open();
    await runSteps(harness, script);
    assert.deepEqual(await failingFacts(harness.page, NEW_STORE_CHEAPEST_TOWELS_WORKFLOW.expected.finalState!), ["new-store-account", "new-store-chosen"]);
  }));
});
