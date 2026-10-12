// A press the page only woke on, covered during the wait by a layer that opens
// on a timer, is pressed once more after the layer is closed (t476), on
// bigbox-retail through the real content-script and page-world bundles (T2
// harness: no background worker, no Core, no model).
//
// bigbox's first Add to cart press after a page load only wakes the page and
// adds nothing, and its support card opens over the pinned Add to cart three
// seconds after a product page loads. In `run-mv5tusj4-b7ee0630` the card
// opened inside the press's ignored-press window, the click took the card for
// the press's answer, and the step was reported done with nothing in the cart,
// in a trial and in playback. The card's own timer is held by the page here and
// started by the first press, so the card opens 150 ms after it, inside the
// window, every time. The oracle is the Scenario Lab's cart and the page's own
// press count, never the reply alone.

import type { BrowserActionResult } from "../../../../../src/shared/protocol.js";
import { CHAT_CARD_DELAY_MS } from "../../../../../../scenario-lab/src/scenarios/bigbox-retail/client/index.js";
import { expect, test } from "../../../index.js";
import type { ContentHarness } from "../../../index.js";

const PRODUCT = "/scenarios/bigbox-retail/ip/valueridge-essentials-select-a-size-paper-towels/418830127";
const PRODUCT_ID = "418830127";

/** How long after the first press the held card opens: well inside the click's 800 ms ignored-press window. */
const CARD_AFTER_PRESS_MS = 150;

type BigboxState = { chatCard: string; cart: Array<{ productId: string; qty: number }> };

const actualOf = (reply: BrowserActionResult): string =>
  reply.failure?.actual ?? (reply.validation.status === "none" ? "" : reply.validation.actual);

async function apply(harness: ContentHarness, operation: string, payload: object): Promise<void> {
  const response = await fetch(`${harness.lab.origin}/api/${harness.scenarioId}/${operation}`, {
    method: "POST",
    headers: { authorization: `Bearer ${harness.lab.runToken}`, "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  expect(response.ok, `${operation} answered ${response.status}`).toBe(true);
}

/**
 * Holds the support card's timer -- the page's one timer of `delayMs` whose
 * callback names the card -- and starts it, on the page's own clock, `afterMs`
 * after the first press of Add to cart. Counts every press of Add to cart.
 */
function holdCardUntilFirstPress({ delayMs, afterMs }: { delayMs: number; afterMs: number }): void {
  const page = window as unknown as { __atcPresses: number; __cardOpenedAfterPress: boolean };
  const realTimeout = window.setTimeout.bind(window);
  let held: (() => void) | undefined;
  page.__atcPresses = 0;
  page.__cardOpenedAfterPress = false;
  window.setTimeout = ((handler: TimerHandler, timeout?: number, ...rest: unknown[]) => {
    if (!held && timeout === delayMs && typeof handler === "function" && String(handler).includes("chatCard")) {
      held = handler as () => void;
      return 0;
    }
    return realTimeout(handler, timeout, ...rest);
  }) as typeof window.setTimeout;
  document.addEventListener("click", (event) => {
    if (!(event.target instanceof Element) || !event.target.closest('[data-testid="atc"]')) return;
    page.__atcPresses += 1;
    if (page.__atcPresses !== 1 || !held) return;
    const open = held;
    realTimeout(() => {
      open();
      page.__cardOpenedAfterPress = true;
    }, afterMs);
  }, true);
}

test("bigbox: Add to cart the page only woke on, covered by the support card during the wait, is pressed once more after the card is closed, and adds one", async ({ openHarness, page }) => {
  test.setTimeout(60_000);
  const harness = await openHarness("bigbox-retail");
  const state = async (): Promise<BigboxState> => (await harness.finalState()).state as unknown as BigboxState;
  await apply(harness, "consent", { choice: "reject" });
  await apply(harness, "dismiss-promo", {});
  await page.addInitScript(holdCardUntilFirstPress, { delayMs: CHAT_CARD_DELAY_MS, afterMs: CARD_AFTER_PRESS_MS });
  await page.goto(new URL(PRODUCT, harness.lab.origin).href);
  // The buy box comes alive once availability is checked.
  await expect(page.getByText(/Checking availability/u)).toHaveCount(0, { timeout: 5_000 });
  expect((await state()).cart.filter((line) => line.productId === PRODUCT_ID)).toEqual([]);

  const add = await harness.runAction({ commandId: "add", actionType: "web.dom.click", selector: '[data-testid="atc"]', timeoutMs: 15_000 });
  expect(add.status, actualOf(add)).toBe("succeeded");
  expect(await page.evaluate(() => (window as unknown as { __cardOpenedAfterPress: boolean }).__cardOpenedAfterPress), "the card opened inside the first press's window").toBe(true);
  expect(actualOf(add)).toMatch(/a layer then covered the control, so the layer was closed and it was pressed once more;/u);
  expect(await page.evaluate(() => (window as unknown as { __atcPresses: number }).__atcPresses), "the waking press and the press made once more, never a third").toBe(2);
  await expect.poll(async () => (await state()).cart.filter((line) => line.productId === PRODUCT_ID).map((line) => line.qty), { timeout: 5_000 }).toEqual([1]);
  await expect(page.getByText("✓ Added to cart")).toBeVisible();
});
