import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { after, before, test } from "node:test";
import { chromium, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { resolveScenarioWorkflow, type ScenarioStep } from "@fluxiq-web-extension/test-contracts";
import { startScenarioLab, type RunningScenarioLab } from "../../../server.js";
import { closeLabSession } from "../../tests/close-lab-session.js";
import { arrivalSteps } from "../breadth/index.js";
import { listingByHandle } from "../catalog/index.js";
import { auctionMarketplaceManifest as manifest } from "../manifest.js";
import { itemPath, MARKET_ROOT } from "../paths.js";
import type { AuctionState } from "../types.js";
import { failingFacts, locate, runScript } from "./browser-support.js";

/**
 * The four breadth workflows in a real browser. Each recording, the honest
 * path, must meet its dataset and every final-state fact; each plausible
 * wrong path -- the unfiltered list, the wrong row, one act too many -- must
 * miss at least one of them.
 */
const TEST_TIMEOUT_MS = 90_000;
let browser: Browser;

before(async () => {
  browser = await chromium.launch({ channel: "chromium", headless: true });
});
after(async () => {
  await browser.close();
});

type Session = { lab: RunningScenarioLab; page: Page; errors: string[]; close(): Promise<void> };

async function session(): Promise<Session> {
  const lab = await startScenarioLab({ runToken: randomBytes(24).toString("base64url"), seed: 4040 });
  let context: BrowserContext | undefined;
  try {
    context = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: "en-GB", timezoneId: "Europe/London" });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${lab.origin}${MARKET_ROOT}`);
    const opened = context;
    return { lab, page, errors, close: () => closeLabSession(lab, opened) };
  } catch (error) {
    await closeLabSession(lab, context).catch(() => undefined);
    throw error;
  }
}

async function serverState(lab: RunningScenarioLab): Promise<AuctionState> {
  const response = await fetch(`${lab.origin}/__control/final-state?scenario=auction-marketplace`, { headers: { authorization: `Bearer ${lab.runToken}` } });
  return (await response.json() as { state: AuctionState }).state;
}

const workflow = (workflowId: string) => resolveScenarioWorkflow(manifest, { workflowId });

/** The workflow's read, to run on a page a wrong path reached. */
function split(workflowId: string, extractId: string): { extract: ScenarioStep } {
  const extract = workflow(workflowId).recordingScript.find(({ id }) => id === extractId);
  assert.ok(extract, `${workflowId} has no ${extractId}`);
  return { extract };
}

/** Runs `workflowId`'s whole recording, and asserts its dataset, its final state and a clean console. */
async function honestPath(run: Session, workflowId: string, extractId: string): Promise<void> {
  const { recordingScript, expected } = workflow(workflowId);
  const extracted = await runScript(run.page, run.lab.origin, recordingScript);
  assert.deepEqual(extracted.get(extractId), expected.extracted![0]!.records);
  assert.deepEqual(await failingFacts(run.page, expected.finalState ?? []), []);
  assert.deepEqual(run.errors, []);
}

/** Answers the promotion, the greeting and the cookie banner, as every recording does first. */
async function arrive(run: Session): Promise<void> {
  await runScript(run.page, run.lab.origin, arrivalSteps("person"));
}

async function waitForCards(page: Page): Promise<void> {
  await page.locator(`ul[aria-busy="false"]`).waitFor({ timeout: 5000 });
}

test("cheap accessories: the recorded filters pass the bot check and read exactly the six owed", { timeout: TEST_TIMEOUT_MS }, async () => {
  const run = await session();
  try {
    await honestPath(run, "cheap-accessories", "extract-cheap-accessories");
    const state = await serverState(run.lab);
    assert.equal(state.challengePassed, true);
    assert.deepEqual([state.bids, state.purchases, state.followed], [[], [], []]);
  } finally {
    await run.close();
  }
});

type Card = { title: string; price: string; approx: string; bids: string; end: string };

async function readCards(page: Page): Promise<Map<string, Card>> {
  const cards = new Map<string, Card>();
  for (const item of await page.locator("ul[aria-busy] > li[data-listingid]").all()) {
    const text = async (selector: string) => ((await item.locator(selector).first().textContent()) ?? "").replace(/\s+/gu, " ").trim();
    cards.set((await item.getAttribute("data-listingid"))!, {
      title: await text(":scope > div:nth-child(2) > a span:last-child"),
      price: await text(":scope > div:nth-child(2) > div:nth-child(4) > span:nth-child(1)"),
      approx: await text(":scope > div:nth-child(2) > div:nth-child(4) > span:nth-child(2)"),
      bids: await text(":scope > div:nth-child(2) > div:nth-child(5) > span:nth-child(1)"),
      end: await text(":scope > div:nth-child(2) > div:nth-child(6) > span:nth-child(2)"),
    });
  }
  return cards;
}

/** `(Tue 22 Sep, 21:14)` as minutes into September. */
function endKey(end: string): number {
  const match = /\((?:\w+) (\d+) Sep, (\d\d):(\d\d)\)/u.exec(end);
  assert.ok(match, end);
  return Number(match[1]) * 1440 + Number(match[2]) * 60 + Number(match[3]);
}

/** A person's reading of a title as an accessory: something for the camera, not a camera. */
const ACCESSORY = /\b(?:cap|case|hood|strap|filter|manual|flashgun|self-timer|cable)\b/iu;

test("cheap accessories: a person reading all three keyword pages by the numbered links reaches the same six", { timeout: TEST_TIMEOUT_MS }, async () => {
  const run = await session();
  try {
    await arrive(run);
    await run.page.locator(`form[role="search"] input[name="_nkw"]`).fill("kestrel 35");
    await run.page.locator(`form[role="search"] input[name="_nkw"]`).press("Enter");
    await waitForCards(run.page);
    const seen = new Map<string, Card>();
    for (let pageNumber = 1; ; pageNumber += 1) {
      for (const [id, card] of await readCards(run.page)) seen.set(id, card);
      const nextNumber = run.page.locator(`nav[aria-label="Results pagination"] a:text-is("${pageNumber + 1}")`);
      if ((await nextNumber.count()) === 0) break;
      await nextNumber.click();
      await waitForCards(run.page);
    }
    assert.equal(seen.size, 50);
    const pounds = (card: Card) => Number((card.approx === "" ? card.price : card.approx).replace(/^approx\. /u, "").replace(/[£,]/gu, ""));
    const underTen = [...seen.values()].filter((card) => pounds(card) < 10);
    assert.ok(underTen.some((card) => card.bids === "Buy it now"), "a fixed-price cable release is under £10 too");
    assert.ok(underTen.some((card) => !ACCESSORY.test(card.title)), "so is the shop display dummy, a camera");
    const owed = underTen.filter((card) => ACCESSORY.test(card.title) && /\bbids?$/u.test(card.bids))
      .sort((left, right) => endKey(left.end) - endKey(right.end))
      .map(({ title, price, bids }) => ({ title, price, bids }));
    assert.deepEqual(owed, workflow("cheap-accessories").expected.extracted![0]!.records);
  } finally {
    await run.close();
  }
});

test("cheap accessories: the price and Auction filters alone let the display dummy in, and the oracle refuses it", { timeout: TEST_TIMEOUT_MS }, async () => {
  const run = await session();
  try {
    await arrive(run);
    await run.page.goto(`${run.lab.origin}${MARKET_ROOT}sch/i.html?_nkw=kestrel+35&LH_Auction=1&_udhi=10&_sop=1`);
    await waitForCards(run.page);
    const { extract } = split("cheap-accessories", "extract-cheap-accessories");
    const read = (await runScript(run.page, run.lab.origin, [extract])).get(extract.id)!;
    assert.ok(read.some((record) => record.title === listingByHandle("x12").title));
    assert.notDeepEqual(read, workflow("cheap-accessories").expected.extracted![0]!.records);
  } finally {
    await run.close();
  }
});

test("Mark II sellers: the recording saves the four sellers and reads the Saved sellers list back", { timeout: TEST_TIMEOUT_MS }, async () => {
  const run = await session();
  try {
    await honestPath(run, "save-mark-ii-sellers", "extract-saved-sellers");
    const state = await serverState(run.lab);
    assert.deepEqual(state.followed, ["fotokiste-utrecht", "sprocket-and-spool", "kameraboden", "northgate_photo"], "saved in listing order");
    assert.deepEqual([state.bids, state.purchases, state.watched], [[], [], [listingByHandle("m3").id, listingByHandle("n1").id]]);
  } finally {
    await run.close();
  }
});

async function saveSellerOf(page: Page, origin: string, handle: string): Promise<void> {
  await page.goto(`${origin}${itemPath(listingByHandle(handle).id)}`);
  await locate(page, "role:button:Save seller").click();
  await page.locator(`button[aria-pressed="true"]:text-is("Seller saved")`).waitFor({ timeout: 4000 });
}

test("Mark II sellers: saved in another order, the list and the oracle are the same", { timeout: TEST_TIMEOUT_MS }, async () => {
  const run = await session();
  try {
    await arrive(run);
    for (const handle of ["l10", "l6", "l5", "l4"]) await saveSellerOf(run.page, run.lab.origin, handle);
    await run.page.reload();
    assert.deepEqual(await failingFacts(run.page, workflow("save-mark-ii-sellers").expected.finalState ?? []), []);
  } finally {
    await run.close();
  }
});

test("Mark II sellers: saving the 35S's seller too, or pressing one Save seller twice, fails the account oracle", { timeout: TEST_TIMEOUT_MS }, async () => {
  const run = await session();
  try {
    await arrive(run);
    for (const handle of ["l4", "l5", "l6", "l10", "l1"]) await saveSellerOf(run.page, run.lab.origin, handle);
    await run.page.reload();
    const facts = workflow("save-mark-ii-sellers").expected.finalState ?? [];
    assert.ok((await failingFacts(run.page, facts)).some(({ id }) => id === "sellers-saved-saved-sellers"), "harrow_cameras is one seller too many");
    await locate(run.page, "role:button:Seller saved").click();
    await run.page.locator(`button[aria-pressed="false"]:text-is("Save seller")`).waitFor({ timeout: 4000 });
    await run.page.goto(`${run.lab.origin}${itemPath(listingByHandle("l10").id)}`);
    await locate(run.page, "role:button:Seller saved").click();
    await run.page.locator(`button[aria-pressed="false"]:text-is("Save seller")`).waitFor({ timeout: 4000 });
    await run.page.reload();
    assert.ok((await failingFacts(run.page, facts)).some(({ id }) => id === "sellers-saved-saved-sellers"), "a second press forgot northgate_photo");
  } finally {
    await run.close();
  }
});

test("Buy it now quote: the recording reads the purchase review and buys nothing", { timeout: TEST_TIMEOUT_MS }, async () => {
  const run = await session();
  try {
    await honestPath(run, "buy-it-now-quote", "extract-buy-it-now-quote");
    const state = await serverState(run.lab);
    assert.deepEqual([state.bids, state.purchases, state.followed], [[], [], []]);
  } finally {
    await run.close();
  }
});

test("Buy it now quote: the fixed-price listing titled Buy it now is the wrong row, and pressing Confirm and pay fails the account oracle", { timeout: TEST_TIMEOUT_MS }, async () => {
  const run = await session();
  try {
    const { extract } = split("buy-it-now-quote", "extract-buy-it-now-quote");
    const expected = workflow("buy-it-now-quote").expected;
    await arrive(run);
    await run.page.goto(`${run.lab.origin}${itemPath(listingByHandle("x11").id)}`);
    await locate(run.page, "role:button:Buy it now").click();
    const wrongRow = (await runScript(run.page, run.lab.origin, [extract])).get(extract.id)!;
    assert.notDeepEqual(wrongRow, expected.extracted![0]!.records);
    await run.page.goto(`${run.lab.origin}${itemPath(listingByHandle("m4").id)}`);
    await locate(run.page, "role:button:Buy it now").click();
    assert.deepEqual((await runScript(run.page, run.lab.origin, [extract])).get(extract.id), expected.extracted![0]!.records);
    await locate(run.page, "role:button:Confirm and pay").click();
    await run.page.locator(`div[aria-label="Review your purchase"] [role="status"]:has-text("Thank you for your purchase")`).waitFor({ timeout: 5000 });
    assert.ok((await failingFacts(run.page, expected.finalState ?? [])).some(({ id }) => id === "quote-unchanged-purchases"));
    assert.deepEqual((await serverState(run.lab)).purchases, [listingByHandle("m4").id]);
  } finally {
    await run.close();
  }
});

test("seller shop: the recording searches, opens the hood, and reads the camera loft's shop", { timeout: TEST_TIMEOUT_MS }, async () => {
  const run = await session();
  try {
    await honestPath(run, "lens-hood-seller-shop", "extract-seller-shop");
  } finally {
    await run.close();
  }
});

test("seller shop: the listing's seller link names the shop read, and the collector's set's seller is the wrong shop", { timeout: TEST_TIMEOUT_MS }, async () => {
  const run = await session();
  try {
    await arrive(run);
    await run.page.goto(`${run.lab.origin}${itemPath(listingByHandle("a4").id)}`);
    const shopLink = run.page.locator(`a[href$="/str/the_camera_loft"]`).first();
    assert.equal(await shopLink.textContent(), "the_camera_loft");
    const { extract } = split("lens-hood-seller-shop", "extract-seller-shop");
    await run.page.goto(`${run.lab.origin}${MARKET_ROOT}str/${listingByHandle("x7").seller}`);
    const wrongShop = (await runScript(run.page, run.lab.origin, [extract])).get(extract.id)!;
    assert.ok(wrongShop.length > 0);
    assert.notDeepEqual(wrongShop, workflow("lens-hood-seller-shop").expected.extracted![0]!.records);
  } finally {
    await run.close();
  }
});
