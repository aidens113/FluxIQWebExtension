import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { chromium, type Browser } from "@playwright/test";
import { resolveScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { bigboxRetailManifest as manifest, ORDER_FINAL_FACTS, ORDER_RECORDS, PICKUP_CART_FACTS, PICKUP_TOWEL_RECORDS, START_FACTS, UNCHANGED_CART_FACTS } from "../manifest/index.js";
import { extractRecords, failingFacts, locate, openHarness, runSteps, type Harness } from "./browser-harness.js";

/**
 * The site in a real browser. Each honest test replays a manifest recording
 * script with the Lab's own target and step semantics and then judges it by
 * the manifest's own oracle; each naive test takes the shortcut a careless
 * automation takes and shows that the oracle, or the page, refuses it.
 *
 * Headless full Chromium, as the Lab's page specs run it: the separate
 * headless shell crashes on launch on some Windows hosts.
 */
let browser: Browser;
before(async () => { browser = await chromium.launch({ channel: "chromium", headless: true }); });
after(async () => { await browser?.close(); });

const TIMEOUT = { timeout: 120_000 };
const towels = resolveScenarioWorkflow(manifest, { workflowId: "pickup-towels" });
const order = resolveScenarioWorkflow(manifest, { workflowId: "pickup-order" });
const extractStep = towels.recordingScript.find((step) => step.id === "extract-pickup-towels")!;
const beforeExtract = towels.recordingScript.slice(0, towels.recordingScript.indexOf(extractStep));

async function withHarness(run: (harness: Harness) => Promise<void>): Promise<void> {
  const harness = await openHarness(browser);
  try { await run(harness); } finally { await harness.close(); }
}

/** The start page's facts hold, the page stayed on loopback, and it raised no console error the workflow does not allow. */
async function assertCleanRun(harness: Harness, allowed: readonly string[] = []): Promise<void> {
  assert.deepEqual(harness.offLoopback, []);
  assert.deepEqual(harness.consoleErrors.filter((error) => !allowed.some((pattern) => error.includes(pattern))), []);
}

describe("honest paths pass every oracle", { concurrency: true }, () => {
  test("the cart workflow's script switches store first and builds exactly the goal's pickup cart", TIMEOUT, () => withHarness(async (harness) => {
    await harness.open();
    assert.deepEqual(await failingFacts(harness.page, START_FACTS), []);
    await runSteps(harness, manifest.recordingScript);
    assert.deepEqual(await failingFacts(harness.page, PICKUP_CART_FACTS), []);
    assert.deepEqual(await failingFacts(harness.page, manifest.playbackGoal!.successFacts), []);
    const state = await harness.state();
    assert.equal(state.storeId, "1187");
    assert.deepEqual(state.cart.map(({ sku, qty, fulfilment }) => `${sku}:${qty}:${fulfilment}`), ["5530601:1:pickup", "5510202:2:pickup", "5530102:1:pickup"]);
    await assertCleanRun(harness);
  }));

  test("the extraction workflow's script waits out the bot check and reads exactly the nine qualifying listings", TIMEOUT, () => withHarness(async (harness) => {
    await harness.open();
    const extracted = await runSteps(harness, towels.recordingScript);
    assert.deepEqual(extracted.get("extract-pickup-towels"), PICKUP_TOWEL_RECORDS);
    assert.deepEqual(towels.expected.extracted?.[0]?.records, PICKUP_TOWEL_RECORDS);
    assert.deepEqual(await failingFacts(harness.page, UNCHANGED_CART_FACTS), []);
    const state = await harness.state();
    assert.deepEqual(state.robot, { searchLoads: 8, status: "cleared", clearedBy: "waited" });
    await assertCleanRun(harness);
  }));

  test("the order workflow's script saves the soap, retries the pickup times and places one order", TIMEOUT, () => withHarness(async (harness) => {
    await harness.open();
    const extracted = await runSteps(harness, order.recordingScript);
    assert.deepEqual(extracted.get("extract-order"), ORDER_RECORDS);
    assert.deepEqual(await failingFacts(harness.page, ORDER_FINAL_FACTS), []);
    const state = await harness.state();
    assert.equal(state.orders.length, 1);
    assert.equal(state.flaggedOrders, 0);
    assert.equal(state.slotFetches, 2, "the first request was refused and the retry answered");
    assert.deepEqual(state.saved.map((line) => line.sku), ["5530601"]);
    await assertCleanRun(harness, order.expected.allowedConsoleErrors);
  }));

  test("under the list-layout experiment the same filters and an honest read of the rows give the same nine records", TIMEOUT, () => withHarness(async (harness) => {
    await harness.arm("set-mode", { mode: "list-layout" });
    await harness.open();
    await runSteps(harness, beforeExtract);
    const rows = await extractRecords(harness.page, {
      id: "rows",
      target: "li[data-item-id]:not(:has(span:text-is(\"Ad\"))):has-text(\"Pickup today\"):has(span:text-matches(\"^(4[.][5-9]|5[.]0)$\"))",
      fields: { name: "a:not(:has(img))", price: "div:text-matches(\"^[$][0-9]+[.][0-9]{2}$\")", unitPrice: "div:text-matches(\"/(sheet|roll)$\")", rating: "span:text-matches(\"^[0-5][.][0-9]$\")" },
      pagination: { next: "nav[aria-label=\"Pagination\"] a[aria-current=\"page\"] + a", maxPages: 5 },
    });
    assert.deepEqual(rows, PICKUP_TOWEL_RECORDS);
    await assertCleanRun(harness);
  }));

  test("in the redesign an honest shopper presses the new Add to cart, twice, and gets the same cart", TIMEOUT, () => withHarness(async (harness) => {
    await harness.arm("set-mode", { mode: "redesigned-buy-box" });
    await harness.open();
    const redesigned = resolveScenarioWorkflow(manifest, { variantId: "redesigned-buy-box" });
    assert.deepEqual(await failingFacts(harness.page, redesigned.variant!.expected.pageFacts ?? []), []);
    const script = manifest.recordingScript.flatMap((step) => (step.target === "testid:atc" ? [{ ...step, target: "div:not([hidden]) > button:text-is(\"Add to cart\")" }] : [step]));
    await runSteps(harness, script);
    assert.deepEqual(await failingFacts(harness.page, redesigned.expected.finalState ?? []), []);
    await assertCleanRun(harness);
  }));
});

describe("naive paths fail", { concurrency: true }, () => {
  test("reading every listing that mentions pickup today, ads included, returns duplicates and fails the records", TIMEOUT, () => withHarness(async (harness) => {
    await harness.open();
    await runSteps(harness, beforeExtract);
    const naive = await extractRecords(harness.page, { ...extractStep, target: extractStep.target!.replace(":not(:has-text(\"Sponsored\"))", "") });
    assert.notDeepEqual(naive, PICKUP_TOWEL_RECORDS);
    const names = naive.map((record) => record.name);
    assert.ok(names.length > new Set(names).size, "an ad repeats a listing on the same page");
  }));

  test("a click aimed at the page before the consent dialog is answered lands on its scrim", TIMEOUT, () => withHarness(async (harness) => {
    await harness.open();
    await assert.rejects(harness.page.locator("input[type=search]").click({ timeout: 1500 }), /intercepts pointer events|Timeout/u);
    assert.equal((await harness.state()).consent, "pending");
  }));

  test("pressing the middle of Continue to checkout presses the support launcher lying over it", TIMEOUT, () => withHarness(async (harness) => {
    await harness.open();
    await runSteps(harness, order.recordingScript.slice(0, order.recordingScript.findIndex((step) => step.id === "close-launcher")));
    const box = await harness.page.getByRole("button", { name: "Continue to checkout" }).boundingBox();
    assert.ok(box);
    await harness.page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await harness.page.waitForTimeout(600);
    assert.match(harness.page.url(), /\/cart$/u, "the page did not move");
    assert.equal(await locate(harness.page, "vr-assist strong:has-text(\"Val · virtual assistant\")").isVisible(), true, "the chat opened instead");
  }));

  test("filling every field the form holds, the hidden one included, places no order", TIMEOUT, () => withHarness(async (harness) => {
    const upToContact = order.recordingScript.slice(0, order.recordingScript.findIndex((step) => step.id === "first-name"));
    await harness.open();
    await runSteps(harness, upToContact);
    for (const input of await harness.page.locator("main input[type=text], main input[type=email], main input[type=tel]").all()) {
      await input.evaluate((node: { value: string }) => { node.value = "Dana Whitfield"; });
    }
    await harness.page.locator("[name=email]").fill("dana.whitfield@example.com");
    await harness.page.locator("[name=phone]").fill("555-014-2290");
    await runSteps(harness, order.recordingScript.filter((step) => step.id === "pay-at-pickup" || step.id === "place-order"));
    await harness.page.getByRole("alert").waitFor({ timeout: 8000 });
    assert.match((await harness.page.getByRole("alert").textContent()) ?? "", /VR-417/u);
    const state = await harness.state();
    assert.deepEqual([state.orders.length, state.flaggedOrders], [0, 1]);
  }));

  test("one press of Add to cart only wakes the page and adds nothing", TIMEOUT, () => withHarness(async (harness) => {
    const upToAdd = order.recordingScript.slice(0, order.recordingScript.findIndex((step) => step.id === "wake-towels") + 1);
    await harness.open();
    await runSteps(harness, upToAdd);
    await harness.page.waitForTimeout(800);
    assert.deepEqual((await harness.state()).cart.map((line) => line.sku), ["5530601"]);
    assert.deepEqual(await failingFacts(harness.page, START_FACTS), []);
  }));

  test("Next on a filtered page lands on the next page of everything, filters gone", TIMEOUT, () => withHarness(async (harness) => {
    await harness.open();
    await runSteps(harness, beforeExtract);
    await harness.page.locator("a[aria-label=\"Next page\"]").click();
    await harness.page.waitForLoadState("domcontentloaded");
    assert.equal(await harness.page.locator("aside input:checked").count(), 0);
    assert.match(harness.page.url(), /page=2/u);
  }));

  test("in the redesign, Buy now skips the cart: the cart goal fails", TIMEOUT, () => withHarness(async (harness) => {
    await harness.arm("set-mode", { mode: "redesigned-buy-box" });
    await harness.open();
    const upToAdd = manifest.recordingScript.slice(0, manifest.recordingScript.findIndex((step) => step.id === "wake-towels"));
    await runSteps(harness, upToAdd);
    await harness.page.getByRole("button", { name: "Buy now" }).click();
    await harness.page.getByRole("button", { name: "Buy now" }).click();
    await harness.page.waitForURL(/\/checkout$/u);
    assert.notDeepEqual(await failingFacts(harness.page, PICKUP_CART_FACTS), []);
    assert.equal((await harness.state()).express?.sku, "5510202");
  }));
});
