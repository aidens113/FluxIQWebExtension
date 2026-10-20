// A link click whose page answers it inside a shadow root, judged by the click
// verb's in-place watch (`action-runtime/in-place-effect.ts`).
//
// On bigbox (`run-mum0ke7z-940cbd27`) the product page's "Change store" link
// cancels its navigation and un-hides a flyout inside `vr-fulfillment-picker`'s
// open root. The document changes nowhere, so a watch of the document alone
// refused a click that worked, `output_not_observed`. The first row presses
// that link on bigbox's own product page.
//
// The other rows press the partner embeds bigbox's `partner-widgets` rendering
// switches on in the same page's buy box (`pages/partner-widgets/`): a
// delivery estimate inserted with its text already inside its root, review
// highlights whose element is in place from load and attaches its root only
// when asked, and -- the line in the other direction -- a pay-over-time offer
// whose details open inside a closed root, which cannot be seen, so the click
// still fails.
//
// The link rule's light-DOM rows are click.spec.ts's.

import { PARTNER_WIDGETS } from "../../../../../../scenario-lab/src/scenarios/bigbox-retail/index.js";
import type { ContentHarness } from "../../../index.js";
import { expect, test } from "../../../index.js";

/** A link click the page answered by changing what a reader sees, with the address left alone. */
const IN_PLACE_CONTENT = /^the page prevented the navigation and changed its content in place, \d+ ms after the press$/u;

const PRODUCT_PATH = "/scenarios/bigbox-retail/ip/valueridge-essentials-select-a-size-paper-towels/418830127";

/** Posts one of bigbox's own page mutations, as the page's `mutate` does. */
async function mutate(harness: ContentHarness, operation: string, payload: object = {}): Promise<void> {
  const response = await fetch(`${harness.lab.origin}/api/${harness.scenarioId}/${operation}`, {
    method: "POST",
    headers: { authorization: `Bearer ${harness.lab.runToken}`, "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  expect(response.status, `${harness.scenarioId} ${operation}`).toBe(200);
}

/**
 * bigbox's paper-towels page with consent, the email offer and the chat card answered, as a returning
 * shopper finds it -- in the given rendering, armed first because arming starts the shopper over.
 */
async function openProduct(openHarness: (id: string) => Promise<ContentHarness>, mode?: string): Promise<{ harness: ContentHarness; url: string }> {
  const harness = await openHarness("bigbox-retail");
  if (mode) await mutate(harness, "set-mode", { mode });
  await mutate(harness, "consent", { choice: "accept" });
  for (const operation of ["dismiss-promo", "dismiss-chat-card"]) await mutate(harness, operation);
  const url = new URL(PRODUCT_PATH, harness.lab.origin).href;
  await harness.page.goto(url);
  await expect.poll(async () => (await harness.messages()).some((message) => message.type === "fluxiq.contentReady")).toBe(true);
  // The page's own timers -- availability at 700 ms, the first reviews at 900 ms -- have run, so the
  // only content change a click's watch can see is the one the click caused.
  // (Evaluated rather than polled with waitForFunction: bigbox's CSP refuses the eval that polling uses.)
  await harness.page.evaluate(() => new Promise((resolve) => { setTimeout(resolve, Math.max(0, 1_500 - performance.now())); }));
  return { harness, url };
}

test.describe("a link answered inside a shadow root", () => {
  test("bigbox's Change store link un-hides the store flyout inside vr-fulfillment-picker's open root, and passes on the content", async ({ openHarness, page }) => {
    const { harness, url } = await openProduct(openHarness);
    const link = page.getByRole("link", { name: "Change store" });
    // The build's class names are hashed; the link is the only anchor in its line.
    const selector = await link.evaluate((element) => `.${CSS.escape(element.parentElement!.classList[0]!)} > a`);
    const flyoutOpen = () => page.evaluate(() => {
      const root = document.querySelector("vr-fulfillment-picker")?.shadowRoot;
      const flyout = root?.querySelector("ul")?.parentElement;
      return flyout ? !flyout.hidden : null;
    });
    expect(await flyoutOpen(), "the flyout starts hidden").toBe(false);

    const reply = await harness.runAction({ commandId: "click-change-store", actionType: "web.dom.click", selector });
    expect(reply, reply.message).toMatchObject({ status: "succeeded", validation: { status: "passed", actual: expect.stringMatching(IN_PLACE_CONTENT) } });
    expect(reply.failure).toBeUndefined();
    expect(await flyoutOpen(), "the store list is showing").toBe(true);
    expect(page.url()).toBe(url);
  });

  test("bigbox's delivery estimate, inserted after a wait with its text already inside its root, passes on the content", async ({ openHarness, page }) => {
    const { harness, url } = await openProduct(openHarness, "partner-widgets");
    const { tag, href, text } = PARTNER_WIDGETS.deliveryEstimate;
    expect(await page.locator(tag).count(), "no estimate before the press").toBe(0);
    const reply = await harness.runAction({ commandId: "click-estimate-delivery", actionType: "web.dom.click", selector: `a[href="${href}"]` });
    expect(reply, reply.message).toMatchObject({ status: "succeeded", validation: { status: "passed", actual: expect.stringMatching(IN_PLACE_CONTENT) } });
    expect(await page.locator(tag).evaluate((element) => element.shadowRoot?.textContent)).toBe(text);
    expect(page.url()).toBe(url);
  });

  test("bigbox's review highlights, whose root is attached to the element already in place with no mutation to observe, pass on the content", async ({ openHarness, page }) => {
    const { harness, url } = await openProduct(openHarness, "partner-widgets");
    const { tag, href, text } = PARTNER_WIDGETS.reviewHighlights;
    const root = () => page.locator(tag).evaluate((element) => element.shadowRoot?.textContent ?? null);
    expect(await root(), "the host is in place with no root").toBeNull();
    const reply = await harness.runAction({ commandId: "click-review-highlights", actionType: "web.dom.click", selector: `a[href="${href}"]` });
    expect(reply, reply.message).toMatchObject({ status: "succeeded", validation: { status: "passed", actual: expect.stringMatching(IN_PLACE_CONTENT) } });
    expect(await root()).toBe(text);
    expect(page.url()).toBe(url);
  });

  test("bigbox's pay-over-time details open inside a closed root, are not seen, and the click still reports output_not_observed", async ({ openHarness, page }) => {
    const { harness } = await openProduct(openHarness, "partner-widgets");
    const { tag, href } = PARTNER_WIDGETS.payOverTime;
    const height = () => page.locator(tag).evaluate((element) => element.getBoundingClientRect().height);
    const before = await height();
    expect(await page.locator(tag).evaluate((element) => element.shadowRoot), "the root is closed").toBeNull();
    const reply = await harness.runAction({ commandId: "click-payment-plan", actionType: "web.dom.click", selector: `a[href="${href}"]`, timeoutMs: 1_000 });
    expect(reply).toMatchObject({
      status: "failed",
      validation: { status: "failed", actual: "the page prevented the navigation, and in 1000 ms neither its address nor its content changed" },
      failure: { category: "output_not_observed", code: "web.validation.output_not_observed" }
    });
    expect(await height(), "the details did open, inside the closed root").toBeGreaterThan(before);
  });
});
