// What a press on a realistic page was answered with, through the real
// content-script bundle on the real scenario pages (T2 harness: no background
// worker, no Core, no model). Each row is a step of a lane-A live task that the
// product used to get wrong, and the oracle is the Scenario Lab's own server
// state, never the reply alone:
//
// - bigbox: the store chip opens its chooser inside a shadow root. The
//   ignored-press watch could not see into it, read the press as ignored and
//   pressed again, which shut the chooser (t174-w33).
// - crossborder: the store coupon's first claim of a visit is refused with
//   "Network busy, please try again" beside its button and collects nothing; it
//   was reported a success (t174-w32). And the support chat's pill over Add to
//   cart has "Minimize chat" as its only way out, which was no way out (D4).
// - everything-store: the same for its chat over the buy box (t174-w34 F3); and
//   a press made before the buy box comes alive is ignored twice, and was
//   reported done with nothing in the cart (F4).
//
// Selectors are written by hand: this proves the verbs and the defence on these
// pages, not how a model addresses the controls.

import type { Page } from "@playwright/test";
import type { BrowserActionResult } from "../../../../../src/shared/protocol.js";
import { marketClasses } from "../../../../../../scenario-lab/src/scenarios/crossborder-marketplace/styles/index.js";
import { STORE_PATHS, TIDEWELL_KETTLES } from "../../../../../../scenario-lab/src/scenarios/everything-store/catalog/index.js";
import { STORE_TIMINGS } from "../../../../../../scenario-lab/src/scenarios/everything-store/client/index.js";
import { expect, test } from "../../../index.js";
import type { ContentHarness } from "../../../index.js";

const actualOf = (reply: BrowserActionResult): string => (reply.validation.status === "none" ? "" : reply.validation.actual);

/** An exact CSS path, by child position from the body, to the first element `find` returns. */
async function pathTo(page: Page, find: string): Promise<string> {
  const path = await page.evaluate((source) => {
    const element = (new Function(`return (${source})`))() as Element | null;
    if (!element) return null;
    const parts: string[] = [];
    for (let node: Element | null = element; node && node !== document.body; node = node.parentElement) {
      parts.unshift(`${node.tagName.toLowerCase()}:nth-child(${Array.from(node.parentElement!.children).indexOf(node) + 1})`);
    }
    return `body > ${parts.join(" > ")}`;
  }, find);
  if (!path) throw new Error(`nothing found by ${find}`);
  return path;
}

// ---- crossborder-marketplace -------------------------------------------------

const market = marketClasses(7342, "baseline");
const OFFICIAL = "1005008123450";

type MarketState = {
  cart: Array<{ listingId: string; choice: { color: string; spec: string; origin: string }; quantity: number }>;
  coupons: { stores: string[] };
};

/** The chip in the option group whose label starts with `group`, whose title or text is `value`. */
function marketOption(group: string, value: string): string {
  return `Array.from(document.querySelectorAll('.${market.skuGroup}')).filter((g) => (g.querySelector('.${market.skuLabel}')?.textContent ?? '').startsWith(${JSON.stringify(group)}))
    .flatMap((g) => Array.from(g.querySelector('.${market.swatches}')?.children ?? [])).find((o) => (o.getAttribute('title') ?? o.textContent ?? '').trim() === ${JSON.stringify(value)}) ?? null`;
}

test("crossborder: the coupon's busy first claim is refused, not collected; the chat pill over Add to cart is minimised; the cart is the goal's", async ({ openHarness, page }) => {
  test.setTimeout(120_000);
  const harness = await openHarness("crossborder-marketplace");
  const state = async (): Promise<MarketState> => (await harness.finalState()).state as unknown as MarketState;
  await page.goto(new URL(`/scenarios/crossborder-marketplace/item/${OFFICIAL}`, harness.lab.origin).href);
  // Every interruption a first visit raises is up: the chat pill, the welcome coupons, the notification prompt, consent.
  await expect(page.locator(`.${market.chatPill}`)).toBeVisible({ timeout: 6_000 });
  await expect(page.getByText("Never miss a price drop", { exact: true })).toBeVisible({ timeout: 8_000 });

  for (const [group, value] of [["Specification", "7-in-1"], ["Ships From", "Spain"]] as const) {
    const chosen = await harness.runAction({ commandId: `choose-${value}`, actionType: "web.dom.click", selector: await pathTo(page, marketOption(group, value)) });
    expect(chosen.status, `choose ${value}: ${actualOf(chosen)}`).toBe("succeeded");
  }
  const quantity = await harness.runAction({ commandId: "quantity", actionType: "web.dom.type", selector: `.${market.qtyInput}`, text: "3" });
  expect(quantity.status).toBe("succeeded");

  // The widget answers inside its own shadow root, "…" while it asks the server, then the busy line.
  const claim1 = await harness.runAction({ commandId: "coupon-1", actionType: "web.dom.click", selector: ".b" });
  expect(claim1.failure?.code, actualOf(claim1)).toBe("web.action.rate_limited");
  expect(claim1.failure?.retryable).toBe(true);
  expect(actualOf(claim1)).toMatch(/busy and could not carry the press out/u);
  expect((await state()).coupons.stores, "the refused claim collected nothing").toEqual([]);
  const claim2 = await harness.runAction({ commandId: "coupon-2", actionType: "web.dom.click", selector: ".b" });
  expect(claim2.status, actualOf(claim2)).toBe("succeeded");
  expect(actualOf(claim2), "a press answered inside a shadow root is never pressed again").not.toMatch(/pressed once more/u);
  await expect.poll(async () => (await state()).coupons.stores).toEqual(["voltbay-official"]);

  // The pill sits over Add to cart; its "Minimize chat" glyph is the defence's way out.
  const add = await harness.runAction({ commandId: "add", actionType: "web.dom.click", selector: `[data-testid="add-to-cart"]` });
  expect(add.status, actualOf(add)).toBe("succeeded");
  await expect.poll(async () => (await state()).cart, { timeout: 5_000 }).toEqual([
    { id: "line-1", listingId: OFFICIAL, choice: { color: "Space Grey", spec: "7-in-1", origin: "Spain" }, quantity: 3 }
  ]);
});

// t174 F40 (`run-muqk4u32-0b36e58f`): with the colour un-chosen, Add to cart
// writes "Please select a Color." under the options -- outside the buy bar the
// button sits in -- and adds nothing. The click read the silence inside the bar
// as an ignored press, pressed again and reported success, in exploration, the
// dry run and playback alike.
test("crossborder: Add to cart with the colour un-chosen is refused by the page, pressed once, and adds nothing; chosen again, it adds", async ({ openHarness, page }) => {
  test.setTimeout(120_000);
  const harness = await openHarness("crossborder-marketplace");
  const state = async (): Promise<MarketState> => (await harness.finalState()).state as unknown as MarketState;
  await page.goto(new URL(`/scenarios/crossborder-marketplace/item/${OFFICIAL}`, harness.lab.origin).href);
  // As in the run: the chat pill over Add to cart, the welcome coupons over the page.
  await expect(page.locator(`.${market.chatPill}`)).toBeVisible({ timeout: 6_000 });
  await expect(page.getByText("Never miss a price drop", { exact: true })).toBeVisible({ timeout: 8_000 });

  // Space Grey is the item page's own choice, so pressing it un-chooses it.
  const spaceGrey = await pathTo(page, marketOption("Color", "Space Grey"));
  const unchosen = await harness.runAction({ commandId: "unchoose", actionType: "web.dom.click", selector: spaceGrey });
  expect(unchosen.status, actualOf(unchosen)).toBe("succeeded");

  const refused = await harness.runAction({ commandId: "add-refused", actionType: "web.dom.click", selector: `[data-testid="add-to-cart"]` });
  expect(refused.status, actualOf(refused)).toBe("failed");
  expect(refused.failure?.code, actualOf(refused)).toBe("web.action.refused_by_page");
  expect(refused.failure?.retryable).toBe(false);
  expect(refused.failure?.effect).toBe("unacted");
  expect(actualOf(refused), "a refused press is never pressed once more").not.toMatch(/pressed once more/u);
  expect(`${refused.failure?.expected} ${refused.failure?.actual} ${refused.message ?? ""}`, "the result says what was concluded, never the page's words").not.toMatch(/select a color/iu);
  await expect(page.locator(`.${market.errorTip}`)).toHaveText("Please select a Color.");
  await page.waitForTimeout(1_500);
  expect((await state()).cart, "the refused press added nothing").toEqual([]);
  await expect(page.locator(`.${market.cartBadge}`)).toHaveText("0");

  const chosen = await harness.runAction({ commandId: "choose", actionType: "web.dom.click", selector: spaceGrey });
  expect(chosen.status, actualOf(chosen)).toBe("succeeded");
  const added = await harness.runAction({ commandId: "add", actionType: "web.dom.click", selector: `[data-testid="add-to-cart"]` });
  expect(added.status, actualOf(added)).toBe("succeeded");
  await expect.poll(async () => (await state()).cart.map((line) => `${line.listingId} ${line.choice.color} x${line.quantity}`), { timeout: 5_000 }).toEqual([`${OFFICIAL} Space Grey x1`]);
});

// ---- bigbox-retail -----------------------------------------------------------

type BigboxState = { storeId: string; promo: string };

/** The first class of an element inside an open shadow root, so a selector misses the light document and resolves in the root. */
async function shadowClass(page: Page, host: string, inner: string): Promise<string> {
  return await page.evaluate(([hostSelector, innerSelector]) => {
    const element = document.querySelector(hostSelector)?.shadowRoot?.querySelector(innerSelector);
    return element ? [...element.classList][0] ?? "" : "";
  }, [host, inner] as const);
}

const chooserHidden = (page: Page): Promise<boolean | null> => page.evaluate(() => {
  const list = document.querySelector("vr-fulfillment-picker")?.shadowRoot?.querySelector("ul");
  return (list?.closest("div") as HTMLElement | null)?.hidden ?? null;
});

test("bigbox: the store chip, answered inside its picker's shadow root, is pressed once and its chooser stays open to pick the store", async ({ openHarness, page }) => {
  test.setTimeout(60_000);
  const harness = await openHarness("bigbox-retail");
  const state = async (): Promise<BigboxState> => (await harness.finalState()).state as unknown as BigboxState;
  await page.getByRole("button", { name: "Accept all" }).click();
  await page.locator("a", { hasText: "No thanks" }).click({ timeout: 8_000 });
  await expect.poll(async () => (await state()).promo).toBe("dismissed");
  const storeBefore = (await state()).storeId;
  expect(await chooserHidden(page)).toBe(true);

  const chip = await shadowClass(page, "vr-fulfillment-picker", "button");
  const press = await harness.runAction({ commandId: "chip", actionType: "web.dom.click", selector: `button.${chip}`, timeoutMs: 10_000 });
  expect(press.status, actualOf(press)).toBe("succeeded");
  expect(actualOf(press)).not.toMatch(/pressed once more/u);
  expect(await chooserHidden(page), "the chooser the press opened is still open").toBe(false);

  // Its third card's "Set as my store" saves and reloads the page, so the reply may be lost to the reload.
  const setClass = await shadowClass(page, "vr-fulfillment-picker", "li button");
  await harness.runAction({ commandId: "set-store", actionType: "web.dom.click", selector: `li:nth-child(3) > button.${setClass}`, timeoutMs: 10_000 }).catch(() => undefined);
  await expect.poll(async () => (await state()).storeId, { timeout: 8_000 }).not.toBe(storeBefore);
});

// ---- everything-store --------------------------------------------------------

const SAGE = TIDEWELL_KETTLES.find((child) => child.variant?.colour === "Sage Green" && child.variant.capacity === "1.7 L")!;
const ADD_TO_CART = "[data-buy-box] > button:nth-of-type(1)";

type StoreState = { cart: Array<{ sku: string; quantity: number }>; nudges: Record<string, string> };

/** One store operation, as the page's own scripts send it. */
async function storeCall(harness: ContentHarness, operation: string, payload: Record<string, unknown>): Promise<void> {
  const response = await fetch(`${harness.lab.origin}/api/everything-store/${operation}`, {
    method: "POST",
    headers: { authorization: `Bearer ${harness.lab.runToken}`, "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  expect(response.ok, `the store accepted ${operation}`).toBe(true);
}

/** The first-visit nudges these rows do not probe, answered through the store so they stay gone; the chat is left alone. */
async function quietStore(harness: ContentHarness): Promise<void> {
  await storeCall(harness, "dismiss-nudge", { nudge: "notifications" });
  await storeCall(harness, "dismiss-nudge", { nudge: "app-banner" });
  await storeCall(harness, "consent", { choice: "decline" });
}

test("everything-store: a press before the buy box is live is ignored twice and fails as not observed; the chat over it is minimised and the add lands", async ({ openHarness, page }) => {
  test.setTimeout(90_000);
  const harness = await openHarness("everything-store");
  const state = async (): Promise<StoreState> => (await harness.finalState()).state as unknown as StoreState;
  await quietStore(harness);
  const productUrl = new URL(STORE_PATHS.product(SAGE), harness.lab.origin).href;
  const linesOf = (current: StoreState): string[] => current.cart.map((line) => `${line.sku}x${line.quantity}`);

  // The buy box does nothing until `productHydrate` (1.2 s) after the load.
  await page.goto(productUrl, { waitUntil: "load" });
  const cartBefore = linesOf(await state());
  const early = await harness.runAction({ commandId: "early-add", actionType: "web.dom.click", selector: ADD_TO_CART });
  expect(early.status, actualOf(early)).toBe("failed");
  expect(early.failure?.code).toBe("web.validation.output_not_observed");
  expect(actualOf(early)).toMatch(/ignored that press too/u);
  await page.waitForTimeout(1_500);
  expect(linesOf(await state()), "nothing was added, as the result says").toEqual(cartBefore);

  // The chat opens itself over the buy box; "Minimize chat" is its way out.
  await page.goto(productUrl, { waitUntil: "load" });
  await page.waitForTimeout(STORE_TIMINGS.chatAutoOpen + 800);
  const add = await harness.runAction({ commandId: "add", actionType: "web.dom.click", selector: ADD_TO_CART });
  expect(add.status, actualOf(add)).toBe("succeeded");
  await expect.poll(async () => linesOf(await state()).length, { timeout: 5_000 }).toBeGreaterThan(cartBefore.length);
  expect(linesOf(await state())).toContain(`${SAGE.sku}x1`);
});
