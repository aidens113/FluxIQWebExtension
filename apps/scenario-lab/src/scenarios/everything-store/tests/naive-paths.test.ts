import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { resolveScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { TIDEWELL_KETTLES } from "../catalog/index.js";
import { everythingStoreScenario as scenario } from "../scenario.js";
import { BROWSER_KIT as kit } from "./browser-kit.js";

const manifest = scenario.manifest;
const FAMILY_CARD = `[data-component="search-result"][data-sku="${TIDEWELL_KETTLES[0]!.sku}"]:not([data-ad-id]) h2 a`;
/** On a product page, press Add to Cart the moment the document is parsed, and note that it did. */
const EARLY_PRESS = String.raw`if (location.pathname.includes('/dp/')) document.addEventListener('DOMContentLoaded', () => {
  const add = [...document.querySelectorAll('button')].find((button) => button.textContent.trim() === 'Add to Cart');
  if (add) add.click();
  window.earlyPress = add ? 'pressed' : 'no button';
});`;

/**
 * The shortcuts an automation takes that a person would not, each failing the
 * way the store makes it fail. None of these is a fixture bug: each is the
 * mess the store has on purpose, met without judgement.
 */
describe("a naive shopper fails", { concurrency: true }, () => {
  // Suite-level, not file-level: a file-level `after` waits for the process to go idle, which an open browser never lets it do.
  after(() => kit.closeBrowser());

  it("fills the first text field of the search form, which is the honeypot, and meets the robot check", async () => {
    const session = await kit.openStore();
    try {
      const { page } = session;
      await kit.settleIn(page);
      for (const field of await page.locator(`form[role="search"] input[type="text"]`).all()) await field.fill("wireless earbuds");
      await Promise.all([page.waitForURL(/\/s\?/u), page.getByRole("textbox", { name: "Search Brightaisle" }).press("Enter")]);
      assert.ok(await page.getByTestId("robot-check").isVisible(), "the store answers with its robot check");
      assert.equal(await page.getByTestId("result-count").count(), 0, "and shows no results");
      assert.equal((await kit.storeState(session.lab)).guard.flagged, "honeypot");
      await page.goto(`${session.lab.origin}/scenarios/everything-store/cart`);
      assert.ok(await page.getByTestId("robot-check").isVisible(), "and keeps answering with it, whatever is asked for");
    } finally { await session.close(); }
  });

  it("clicks Add to Cart where it is drawn while the chat panel covers it, and adds nothing", async () => {
    const session = await kit.openStore();
    try {
      const { page } = session;
      await kit.settleIn(page);
      await kit.search(page, "tidewell kettle");
      await page.locator(FAMILY_CARD).click();
      const panel = page.getByRole("dialog", { name: "Brightaisle Assistant" });
      await panel.waitFor({ timeout: 9000 });
      const button = page.getByRole("button", { name: "Add to Cart", exact: true });
      const [box, cover] = [await button.boundingBox(), await panel.boundingBox()];
      assert.ok(box && cover, "both are on the page");
      const [x, y] = [box.x + box.width / 2, box.y + box.height / 2];
      assert.ok(x >= cover.x && x <= cover.x + cover.width && y >= cover.y && y <= cover.y + cover.height, "the panel covers the button's centre");
      await page.mouse.click(x, y);
      await kit.pause(1000);
      assert.equal((await kit.storeState(session.lab)).cart.length, 2, "the click landed on the chat, so nothing was added");
    } finally { await session.close(); }
  });

  it("clicks Add to Cart the moment the page appears, before it has come alive, and adds nothing", async () => {
    const session = await kit.openStore();
    try {
      const { page } = session;
      await kit.settleIn(page);
      await kit.search(page, "tidewell kettle");
      // The press is made by the page itself the moment its document is parsed, which is always before the buy box
      // hydrates (`productHydrate` later); a press sent from here after the load event races that timer.
      await page.addInitScript(EARLY_PRESS);
      await page.locator(FAMILY_CARD).click();
      await kit.awaitLiveProductPage(page);
      assert.equal(await page.evaluate("window.earlyPress"), "pressed");
      assert.equal((await kit.storeState(session.lab)).cart.length, 2, "the early press was lost");
    } finally { await session.close(); }
  });

  it("takes every card on the first page, sponsored ones included, and gets the wrong table", async () => {
    const session = await kit.openStore();
    try {
      const { page } = session;
      await kit.settleIn(page);
      await kit.search(page, "wireless earbuds");
      await page.getByRole("link", { name: "Brightaisle Plus" }).click();
      await page.locator(`[data-component="search-result"][data-sku][data-index="1"]`).waitFor();
      const cards = await kit.readWholePage(page, 16);
      const everything = cards.map(({ name, price, rating, url }) => ({ name, price, rating, url }));
      const expected = resolveScenarioWorkflow(manifest, { workflowId: "first-page-earbuds" }).expected.extracted?.[0]?.records;
      assert.equal(cards.filter((card) => card.sponsored).length, 4, "four sponsored cards sit among the sixteen");
      assert.notDeepEqual(everything, expected);
      const withoutScrolling = cards.filter((card) => !card.sponsored).slice(0, 12);
      assert.notDeepEqual(withoutScrolling.map(({ name, price, rating, url }) => ({ name, price, rating, url })), expected, "and a read that stops at the twelfth misses four");
    } finally { await session.close(); }
  });

  it("pages through results faster than a person reads and is told to wait", async () => {
    const session = await kit.openStore();
    try {
      const { page, lab } = session;
      await kit.settleIn(page);
      await kit.search(page, "wireless earbuds");
      const statuses: number[] = [];
      let retryAfter: string | null = null;
      for (let pageNumber = 2; pageNumber <= 6 && retryAfter === null; pageNumber += 1) {
        const response = await page.goto(`${lab.origin}/scenarios/everything-store/s?k=wireless+earbuds&page=${Math.min(pageNumber, 5)}`);
        statuses.push(response?.status() ?? 0);
        retryAfter = response?.headers()["retry-after"] ?? null;
      }
      assert.ok(statuses.includes(429), `a burst is refused: ${statuses.join(", ")}`);
      assert.ok(await page.getByTestId("rate-limited").isVisible());
      await kit.pause(Number(retryAfter) * 1000 + 200);
      const retried = await page.goto(`${lab.origin}/scenarios/everything-store/s?k=wireless+earbuds&page=2`);
      assert.equal(retried?.status(), 200, "waiting as asked works");
    } finally { await session.close(); }
  });

  it("types a guess into the robot check, which leaves the challenge standing and marks the attempt", async () => {
    const session = await kit.openStore("robot-check");
    try {
      const { page } = session;
      await page.getByLabel("Type characters").fill("ABCDEF");
      await Promise.all([page.waitForEvent("load"), page.getByRole("button", { name: "Continue shopping" }).click()]);
      const finalState = resolveScenarioWorkflow(manifest, { workflowId: "first-page-earbuds", variantId: "robot-check" }).expected.finalState ?? [];
      assert.deepEqual(await kit.factFailures(page, finalState), ["no-guess-made: expected false, found true"]);
    } finally { await session.close(); }
  });
});
