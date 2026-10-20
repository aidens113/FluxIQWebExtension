import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { chromium, type Browser } from "@playwright/test";
import { PARTNER_WIDGETS as W } from "../index.js";
import { openHarness, type Harness } from "./browser-harness.js";

/**
 * The `partner-widgets` embeds in a real browser: the shadow roots the
 * markup test can only read as script text. Headless full Chromium, as the
 * other bigbox browser tests run it. The page-side code is passed as
 * expressions, since this package compiles without the DOM library.
 */
let browser: Browser;
before(async () => { browser = await chromium.launch({ channel: "chromium", headless: true }); });
after(async () => { await browser?.close(); });

const TIMEOUT = { timeout: 120_000 };
const PRODUCT = "ip/valueridge-essentials-select-a-size-paper-towels/418830127";
const ARMING: ReadonlyArray<[string, object]> = [["set-mode", { mode: "partner-widgets" }], ["consent", { choice: "accept" }], ["dismiss-promo", {}], ["dismiss-chat-card", {}]];

/** The product page armed into the rendering, with consent, the email offer and the chat card answered, after the page's own timers have run. */
async function withProduct(run: (harness: Harness) => Promise<void>): Promise<void> {
  const harness = await openHarness(browser);
  try {
    for (const [operation, payload] of ARMING) await harness.arm(operation, payload);
    await harness.open(PRODUCT);
    await harness.page.evaluate("new Promise((resolve) => setTimeout(resolve, Math.max(0, 1500 - performance.now())))");
    await run(harness);
    assert.deepEqual(harness.consoleErrors, []);
    assert.deepEqual(harness.offLoopback, []);
  } finally {
    await harness.close();
  }
}

/** Starts recording every light-DOM mutation in the document, as a page-wide observer sees them. */
const observeDocument = (harness: Harness) => harness.page.evaluate(`{
  window.partnerRecords = [];
  new MutationObserver((list) => { for (const record of list) window.partnerRecords.push(record.type + ' ' + record.target.nodeName); })
    .observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
}`);
const observed = (harness: Harness) => harness.page.evaluate("window.partnerRecords") as Promise<string[]>;
const settle = (harness: Harness) => harness.page.evaluate("new Promise((resolve) => setTimeout(resolve, 600))");

describe("partner embeds", { concurrency: true }, () => {
  test("the pay-over-time offer renders from a closed root, and its link opens the details with no change a page can observe", TIMEOUT, () => withProduct(async (harness) => {
    const { page } = harness;
    type Probe = { open: boolean; attached: boolean; height: number; light: number };
    const probe = () => page.evaluate(`(() => {
      const element = document.querySelector(${JSON.stringify(W.payOverTime.tag)});
      let attached = false;
      try { element.attachShadow({ mode: 'open' }); } catch { attached = true; }
      return { open: element.shadowRoot !== null, attached, height: element.getBoundingClientRect().height, light: element.childNodes.length };
    })()`) as Promise<Probe>;
    const closed = await probe();
    assert.deepEqual([closed.open, closed.attached, closed.light], [false, true, 0], "a root is attached, closed, and the host has no light content");
    assert.ok(closed.height > 0, "the offer renders");
    await observeDocument(harness);
    await page.getByRole("link", { name: W.payOverTime.link }).click();
    await settle(harness);
    assert.deepEqual(await observed(harness), [], "nothing outside the closed root changed");
    assert.ok((await probe()).height > closed.height, "the details opened inside the root");
    assert.ok(page.url().endsWith(PRODUCT), page.url());
  }));

  test("the delivery link inserts an estimate whose open root already holds its text", TIMEOUT, () => withProduct(async (harness) => {
    const { page } = harness;
    assert.equal(await page.locator(W.deliveryEstimate.tag).count(), 0);
    const inserted = page.evaluate(`new Promise((resolve) => {
      new MutationObserver((list, observer) => {
        for (const record of list) for (const node of record.addedNodes) {
          if (node.localName === ${JSON.stringify(W.deliveryEstimate.tag)}) { observer.disconnect(); resolve(node.shadowRoot ? node.shadowRoot.textContent : null); }
        }
      }).observe(document, { subtree: true, childList: true });
    })`) as Promise<string | null>;
    await page.getByRole("link", { name: W.deliveryEstimate.link }).click();
    assert.equal(await inserted, W.deliveryEstimate.text, "the root and its text were there when the element went in");
    assert.equal(await page.getByText(W.deliveryEstimate.text).count(), 1);
    await page.getByRole("link", { name: W.deliveryEstimate.link }).click();
    await settle(harness);
    assert.equal(await page.locator(W.deliveryEstimate.tag).count(), 1, "a second press does not add a second estimate");
  }));

  test("the review link upgrades the host already in place, attaching its root with no mutation to observe", TIMEOUT, () => withProduct(async (harness) => {
    const { page } = harness;
    const state = () => page.evaluate(`(() => {
      const element = document.querySelector(${JSON.stringify(W.reviewHighlights.tag)});
      return { defined: customElements.get(${JSON.stringify(W.reviewHighlights.tag)}) !== undefined, root: element.shadowRoot ? element.shadowRoot.textContent : null };
    })()`) as Promise<{ defined: boolean; root: string | null }>;
    assert.deepEqual(await state(), { defined: false, root: null });
    await observeDocument(harness);
    await page.getByRole("link", { name: W.reviewHighlights.link }).click();
    await settle(harness);
    assert.deepEqual(await state(), { defined: true, root: W.reviewHighlights.text });
    assert.deepEqual(await observed(harness), [], "attaching the root changed nothing in the light DOM");
    assert.equal(await page.locator(W.reviewHighlights.tag).count(), 1);
  }));
});
