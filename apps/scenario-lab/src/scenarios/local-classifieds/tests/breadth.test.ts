import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { chromium, type Browser } from "@playwright/test";
import { resolveScenarioWorkflow, type ScenarioStep } from "@fluxiq-web-extension/test-contracts";
import { PRICE_CHECK_OFFER, TEST_RIDE_LISTING_KEY, TEST_RIDE_MESSAGE } from "../breadth/index.js";
import { listingByKey } from "../catalog/index.js";
import { CLASSIFIEDS_ROOT } from "../root.js";
import { localClassifiedsScenario as scenario } from "../scenario.js";
import { listingPath } from "../view/index.js";
import { failingFacts, locate, runScript } from "./browser-support.js";
import { onceEach, openSession, serverState } from "./lab-session.js";

/**
 * The four breadth tasks in a real browser: each recording reaches its
 * workflow's oracle -- the records and the account it leaves -- and a
 * plausible wrong path (a filter left off, the wrong figure, the ready-made
 * message, the offer the condition forbids) misses it.
 */
const TEST_TIMEOUT_MS = 150_000;
let browser: Browser;

before(async () => { browser = await chromium.launch({ channel: "chromium", headless: true }); });
after(async () => { await browser.close(); });

const workflow = (workflowId: string) => resolveScenarioWorkflow(scenario.manifest, { workflowId });
const datasetOf = (workflowId: string) => workflow(workflowId).expected.extracted![0]!;
const without = (script: readonly ScenarioStep[], pattern: RegExp) => script.filter(({ id }) => !pattern.test(id));

test("nearby furniture: radius, price limit and newest first, through both batches, each listing once, is exactly the answer", { timeout: TEST_TIMEOUT_MS }, async () => {
  const run = await openSession(browser);
  try {
    const { recordingScript, expected } = workflow("furniture-nearby");
    const { step, records } = datasetOf("furniture-nearby");
    const raw = (await runScript(run.page, run.lab.origin, recordingScript)).get(step)!;
    assert.equal(raw.length, records!.length + 1, "the feed sent one listing twice, across the batch seam");
    assert.ok(raw.every((record) => record.url!.startsWith(`${CLASSIFIEDS_ROOT}item/`)), "no advert and nothing outside the search is read");
    assert.deepEqual(onceEach(raw), records);
    assert.deepEqual(await failingFacts(run.page, expected.finalState!), []);
    assert.deepEqual(run.errors, []);
  } finally { await run.close(); }
});

test("nearby furniture: the same read without the price limit is not the answer", { timeout: TEST_TIMEOUT_MS }, async () => {
  const run = await openSession(browser);
  try {
    const { recordingScript } = workflow("furniture-nearby");
    const { step, records } = datasetOf("furniture-nearby");
    const raw = (await runScript(run.page, run.lab.origin, without(recordingScript, /-max-price$/u))).get(step)!;
    assert.ok(onceEach(raw).length > records!.length);
    assert.notDeepEqual(onceEach(raw), records);
  } finally { await run.close(); }
});

test("test-ride question: the chat closed, the box rewritten and sent once, reaches the record and the account oracle", { timeout: TEST_TIMEOUT_MS }, async () => {
  const run = await openSession(browser);
  try {
    const { recordingScript, expected } = workflow("test-ride-question");
    const { step, records } = datasetOf("test-ride-question");
    assert.deepEqual((await runScript(run.page, run.lab.origin, recordingScript)).get(step), records);
    assert.deepEqual(await failingFacts(run.page, expected.finalState!), []);
    const state = await serverState(run.lab);
    assert.deepEqual(state.messages, [{ listingId: listingByKey(TEST_RIDE_LISTING_KEY).id, text: TEST_RIDE_MESSAGE, delivered: true }]);
    assert.deepEqual([state.offers, state.refusedContacts], [[], 0]);
    await run.page.reload();
    assert.deepEqual(await failingFacts(run.page, expected.finalState!), []);
    assert.deepEqual(run.errors, []);
  } finally { await run.close(); }
});

test("test-ride question: pressing Send on the ready-made message misses the account oracle", { timeout: TEST_TIMEOUT_MS }, async () => {
  const run = await openSession(browser);
  try {
    await locate(run.page, "role:button:Allow all cookies").click();
    await run.page.goto(`${run.lab.origin}${listingPath(listingByKey(TEST_RIDE_LISTING_KEY))}`);
    await locate(run.page, "role:button:Close chat").waitFor({ timeout: 6000 });
    await locate(run.page, "role:button:Close chat").click();
    await locate(run.page, "role:button:Send").click();
    await locate(run.page, "testid:marketplace_conversation").waitFor({ timeout: 6000 });
    const failing = await failingFacts(run.page, workflow("test-ride-question").expected.finalState!);
    assert.deepEqual(failing.map(({ id }) => id), ["only-the-question"]);
  } finally { await run.close(); }
});

test("carbon price check: the price read and no offer made meets both oracles; making the offer anyway keeps the record and fails the account", { timeout: TEST_TIMEOUT_MS }, async () => {
  const run = await openSession(browser);
  try {
    const { recordingScript, expected } = workflow("carbon-price-check");
    const { step, records } = datasetOf("carbon-price-check");
    assert.deepEqual((await runScript(run.page, run.lab.origin, recordingScript)).get(step), records);
    assert.deepEqual(await failingFacts(run.page, expected.finalState!), []);
    assert.deepEqual(run.errors, []);
    await locate(run.page, "role:button:Make offer").click();
    await locate(run.page, "role:textbox:Your offer").fill(String(PRICE_CHECK_OFFER));
    await locate(run.page, "role:button:Send offer").click();
    await locate(run.page, "testid:marketplace_offer_receipt").waitFor({ timeout: 6000 });
    assert.deepEqual((await failingFacts(run.page, expected.finalState!)).map(({ id }) => id), ["nothing-sent"]);
  } finally { await run.close(); }
});

test("bikes within Alex's price: Buying read, then category, radius, his £200, condition and sort, through every batch, is exactly the answer", { timeout: TEST_TIMEOUT_MS }, async () => {
  const run = await openSession(browser);
  try {
    const { recordingScript, expected } = workflow("alex-budget-bikes");
    const { step, records } = datasetOf("alex-budget-bikes");
    const raw = (await runScript(run.page, run.lab.origin, recordingScript)).get(step)!;
    assert.equal(raw.length, records!.length + 1, "the feed sent one listing twice, across a batch seam");
    assert.deepEqual(onceEach(raw), records);
    assert.deepEqual(await failingFacts(run.page, expected.finalState!), []);
    assert.deepEqual(run.errors, []);
  } finally { await run.close(); }
});

test("bikes within Alex's price: the buyer's own £180 from the same thread is not the answer", { timeout: TEST_TIMEOUT_MS }, async () => {
  const run = await openSession(browser);
  try {
    const { recordingScript } = workflow("alex-budget-bikes");
    const { step, records } = datasetOf("alex-budget-bikes");
    const script = recordingScript.map((entry) => (entry.id === "budget-type-max-price" ? { ...entry, value: "180" } : entry));
    const read = onceEach((await runScript(run.page, run.lab.origin, script)).get(step)!);
    assert.deepEqual(read, records!.filter(({ price }) => price !== "£190"));
    assert.notDeepEqual(read, records);
  } finally { await run.close(); }
});
