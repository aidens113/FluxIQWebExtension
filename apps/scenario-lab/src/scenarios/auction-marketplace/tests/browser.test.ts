import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { after, before, test } from "node:test";
import { chromium, type Browser, type Page } from "@playwright/test";
import { resolveScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { startScenarioLab, type RunningScenarioLab } from "../../../server.js";
import { listingByHandle } from "../catalog/index.js";
import { KESTREL_AUCTIONS } from "../manifest.js";
import { MARKET_ROOT } from "../paths.js";
import { auctionMarketplaceScenario as scenario } from "../scenario.js";
import type { AuctionMode, AuctionState } from "../types.js";
import { failingFacts, locate, runScript } from "./browser-support.js";

/**
 * The marketplace in a real browser. Each honest path -- the manifest's own
 * recording scripts, and a person reading the keyword results page by page --
 * must meet every oracle; each naive path -- following Next, taking the
 * advertisements, reading EUR 1.165,00 as a pound and change, bidding on the
 * first auction offered, filling the hidden reference box, clicking where the
 * greeting covers Confirm, pressing every heart -- must miss one.
 */
const manifest = scenario.manifest;
const TEST_TIMEOUT_MS = 90_000;
let browser: Browser;

before(async () => { browser = await chromium.launch({ channel: "chromium", headless: true }); });
after(async () => { await browser.close(); });

type Session = { lab: RunningScenarioLab; page: Page; errors: string[]; close(): Promise<void> };

async function session(mode: AuctionMode = "baseline", seed = 4040): Promise<Session> {
  const lab = await startScenarioLab({ runToken: randomBytes(24).toString("base64url"), seed });
  if (mode !== "baseline") await post(lab, "set-mode", { mode });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: "en-GB", timezoneId: "Europe/London" });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${lab.origin}${MARKET_ROOT}`);
  return { lab, page, errors, close: async () => { await context.close(); await lab.close(); } };
}

async function post(lab: RunningScenarioLab, operation: string, payload: unknown): Promise<void> {
  const response = await fetch(`${lab.origin}/api/auction-marketplace/${operation}`, {
    method: "POST", headers: { authorization: `Bearer ${lab.runToken}`, "content-type": "application/json" }, body: JSON.stringify(payload),
  });
  assert.equal(response.status, 200);
}

async function serverState(lab: RunningScenarioLab): Promise<AuctionState> {
  const response = await fetch(`${lab.origin}/__control/final-state?scenario=auction-marketplace`, { headers: { authorization: `Bearer ${lab.runToken}` } });
  return (await response.json() as { state: AuctionState }).state;
}

async function closeGreeting(page: Page): Promise<void> {
  await page.locator("#hal-greeting").waitFor({ state: "visible", timeout: 15_000 });
  await page.locator("#hal-greeting .hal-close").click();
}

/**
 * Answer what the home page throws at a visit as the recordings do, in the
 * order it arrives: the app promotion, the assistant's greeting, then the
 * cookie banner. Each answer lasts for the session.
 */
async function arrive(page: Page): Promise<void> {
  await locate(page, "role:dialog:Bid on the go").waitFor({ timeout: 15_000 });
  await page.locator(`div[role="dialog"] span:text-is("Not now")`).click();
  await closeGreeting(page);
  await locate(page, "role:button:Accept all").click();
}

/** Arrive, search, and wait for the cards to fill in. */
async function arriveAndSearch(page: Page, query = "kestrel 35"): Promise<void> {
  await arrive(page);
  await page.locator(`form[role="search"] input[name="_nkw"]`).fill(query);
  await page.locator(`form[role="search"] input[name="_nkw"]`).press("Enter");
  await page.locator(`ul[aria-busy="false"]`).waitFor({ timeout: 5000 });
}

const workflow = (workflowId: string) => resolveScenarioWorkflow(manifest, { workflowId });

test("the bid workflow's honest path places the bid and meets the playback goal and every final-state fact", { timeout: TEST_TIMEOUT_MS }, async () => {
  const run = await session();
  try {
    await runScript(run.page, run.lab.origin, manifest.recordingScript);
    assert.deepEqual(await failingFacts(run.page, [...(manifest.expected.finalState ?? []), ...manifest.playbackGoal!.successFacts]), []);
    const state = await serverState(run.lab);
    assert.deepEqual(state.bids.map(({ itemId, maxBid, current, winning }) => ({ itemId, maxBid, current, winning })), [{ itemId: "226152268190", maxBid: 8500, current: 8400, winning: true }]);
    assert.equal(state.restricted, false);
    assert.deepEqual(run.errors, []);
  } finally { await run.close(); }
});

test("the watch workflow's honest path watches three auctions, leaves the one already watched, and reads the watchlist back", { timeout: TEST_TIMEOUT_MS }, async () => {
  const run = await session();
  try {
    const { recordingScript, expected } = workflow("watch-endings");
    const extracted = await runScript(run.page, run.lab.origin, recordingScript);
    assert.deepEqual(extracted.get("extract-watchlist"), expected.extracted![0]!.records);
    assert.deepEqual(await failingFacts(run.page, expected.finalState ?? []), []);
    assert.deepEqual(run.errors, []);
  } finally { await run.close(); }
});

test("the extraction workflow's honest filter path passes the bot check and returns exactly the ten auctions owed", { timeout: TEST_TIMEOUT_MS }, async () => {
  const run = await session();
  try {
    const { recordingScript, expected } = workflow("kestrel-auctions");
    const extracted = await runScript(run.page, run.lab.origin, recordingScript);
    assert.deepEqual(extracted.get("extract-kestrel-auctions"), expected.extracted![0]!.records);
    assert.deepEqual(await failingFacts(run.page, expected.finalState ?? []), []);
    assert.equal((await serverState(run.lab)).challengePassed, true);
    assert.deepEqual(run.errors, []);
  } finally { await run.close(); }
});

type Card = { id: string; title: string; condition: string; price: string; approx: string; bids: string; end: string; postage: string };

async function readCards(page: Page): Promise<Card[]> {
  const cards: Card[] = [];
  for (const item of await page.locator("ul[aria-busy] > li[data-listingid]").all()) {
    const text = async (selector: string) => ((await item.locator(selector).first().textContent()) ?? "").replace(/\s+/gu, " ").trim();
    cards.push({
      id: (await item.getAttribute("data-listingid"))!,
      title: await text(":scope > div:nth-child(2) > a span:last-child"),
      condition: await text(":scope > div:nth-child(2) > div:nth-child(3) > span:first-child"),
      price: await text(":scope > div:nth-child(2) > div:nth-child(4) > span:nth-child(1)"),
      approx: await text(":scope > div:nth-child(2) > div:nth-child(4) > span:nth-child(2)"),
      bids: await text(":scope > div:nth-child(2) > div:nth-child(5) > span:nth-child(1)"),
      end: await text(":scope > div:nth-child(2) > div:nth-child(6) > span:nth-child(2)"),
      postage: await text(":scope > div:nth-child(2) > div:nth-child(7) > span:nth-child(1)"),
    });
  }
  return cards;
}

/** Pounds from `£1,011.10` or `approx. £146.68`. */
function pounds(text: string): number {
  return Number(text.replace(/^approx\. /u, "").replace(/[£,]/gu, ""));
}

/** A person's reading of a title: the original Kestrel 35 camera, not a later model, a lot, or a part. */
function originalKestrel35(title: string): boolean {
  if (!/kestrel[\s-]*35\b/iu.test(title)) return false;
  if (/35\s*-?\s*s\b|mk\s*ii|mark\s*2/iu.test(title)) return false;
  return !/lens only|case only|half case|box only|lens cap|lens hood|strap|instruction manual|filter|self-timer|cable|flashgun|meter cell|job lot|pair/iu.test(title);
}

/** `(Tue 22 Sep, 21:14)` as minutes into September, which orders every end in the fixture. */
function endKey(end: string): number {
  const match = /\((?:\w+) (\d+) Sep, (\d\d):(\d\d)\)/u.exec(end);
  assert.ok(match, end);
  return Number(match[1]) * 1440 + Number(match[2]) * 60 + Number(match[3]);
}

test("a person reading the keyword results page by page, by the numbered links, reaches the same ten auctions", { timeout: TEST_TIMEOUT_MS }, async () => {
  const run = await session();
  try {
    await arriveAndSearch(run.page);
    const seen = new Map<string, Card>();
    let repeats = 0;
    for (let pageNumber = 1; ; pageNumber += 1) {
      for (const card of await readCards(run.page)) {
        if (seen.has(card.id)) repeats += 1;
        else seen.set(card.id, card);
      }
      const nextNumber = run.page.locator(`nav[aria-label="Results pagination"] a:text-is("${pageNumber + 1}")`);
      if ((await nextNumber.count()) === 0) break;
      await nextNumber.click();
      await run.page.locator(`ul[aria-busy="false"]`).waitFor({ timeout: 5000 });
    }
    assert.equal(seen.size, 50, "three pages hold the fifty listings the search returns");
    assert.equal(repeats, 4, "each page seam repeats two listings");
    const owed = [...seen.values()]
      .filter((card) => originalKestrel35(card.title) && /\bbids?$/u.test(card.bids) && card.condition !== "For parts or not working")
      .filter((card) => pounds(card.approx === "" ? card.price : card.approx) < 150)
      .sort((left, right) => endKey(left.end) - endKey(right.end))
      .map(({ title, price, bids, postage }) => ({ title, price, bids, postage }));
    assert.deepEqual(owed, workflow("kestrel-auctions").expected.extracted![0]!.records);
  } finally { await run.close(); }
});

test("a naive read -- Next arrow, every card, prices parsed as plain numbers -- misses the answer", { timeout: TEST_TIMEOUT_MS }, async () => {
  const run = await session();
  try {
    await arriveAndSearch(run.page);
    const rows: Array<{ title: string; price: string; bids: string; postage: string }> = [];
    const pagesVisited: string[] = [];
    for (let hop = 0; hop < 3; hop += 1) {
      pagesVisited.push((await run.page.locator(`nav[aria-label="Results pagination"] a[aria-current="page"]`).textContent()) ?? "");
      for (const item of await run.page.locator("ul[aria-busy] > li").all()) {
        const text = async (selector: string) => ((await item.locator(selector).first().textContent()) ?? "").replace(/\s+/gu, " ").trim();
        rows.push({ title: await text("[role=heading] span:last-child"), price: await text(":scope > div:nth-child(2) > div:nth-child(4) > span:first-child"), bids: await text(":scope > div:nth-child(2) > div:nth-child(5) > span:first-child"), postage: await text(":scope > div:nth-child(2) > div:nth-child(7) > span:first-child") });
      }
      if (hop === 2) break;
      await run.page.locator(`a[aria-label="Go to next search page"]`).click();
      await run.page.locator(`ul[aria-busy="false"]`).waitFor({ timeout: 5000 });
    }
    assert.deepEqual(pagesVisited, ["1", "2", "2"], "the Next arrow never leaves page two");
    const naive = rows.filter((row) => /kestrel 35/iu.test(row.title) && !/35s/iu.test(row.title) && /bids?$/u.test(row.bids))
      .filter((row) => Number(row.price.replace(/[^0-9.]/gu, "")) < 150);
    const expected = workflow("kestrel-auctions").expected.extracted![0]!.records!;
    assert.notDeepEqual(naive, expected);
    assert.ok(naive.some((row) => row.title === listingByHandle("x7").title), "EUR 1.165,00 read as 1.165 lets the thousand-pound set in");
    assert.ok(!naive.some((row) => row.title === listingByHandle("m6").title), "US $189.00 read as 189 drops an auction worth £141.05");
    assert.ok(!naive.some((row) => row.title === listingByHandle("m9").title), "EUR 169,00 read as 169 drops an auction worth £146.68");
  } finally { await run.close(); }
});

async function openBidDrawer(page: Page, amount: string): Promise<void> {
  await locate(page, "role:button:Place bid").click();
  await page.locator(`input[name="maxbid"]`).fill(amount);
  await page.locator(`div[role="dialog"] div:text-is("Review bid")`).click();
}

/**
 * The same drawer, opened without a pointer: each press is dispatched on its
 * control, so the greeting that opens over the drawer's foot 3.5 s into the
 * page cannot take it, however long the page took to get here. Only the press
 * the test aims at a point meets the greeting.
 */
async function openBidDrawerWithoutPointer(page: Page, amount: string): Promise<void> {
  await locate(page, "role:button:Place bid").dispatchEvent("click");
  await page.locator(`input[name="maxbid"]`).fill(amount);
  await page.locator(`div[role="dialog"] div:text-is("Review bid")`).dispatchEvent("click");
  await locate(page, "role:button:Confirm bid").waitFor({ state: "visible", timeout: 5000 });
}

const goalFacts = manifest.playbackGoal!.successFacts;

test("bidding on the auction the home page offers first bids on a 35S below its minimum and meets no goal", { timeout: TEST_TIMEOUT_MS }, async () => {
  const run = await session();
  try {
    await arrive(run.page);
    await run.page.locator(`section[aria-label="Pick up where you left off"] a:text-is("Place bid")`).click();
    await openBidDrawer(run.page, "85.00");
    await locate(run.page, "role:button:Confirm bid").click();
    await run.page.locator(`div[role="dialog"] [role="alert"]:text-is("Enter £90.00 or more.")`).waitFor({ timeout: 5000 });
    assert.notDeepEqual(await failingFacts(run.page, goalFacts), []);
    assert.deepEqual((await serverState(run.lab)).bids, []);
  } finally { await run.close(); }
});

test("filling the hidden reference box gets the bid refused and the account restricted, even for an honest retry", { timeout: TEST_TIMEOUT_MS }, async () => {
  const run = await session();
  try {
    await run.page.goto(`${run.lab.origin}${MARKET_ROOT}itm/${listingByHandle("m7").id}`);
    await locate(run.page, "role:button:Accept all").click();
    await closeGreeting(run.page);
    await locate(run.page, "role:button:Place bid").click();
    await run.page.locator(`input[name="maxbid"]`).fill("85.00");
    await run.page.locator(`input[name="reference"]`).fill("85.00", { force: true });
    await run.page.locator(`div[role="dialog"] div:text-is("Review bid")`).click();
    await locate(run.page, "role:button:Confirm bid").click();
    await run.page.locator(`div[role="dialog"] [role="status"]:has-text("couldn't place your bid")`).waitFor({ timeout: 5000 });
    await locate(run.page, "role:button:Done").click();
    await openBidDrawer(run.page, "85.00");
    await locate(run.page, "role:button:Confirm bid").click();
    await run.page.locator(`div[role="dialog"] [role="status"]:has-text("couldn't place your bid")`).waitFor({ timeout: 5000 });
    assert.notDeepEqual(await failingFacts(run.page, goalFacts), []);
    const state = await serverState(run.lab);
    assert.equal(state.restricted, true);
    assert.deepEqual(state.bids, []);
  } finally { await run.close(); }
});

test("clicking Confirm where it is drawn while the greeting covers it opens the chat and places no bid", { timeout: TEST_TIMEOUT_MS }, async () => {
  const run = await session();
  try {
    await run.page.goto(`${run.lab.origin}${MARKET_ROOT}itm/${listingByHandle("m7").id}`);
    await locate(run.page, "role:button:Accept all").click();
    await openBidDrawerWithoutPointer(run.page, "85.00");
    await run.page.locator("#hal-greeting").waitFor({ state: "visible", timeout: 6000 });
    const box = (await locate(run.page, "role:button:Confirm bid").boundingBox())!;
    await run.page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await run.page.locator("#hal-panel").waitFor({ state: "visible", timeout: 3000 });
    assert.notDeepEqual(await failingFacts(run.page, goalFacts), []);
    assert.deepEqual((await serverState(run.lab)).bids, []);
  } finally { await run.close(); }
});

test("pressing every qualifying heart takes the watched one off, and a fourth press in five seconds is refused", { timeout: TEST_TIMEOUT_MS }, async () => {
  const run = await session();
  try {
    await arriveAndSearch(run.page);
    for (const handle of ["m1", "m2", "m3", "l2"]) {
      await run.page.locator(`hl-watch[data-item="${listingByHandle(handle).id}"] div`).click();
    }
    await run.page.getByText(/^Slow down! You can change your Watchlist again in \d seconds\.$/u).waitFor({ timeout: 5000 });
    const state = await serverState(run.lab);
    assert.ok(!state.watched.includes(listingByHandle("m3").id), "the heart already on took m3 off the watchlist");
    assert.equal(state.lastWatch?.outcome, "rate-limited");
    assert.notDeepEqual(await failingFacts(run.page, workflow("watch-endings").expected.finalState ?? []), []);
  } finally { await run.close(); }
});

const filteredResults = `${MARKET_ROOT}sch/i.html?_nkw=kestrel+35&LH_Auction=1&LH_ItemCondition=3000|2500&Model=Kestrel+35&Type=Rangefinder+camera|Film+camera&_udhi=150&_sop=1`;

test("the gallery layout owes the same ten listings, and the list layout's card positions find none of them", { timeout: TEST_TIMEOUT_MS }, async () => {
  const run = await session("grid-view");
  try {
    await arrive(run.page);
    await run.page.goto(`${run.lab.origin}${filteredResults}`);
    await run.page.locator(`ul[aria-busy="false"]`).waitFor({ timeout: 5000 });
    const { recordingScript, expected } = workflow("kestrel-auctions");
    const extractStep = recordingScript.find(({ id }) => id === "extract-kestrel-auctions")!;
    const listRead = (await runScript(run.page, run.lab.origin, [extractStep])).get("extract-kestrel-auctions")!;
    assert.equal(listRead.length, 10);
    assert.ok(listRead.every((record) => Object.keys(record).length === 0), "no list-layout field resolves in the gallery");
    const gridRead: Array<Record<string, string>> = [];
    for (const item of await run.page.locator("ul[aria-busy] > li[data-listingid]").all()) {
      const lines = item.locator(":scope > div > p");
      const text = async (locator: ReturnType<Page["locator"]>) => ((await locator.first().textContent()) ?? "").replace(/\s+/gu, " ").trim();
      gridRead.push({
        title: await text(item.locator(":scope > div > h3 a span:last-child")),
        price: await text(lines.nth(4).locator("span").nth(0)),
        bids: await text(lines.nth(3).locator("span").nth(0)),
        postage: await text(lines.nth(1).locator("span").nth(0)),
      });
    }
    assert.deepEqual(gridRead, expected.extracted![0]!.records);
  } finally { await run.close(); }
});

test("the survey interrupts the second results page until declined, and not again after", { timeout: TEST_TIMEOUT_MS }, async () => {
  const run = await session("feedback-survey");
  try {
    await arriveAndSearch(run.page);
    await run.page.locator(`nav[aria-label="Buying format"] a:text-is("Auction")`).click();
    await locate(run.page, "role:dialog:How are your search results?").waitFor({ timeout: 5000 });
    await assert.rejects(run.page.locator(`section[aria-label="Condition"] a[role="checkbox"]`).first().click({ timeout: 1500 }), /intercepts pointer events|Timeout/u);
    await run.page.locator(`div[role="dialog"] span:text-is("No thanks")`).click();
    await run.page.locator(`section[aria-label="Condition"] a[role="checkbox"]`).first().click();
    await run.page.locator(`ul[aria-busy="false"]`).waitFor({ timeout: 5000 });
    await run.page.waitForTimeout(1200);
    assert.equal(await locate(run.page, "role:dialog:How are your search results?").count(), 0);
  } finally { await run.close(); }
});

test("the redesigned listing has no watch hook; Save this seller saves a seller, and only Save item watches", { timeout: TEST_TIMEOUT_MS }, async () => {
  const run = await session("watch-redesign");
  try {
    await run.page.goto(`${run.lab.origin}${MARKET_ROOT}itm/${listingByHandle("m1").id}`);
    await locate(run.page, "role:button:Accept all").click();
    await closeGreeting(run.page);
    assert.equal(await run.page.locator(`[data-testid="x-watch-cta"]`).count(), 0);
    await locate(run.page, "role:button:Save this seller").click();
    await run.page.locator(`button[aria-pressed="true"]:text-is("Seller saved")`).waitFor({ timeout: 4000 });
    assert.equal(await run.page.locator(`[data-testid="followed-sellers"]`).textContent(), "tinhorn.film");
    await locate(run.page, "role:button:Save item").click();
    await run.page.locator(`button[aria-label="Save item"][aria-pressed="true"]`).waitFor({ timeout: 4000 });
    const state = await serverState(run.lab);
    assert.deepEqual(state.followed, ["tinhorn.film"]);
    assert.ok(state.watched.includes(listingByHandle("m1").id));
  } finally { await run.close(); }
});

test("class names and card ids change with the seed, and the text a person reads does not", { timeout: TEST_TIMEOUT_MS }, async () => {
  const first = await session("baseline", 1);
  const second = await session("baseline", 2);
  try {
    const read = async (run: Session) => {
      await run.page.goto(`${run.lab.origin}${filteredResults}`);
      await run.page.locator(`ul[aria-busy="false"]`).waitFor({ timeout: 5000 });
      const card = run.page.locator("ul[aria-busy] > li[data-listingid]").first();
      return { className: await card.getAttribute("class"), id: await card.getAttribute("id"), text: (await card.textContent())?.replace(/\s+/gu, " ").trim() };
    };
    const [one, two] = [await read(first), await read(second)];
    assert.notEqual(one.className, two.className);
    assert.notEqual(one.id, two.id);
    assert.equal(one.text, two.text);
    assert.ok(one.text?.includes(KESTREL_AUCTIONS[0]!.title));
  } finally { await first.close(); await second.close(); }
});
