import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { after, before, test } from "node:test";
import { chromium, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { resolveScenarioWorkflow, type ScenarioStep } from "@fluxiq-web-extension/test-contracts";
import { startScenarioLab, type RunningScenarioLab } from "../../../server.js";
import { closeLabSession } from "../../tests/close-lab-session.js";
import { bikeRecords, savedRecords } from "../answers.js";
import { listingByKey } from "../catalog/index.js";
import { CLASSIFIEDS_ROOT } from "../root.js";
import { localClassifiedsScenario as scenario } from "../scenario.js";
import { OFFER_LISTING_KEY } from "../targets.js";
import type { ClassifiedsMode, ClassifiedsState } from "../types.js";
import { listingPath } from "../view/index.js";
import { failingFacts, locate, readRecords, runScript } from "./browser-support.js";

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

type Session = { lab: RunningScenarioLab; page: Page; errors: string[]; close(): Promise<void> };

async function session(mode: ClassifiedsMode = "baseline"): Promise<Session> {
  const lab = await startScenarioLab({ runToken: randomBytes(24).toString("base64url"), seed: manifest.seed });
  let context: BrowserContext | undefined;
  try {
    if (mode !== "baseline") await post(lab, "set-mode", { mode });
    context = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: "en-GB", timezoneId: "Europe/London" });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${lab.origin}${CLASSIFIEDS_ROOT}`);
    const opened = context;
    return { lab, page, errors, close: () => closeLabSession(lab, opened) };
  } catch (error) {
    // The opening failure is the one to report; the lab is closed either way, or the file never exits.
    await closeLabSession(lab, context).catch(() => undefined);
    throw error;
  }
}

async function post(lab: RunningScenarioLab, operation: string, payload: unknown): Promise<void> {
  const response = await fetch(`${lab.origin}/api/local-classifieds/${operation}`, {
    method: "POST", headers: { authorization: `Bearer ${lab.runToken}`, "content-type": "application/json" }, body: JSON.stringify(payload),
  });
  assert.equal(response.status, 200);
}

async function serverState(lab: RunningScenarioLab): Promise<ClassifiedsState> {
  const response = await fetch(`${lab.origin}/__control/final-state?scenario=local-classifieds`, { headers: { authorization: `Bearer ${lab.runToken}` } });
  return (await response.json() as { state: ClassifiedsState }).state;
}

const workflow = (workflowId: string, variantId?: string) => resolveScenarioWorkflow(manifest, { workflowId, ...(variantId ? { variantId } : {}) });

/** Each listing once, first sighting kept, by the address it links to: the dedupe step a correct Flow ends with. */
function onceEach(records: ReadonlyArray<Record<string, string>>): Array<Record<string, string>> {
  const seen = new Set<string>();
  return records.filter((record) => !seen.has(record.url!) && Boolean(seen.add(record.url!)));
}

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
