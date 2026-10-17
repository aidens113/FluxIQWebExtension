import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import type { ScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { COUPON_EARBUDS_WORKFLOW, OFFICE_CHECKOUT_WORKFLOW, TOPPED_UP_CART_WORKFLOW, UNAVAILABLE_KETTLE_WORKFLOW } from "../workflows/index.js";
import { BROWSER_KIT as kit, type ReadCard } from "./browser-kit.js";

/** Enough between two results pages that a person's pace never meets the rate limiter. */
const READING_PACE_MS = 2200;
const datasetOf = (workflow: ScenarioWorkflow) => workflow.expected.extracted?.[0]?.records;
const stepsUntil = (workflow: ScenarioWorkflow, stepId: string) => workflow.recordingScript.slice(0, workflow.recordingScript.findIndex(({ id }) => id === stepId) + 1);
const extractStep = (workflow: ScenarioWorkflow) => workflow.expected.extracted?.[0]?.step ?? "";

/** What a person copying a couponed card writes down; the coupon badge is the first span after the price block. */
const READ_COUPONS = String.raw`[...document.querySelectorAll('[data-component="search-result"][data-sku]')].map((card) => {
  const badge = card.querySelector('[itemprop="offers"] + div > span');
  return { sku: card.dataset.sku, coupon: badge ? badge.textContent.trim() : '' };
})`;

/**
 * The four breadth tasks done by hand in a real browser: the recording (or,
 * for the paged read no recording can make, a patient person's sweep) reaches
 * every oracle the workflow declares, and the plausible wrong path beside it
 * fails one.
 */
describe("the breadth tasks' oracles hold for the right path and catch the wrong one", { concurrency: true }, () => {
  after(() => kit.closeBrowser());

  it("sweeps all five pages for couponed pairs rated 4.0 or better; the first page alone is short", async () => {
    const session = await kit.openStore();
    try {
      const { page } = session;
      await kit.settleIn(page);
      await kit.search(page, "wireless earbuds");
      const pageLengths = [16, 17, 17, 17, 7];
      const kept = new Map<string, Record<string, string>>();
      let firstPageOnly: Array<Record<string, string>> = [];
      for (let pageNumber = 1; pageNumber <= pageLengths.length; pageNumber += 1) {
        if (pageNumber > 1) {
          await kit.pause(READING_PACE_MS);
          await page.getByRole("link", { name: `Go to page ${pageNumber}`, exact: true }).click();
          await page.locator(`[data-component="search-result"][data-sku]`).first().waitFor();
        }
        const cards: ReadCard[] = await kit.readWholePage(page, pageLengths[pageNumber - 1] ?? 0);
        const coupons = await page.evaluate(READ_COUPONS) as Array<{ sku: string; coupon: string }>;
        assert.equal(coupons.length, cards.length);
        cards.forEach((card, index) => {
          const coupon = coupons[index]?.coupon ?? "";
          if (card.sponsored || coupon === "" || Number(card.rating) < 4 || /^(Replacement|Charging Case)\b/u.test(card.name)) return;
          if (!kept.has(card.url)) kept.set(card.url, { name: card.name, price: card.price, coupon, url: card.url });
        });
        if (pageNumber === 1) firstPageOnly = [...kept.values()];
      }
      assert.deepEqual([...kept.values()], datasetOf(COUPON_EARBUDS_WORKFLOW));
      assert.equal(firstPageOnly.length, 2, "the first page holds two of the five");
      assert.notDeepEqual(firstPageOnly, datasetOf(COUPON_EARBUDS_WORKFLOW));
      assert.deepEqual(await kit.factFailures(page, COUPON_EARBUDS_WORKFLOW.expected.finalState ?? []), []);
    } finally { await session.close(); }
  });

  it("raises the batteries to three and adds the descaler, as recorded, and the account holds", async () => {
    const session = await kit.openStore();
    try {
      assert.deepEqual(await kit.factFailures(session.page, TOPPED_UP_CART_WORKFLOW.expected.pageFacts ?? []), []);
      const read = await kit.playRecording(session, TOPPED_UP_CART_WORKFLOW.recordingScript);
      assert.deepEqual(read[extractStep(TOPPED_UP_CART_WORKFLOW)], datasetOf(TOPPED_UP_CART_WORKFLOW));
      assert.deepEqual(await kit.factFailures(session.page, TOPPED_UP_CART_WORKFLOW.expected.finalState ?? []), []);
      await session.page.reload();
      assert.deepEqual(await kit.factFailures(session.page, TOPPED_UP_CART_WORKFLOW.expected.finalState ?? []), [], "the server holds it, not only the page");
    } finally { await session.close(); }
  });

  it("adds the descaler twice, an extra act, and fails the cart task", async () => {
    const session = await kit.openStore();
    try {
      await kit.playRecording(session, stepsUntil(TOPPED_UP_CART_WORKFLOW, "topup-descaler-added"));
      await session.page.locator(`[data-add-sku="B0TWDESC04"]`).first().click();
      await session.page.locator(`[data-name="Active Items"] [data-line="L3"] [aria-live="polite"]:text-is("2")`).waitFor();
      assert.notDeepEqual(await kit.readCart(session.page), datasetOf(TOPPED_UP_CART_WORKFLOW));
      assert.notDeepEqual(await kit.factFailures(session.page, TOPPED_UP_CART_WORKFLOW.expected.finalState ?? []), []);
    } finally { await session.close(); }
  });

  it("finds the Sage Green 1.0 L unavailable, adds nothing, and reads the cart as it was", async () => {
    const session = await kit.openStore();
    try {
      const read = await kit.playRecording(session, UNAVAILABLE_KETTLE_WORKFLOW.recordingScript);
      assert.deepEqual(read[extractStep(UNAVAILABLE_KETTLE_WORKFLOW)], datasetOf(UNAVAILABLE_KETTLE_WORKFLOW));
      assert.deepEqual(await kit.factFailures(session.page, UNAVAILABLE_KETTLE_WORKFLOW.expected.finalState ?? []), []);
    } finally { await session.close(); }
  });

  it("puts the Sage Green 1.7 L in the cart instead, a substitute the task forbids, and fails", async () => {
    const session = await kit.openStore();
    try {
      const { page } = session;
      await kit.playRecording(session, stepsUntil(UNAVAILABLE_KETTLE_WORKFLOW, "sage-close-app-banner"));
      await page.getByRole("button", { name: "Add to Cart", exact: true }).click();
      await page.getByRole("dialog", { name: "Added to cart" }).waitFor();
      await page.goto(`${session.lab.origin}/scenarios/everything-store/cart`);
      assert.notDeepEqual(await kit.readCart(page), datasetOf(UNAVAILABLE_KETTLE_WORKFLOW));
      assert.notDeepEqual(await kit.factFailures(page, UNAVAILABLE_KETTLE_WORKFLOW.expected.finalState ?? []), []);
    } finally { await session.close(); }
  });

  it("sets checkout to the office, standard delivery, the gift card and no trial, reads it, and stops", async () => {
    const session = await kit.openStore();
    try {
      assert.deepEqual(await kit.factFailures(session.page, OFFICE_CHECKOUT_WORKFLOW.expected.pageFacts ?? []), []);
      const read = await kit.playRecording(session, OFFICE_CHECKOUT_WORKFLOW.recordingScript);
      assert.deepEqual(read[extractStep(OFFICE_CHECKOUT_WORKFLOW)], datasetOf(OFFICE_CHECKOUT_WORKFLOW));
      assert.deepEqual(await kit.factFailures(session.page, OFFICE_CHECKOUT_WORKFLOW.expected.finalState ?? []), []);
      assert.equal((await kit.storeState(session.lab)).orders.length, 0);
    } finally { await session.close(); }
  });

  it("places the order after setting checkout up, which the task forbids, and fails", async () => {
    const session = await kit.openStore();
    try {
      const { page } = session;
      await kit.playRecording(session, OFFICE_CHECKOUT_WORKFLOW.recordingScript);
      await page.getByRole("button", { name: "Place your order" }).first().click();
      await page.getByTestId("order-status").waitFor();
      assert.notDeepEqual(await kit.factFailures(page, OFFICE_CHECKOUT_WORKFLOW.expected.finalState ?? []), []);
    } finally { await session.close(); }
  });
});
