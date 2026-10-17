import { soldSavesWorkflow } from "../qualification/index.js";
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { chromium, type Browser } from "@playwright/test";
import { resolveScenarioWorkflow, type ScenarioStep } from "@fluxiq-web-extension/test-contracts";
import { bikeRecords, savedRecords } from "../answers.js";
import { listingByKey } from "../catalog/index.js";
import { CLASSIFIEDS_ROOT } from "../root.js";
import { localClassifiedsScenario as scenario } from "../scenario.js";
import { OFFER_LISTING_KEY } from "../targets.js";
import type { ClassifiedsMode } from "../types.js";
import { listingPath } from "../view/index.js";
import { failingFacts, locate, readRecords, runScript } from "./browser-support.js";
import { onceEach, openSession, serverState, type Session } from "./lab-session.js";

/**
 * Kerbfind Marketplace in a real browser, one test per live task: each walks
 * the chain a correct Flow needs against the manifest's own oracle, and the
 * offer's naive path -- the ready-made message the instruction forbids, then
 * the offer -- must miss its goal.
 */
const manifest = scenario.manifest;
const TEST_TIMEOUT_MS = 120_000;
const RESULTS = `section[aria-label="Collection of Marketplace items"]`;
let browser: Browser;

before(async () => { browser = await chromium.launch({ channel: "chromium", headless: true }); });
after(async () => { await browser.close(); });

const session = (mode: ClassifiedsMode = "baseline"): Promise<Session> => openSession(browser, mode);

const workflow = (workflowId: string, variantId?: string) => resolveScenarioWorkflow(manifest, { workflowId, ...(variantId ? { variantId } : {}) });

/** The bike workflow's script, split at its extract step. */
function bikeScript(): { before: ScenarioStep[]; extract: ScenarioStep } {
  const { recordingScript } = workflow("bike-search");
  const at = recordingScript.findIndex(({ id }) => id === "extract-bike-results");
  return { before: recordingScript.slice(0, at), extract: recordingScript[at]! };
}

test("bike search: category, radius, price, condition, sort, every batch through the failure, then each listing once, is exactly the answer", { timeout: TEST_TIMEOUT_MS }, async () => {
  const run = await session();
  try {
    const { recordingScript, expected } = workflow("bike-search");
    const raw = (await runScript(run.page, run.lab.origin, recordingScript)).get("extract-bike-results")!;
    const owed = expected.extracted![0]!.records!;
    assert.equal(raw.length, owed.length + 1, "the feed sent one listing twice, across a batch seam");
    assert.ok(raw.every((record) => record.url!.startsWith(`${CLASSIFIEDS_ROOT}item/`)), "no advert and nothing outside the search is read");
    assert.deepEqual(onceEach(raw), owed);
    assert.deepEqual(owed, bikeRecords());
    assert.deepEqual(await failingFacts(run.page, expected.finalState ?? []), []);
    assert.deepEqual(run.errors, []);
  } finally { await run.close(); }
});

test("bike search, list layout: the grid's read finds no price or place, and reading the rows gives the same answer", { timeout: TEST_TIMEOUT_MS }, async () => {
  const run = await session("list-layout");
  try {
    const { before, extract } = bikeScript();
    await runScript(run.page, run.lab.origin, before);
    const gridRead = await readRecords(run.page, extract);
    assert.ok(gridRead.length > 0 && gridRead.every((record) => record.price === undefined && record.location === undefined), "the recorded read is lost");
    const rows = await readRecords(run.page, {
      id: "read-rows", operation: "extract",
      target: `${RESULTS} > div:first-child [role="article"]:has(a[href*="/item/"])`,
      fields: { title: "a", price: "a + div > span:first-child", location: "a + div + div > span:first-child", url: "a@href" },
    });
    assert.deepEqual(onceEach(rows), workflow("bike-search", "list-layout").expected.extracted![0]!.records);
    assert.deepEqual(run.errors, []);
  } finally { await run.close(); }
});

test("bike search, location check: nothing can be pressed until Kelford is confirmed, and then the answer is unchanged", { timeout: TEST_TIMEOUT_MS }, async () => {
  const run = await session("location-check");
  try {
    const { before, extract } = bikeScript();
    const [cookies, ...rest] = before;
    await runScript(run.page, run.lab.origin, [cookies!]);
    await locate(run.page, "role:dialog:Are you still in Kelford?").waitFor({ timeout: 5000 });
    await assert.rejects(locate(run.page, "role:link:Bicycles").click({ timeout: 1500 }), /intercepts pointer events|Timeout/u);
    await locate(run.page, "role:button:Yes, that's right").click();
    await runScript(run.page, run.lab.origin, rest);
    const raw = await readRecords(run.page, extract);
    assert.deepEqual(onceEach(raw), workflow("bike-search", "location-check").expected.extracted![0]!.records);
    assert.deepEqual(run.errors, []);
  } finally { await run.close(); }
});

test("dining tables: the three cheapest real tables within 5 miles are saved, and the saved list reads back cheapest first", { timeout: TEST_TIMEOUT_MS }, async () => {
  const run = await session();
  try {
    const { recordingScript, expected } = workflow("save-dining-tables");
    const read = (await runScript(run.page, run.lab.origin, recordingScript)).get("extract-saved-items");
    assert.deepEqual(read, expected.extracted![0]!.records);
    assert.deepEqual(read, savedRecords());
    assert.deepEqual(await failingFacts(run.page, expected.finalState ?? []), []);
    assert.equal((await serverState(run.lab)).saved.length, 5);
    assert.deepEqual(run.errors, []);
  } finally { await run.close(); }
});

test("offer: the folding-bike search, the chat closed, one offer of £140 meets the goal and every final fact", { timeout: TEST_TIMEOUT_MS }, async () => {
  const run = await session();
  try {
    await runScript(run.page, run.lab.origin, manifest.recordingScript);
    assert.deepEqual(await failingFacts(run.page, [...manifest.playbackGoal!.successFacts, ...(manifest.expected.finalState ?? [])]), []);
    const state = await serverState(run.lab);
    assert.deepEqual(state.offers, [{ listingId: listingByKey(OFFER_LISTING_KEY).id, amount: 140, note: "", delivered: true }]);
    assert.deepEqual(state.messages, []);
    assert.deepEqual(run.errors, []);
  } finally { await run.close(); }
});

test("offer: pressing Send on the ready-made message, then offering once the rate limit allows, misses the goal", { timeout: TEST_TIMEOUT_MS }, async () => {
  const run = await session();
  try {
    await locate(run.page, "role:button:Allow all cookies").click();
    await run.page.goto(`${run.lab.origin}${listingPath(listingByKey(OFFER_LISTING_KEY))}`);
    await locate(run.page, "role:button:Close chat").waitFor({ timeout: 6000 });
    await locate(run.page, "role:button:Close chat").click();
    await run.page.getByRole("button", { name: "Send", exact: true }).click();
    await run.page.getByText("Message sent to Morgan Tate").waitFor({ timeout: 4000 });
    await run.page.waitForTimeout(8_500);
    await locate(run.page, "role:button:Make offer").click();
    await locate(run.page, "role:textbox:Your offer").fill("140");
    await locate(run.page, "role:button:Send offer").click();
    await locate(run.page, "testid:marketplace_offer_receipt").waitFor({ timeout: 6000 });
    const failing = await failingFacts(run.page, manifest.playbackGoal!.successFacts);
    assert.deepEqual(failing.map(({ id }) => id), ["only-the-offer"]);
    assert.equal(failing[0]!.actual, "You've sent Morgan Tate 1 message and 1 offer");
  } finally { await run.close(); }
});


test("qualification preservation: remove Sold save and preserve Available, hidden and contact state", { timeout: TEST_TIMEOUT_MS }, async () => {
  const run = await session();
  try {
    assert.deepEqual(await failingFacts(run.page, soldSavesWorkflow.expected.pageFacts!), []);
    const records = await runScript(run.page, run.lab.origin, soldSavesWorkflow.recordingScript);
    assert.deepEqual(records.get("extract-available-saves"), soldSavesWorkflow.expected.extracted![0]!.records);
    assert.deepEqual(await failingFacts(run.page, soldSavesWorkflow.expected.finalState!), []);
    const state = await serverState(run.lab);
    assert.deepEqual(state.saved, ["1030986358004719"]);
    assert.deepEqual([state.hidden, state.offers, state.messages, state.contactLog], [[], [], [], []]);
    await run.page.reload();
    assert.deepEqual(await failingFacts(run.page, soldSavesWorkflow.expected.finalState!), []);
    assert.deepEqual(run.errors, []);
  } finally { await run.close(); }
});

test("qualification preservation: Hide removes the Sold save and matches the table but fails no-hide account oracle", { timeout: TEST_TIMEOUT_MS }, async () => {
  const run = await session("moved-save");
  try {
    await runScript(run.page, run.lab.origin, soldSavesWorkflow.recordingScript.slice(0, 3));
    await run.page.goto(`${run.lab.origin}${CLASSIFIEDS_ROOT}item/1057533328723847/`);
    // Hide is physically present in the existing moved-save rendering, not baseline.
    await run.page.getByText("Hide", { exact: true }).click();
    await run.page.getByText("Listing hidden. You won't see it in your feed.", { exact: true }).waitFor();
    const current = JSON.parse((await run.page.getByTestId("classifieds-sold-saves-account").textContent())!);
    assert.deepEqual(current.saved, ["1030986358004719"]);
    assert.deepEqual(current.hidden, ["1057533328723847"]);
    assert.notDeepEqual(await failingFacts(run.page, soldSavesWorkflow.expected.finalState!), []);
    await run.page.goto(`${run.lab.origin}${CLASSIFIEDS_ROOT}saved/`);
    const step = soldSavesWorkflow.recordingScript.find(({ operation }) => operation === "extract")!;
    assert.deepEqual(await readRecords(run.page, step), soldSavesWorkflow.expected.extracted![0]!.records);
    assert.notDeepEqual(await failingFacts(run.page, soldSavesWorkflow.expected.finalState!), []);
    await run.page.reload();
    assert.notDeepEqual(await failingFacts(run.page, soldSavesWorkflow.expected.finalState!), []);
  } finally { await run.close(); }
});
