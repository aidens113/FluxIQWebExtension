import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { resolveScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { HOUSEHOLD, TIDEWELL_KETTLES } from "../catalog/index.js";
import { STORE_TIMINGS } from "../client/index.js";
import { robotCode } from "../state/index.js";
import { everythingStoreScenario as scenario } from "../scenario.js";
import { BROWSER_KIT as kit, type ReadCard } from "./browser-kit.js";

const manifest = scenario.manifest;
const expectedOf = (workflowId?: string, variantId?: string) => resolveScenarioWorkflow(manifest, { ...(workflowId ? { workflowId } : {}), ...(variantId ? { variantId } : {}) }).expected;
const records = (cards: readonly ReadCard[]) => cards.map(({ name, price, rating, url }) => ({ name, price, rating, url }));
/** Enough between two results pages that a person's pace never meets the rate limiter. */
const READING_PACE_MS = 2200;
const FAMILY_CARD = `[data-component="search-result"][data-sku="${TIDEWELL_KETTLES[0]!.sku}"]:not([data-ad-id]) h2 a`;

/**
 * A patient, competent shopper doing each task by hand in a real browser, and
 * every oracle the manifest declares for it holding afterwards. Each task has
 * its own lab and its own browser context, so they run side by side.
 */
describe("an honest shopper passes every oracle", { concurrency: true }, () => {
  // Suite-level, not file-level: a file-level `after` waits for the process to go idle, which an open browser never lets it do.
  after(() => kit.closeBrowser());

  it("reads the first page of a Plus-only earbud search", async () => {
    const session = await kit.openStore();
    try {
      const { page } = session;
      await kit.settleIn(page);
      await kit.search(page, "wireless earbuds");
      await page.getByRole("link", { name: "Brightaisle Plus" }).click();
      await page.locator(`[data-component="search-result"][data-sku][data-index="1"]`).waitFor();
      const cards = await kit.readWholePage(page, 16);
      const expected = expectedOf("first-page-earbuds");
      assert.deepEqual(records(cards.filter((card) => !card.sponsored)), expected.extracted?.[0]?.records);
      assert.deepEqual(await kit.factFailures(page, expected.finalState ?? []), []);
    } finally { await session.close(); }
  });

  it("sweeps every page for Plus pairs rated 4.0 or better under $50, each once", async () => {
    const session = await kit.openStore();
    try {
      const { page } = session;
      await kit.settleIn(page);
      await kit.search(page, "wireless earbuds");
      const seen: ReadCard[] = [];
      const pageLengths = [16, 17, 17, 17, 7];
      for (let pageNumber = 1; pageNumber <= pageLengths.length; pageNumber += 1) {
        if (pageNumber > 1) {
          await kit.pause(READING_PACE_MS);
          await page.getByRole("link", { name: `Go to page ${pageNumber}`, exact: true }).click();
          await page.locator(`[data-component="search-result"][data-sku]`).first().waitFor();
        }
        seen.push(...await kit.readWholePage(page, pageLengths[pageNumber - 1] ?? 0));
      }
      const accessory = (name: string) => /^(Replacement|Charging Case)\b/u.test(name);
      const kept = new Map<string, ReadCard>();
      for (const card of seen) {
        if (card.sponsored || !card.plus || accessory(card.name)) continue;
        if (Number(card.rating) < 4 || Number(card.price.replace(/[$,]/gu, "")) >= 50) continue;
        if (!kept.has(card.url)) kept.set(card.url, card);
      }
      const expected = expectedOf("plus-under-fifty");
      assert.deepEqual(records([...kept.values()]), expected.extracted?.[0]?.records);
      assert.ok(seen.filter((card) => !card.sponsored).length > 70, "the sweep saw the repeats at the page boundaries");
      assert.deepEqual(await kit.factFailures(page, expected.finalState ?? []), []);
    } finally { await session.close(); }
  });

  it("puts two Sage Green kettles in the cart, saves the phone case for later, and reads the cart back", async () => {
    const session = await kit.openStore();
    try {
      const { page } = session;
      await kit.settleIn(page);
      await kit.search(page, "tidewell kettle");
      await page.locator(FAMILY_CARD).click();
      await page.getByRole("dialog", { name: "Brightaisle Assistant" }).waitFor({ timeout: 9000 });
      await page.getByRole("button", { name: "Minimize chat" }).click();
      await page.locator(`[title="Click to select Sage Green"]`).click();
      await page.waitForURL(/\/dp\/B0D7KXS4G7$/u);
      await kit.awaitLiveProductPage(page);
      await page.getByLabel("Quantity:").selectOption("2");
      await page.getByRole("button", { name: "Add to Cart", exact: true }).click();
      await page.getByRole("dialog", { name: "Added to cart" }).waitFor();
      await page.getByRole("link", { name: "Go to Cart" }).click();
      const caseRow = page.locator(`[data-name="Active Items"] [data-sku="${HOUSEHOLD.phoneCase.sku}"]`);
      await caseRow.getByText("Save for later", { exact: true }).click();
      await caseRow.getByText("Try again", { exact: true }).click({ timeout: STORE_TIMINGS.saveRetry + 3000 });
      await page.locator(`[data-name="Saved Cart Items"] [data-sku="${HOUSEHOLD.phoneCase.sku}"]`).waitFor();
      const expected = expectedOf("add-to-cart");
      assert.deepEqual(await kit.readCart(page), expected.extracted?.[0]?.records);
      assert.deepEqual(await kit.factFailures(page, expected.finalState ?? []), []);
    } finally { await session.close(); }
  });

  it("buys one Matte Black kettle with standard delivery and no trial, leaving the cart alone", async () => {
    const session = await kit.openStore();
    try {
      const { page } = session;
      await kit.settleIn(page);
      await kit.search(page, "tidewell kettle");
      await page.locator(FAMILY_CARD).click();
      await page.getByRole("dialog", { name: "Brightaisle Assistant" }).waitFor({ timeout: 9000 });
      await page.getByRole("button", { name: "Minimize chat" }).click();
      await page.locator(`[title="Click to select Matte Black"]`).click();
      await page.waitForURL(/\/dp\/B0D7KX9MBL$/u);
      await kit.awaitLiveProductPage(page);
      await page.getByRole("button", { name: "Buy Now" }).click();
      await page.waitForURL(/\/checkout$/u);
      await Promise.all([page.waitForEvent("load"), page.getByLabel(/FREE Standard Delivery/u).check()]);
      await Promise.all([page.waitForEvent("load"), page.getByLabel(/Brightaisle Plus trial/u).uncheck()]);
      await page.getByRole("button", { name: "Place your order" }).first().click();
      await page.getByTestId("order-status").waitFor();
      assert.deepEqual(await kit.factFailures(page, [...(expectedOf().finalState ?? []), ...(manifest.playbackGoal?.successFacts ?? [])]), []);
      assert.equal((await kit.storeState(session.lab)).cart.length, 2);
    } finally { await session.close(); }
  });

  it("passes the robot check by reading the characters, which only a person can do", async () => {
    const session = await kit.openStore("robot-check");
    try {
      const { page } = session;
      assert.deepEqual(await kit.factFailures(page, expectedOf("first-page-earbuds", "robot-check").pageFacts ?? []), []);
      await page.getByLabel("Type characters").fill(robotCode(241, 0));
      await Promise.all([page.waitForEvent("load"), page.getByRole("button", { name: "Continue shopping" }).click()]);
      await page.getByTestId("cart-count").waitFor();
      assert.equal(await page.getByTestId("robot-check").count(), 0);
    } finally { await session.close(); }
  });
});
