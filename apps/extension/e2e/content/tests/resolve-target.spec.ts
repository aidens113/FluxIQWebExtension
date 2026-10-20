// The four ways the content script resolves an action's target -- a CSS
// selector, a viewport point (`coordinates`), the centre of the visual
// target's bounds, and the element fingerprint in `options.element` -- tried
// in that order, the first hit winning, with the focused element as the
// fallback when no strategy was supplied at all. What these rows pin is the
// strategy order and each strategy's reach: which signals a strategy reads,
// which it does not, and the one failure that names every miss in order.
//
// They also still pin one behaviour that is a limitation rather than a
// decision: a point resolves only inside the viewport, because `coordinates`
// are viewport-relative and nothing de-scrolls them.
//
// Phase 1.3 replaced the rest, and three rows that pinned the old resolver were
// deleted here rather than rewritten, because `identity-resolution.spec.ts`
// already proves what replaced them:
//
// - an ambiguous selector, and an ambiguous fingerprint text, used to take the
//   first match in document order. Both now fail TARGET_AMBIGUOUS naming what
//   tied, which "an ambiguous selector fails TARGET_AMBIGUOUS and names what
//   tied" and "an ambiguous fingerprint text fails TARGET_AMBIGUOUS; a unique
//   test id still resolves" assert -- the second of those keeps the exact
//   test-id half of the row deleted from here.
// - stale viewport bounds used to win over document bounds, which is how a
//   replay clicked a sticky header. "document bounds win over the viewport
//   bounds recorded beside them" and "stale viewport bounds no longer click
//   whatever scrolled into their place" assert the reversal.
//
// t730 moved the rows off two synthetic pages onto realistic ones: two folded
// price-list sections on the company website's services page stand for two
// nearby controls whose press is visible (`aria-expanded`), the newsletter
// page's labelled email field for a name only a <label> carries, the job
// board's two search fields for the focused-element fallback, and the bigbox
// product page's "See more reviews", below the fold, for reach beyond the
// viewport. The sites' interruptions are answered first through their own
// `/api` operations, as a returning visitor has them. The sites give these
// controls no test ids, so each row reads the selector the content script
// itself gives a control from a capture of the page.

import type { Page } from "@playwright/test";
import { expect, test } from "../index.js";
import type { ContentHarness } from "../index.js";

type Rect = { x: number; y: number; width: number; height: number };

function centre(rect: Rect): { x: number; y: number } {
  return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
}

/** A visual target as the background worker sends it; the content script reads only its bounds. */
function visualTarget(bounds: { bounds?: Rect; documentBounds?: Rect }) {
  return { namespace: "web" as const, statePath: "harness.target", ...bounds };
}

async function viewportRect(page: Page, selector: string): Promise<Rect> {
  const box = await page.locator(selector).boundingBox();
  if (!box) throw new Error(`${selector} has no layout box.`);
  return box;
}

async function documentRect(page: Page, selector: string): Promise<Rect> {
  return page.locator(selector).evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { x: rect.x + window.scrollX, y: rect.y + window.scrollY, width: rect.width, height: rect.height };
  });
}

function viewportHeight(page: Page): number {
  const size = page.viewportSize();
  if (!size) throw new Error("The page has no fixed viewport.");
  return size.height;
}

/** Sends one of the site's own state operations, as its page script does. */
async function mutate(harness: ContentHarness, operation: string, payload: Record<string, unknown> = {}): Promise<void> {
  const response = await fetch(`${harness.lab.origin}/api/${harness.scenarioId}/${operation}`, {
    method: "POST",
    headers: { authorization: `Bearer ${harness.lab.runToken}`, "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error(`${harness.scenarioId} answered ${response.status} to ${operation}.`);
}

/** Opens a page of the scenario other than its start page, with the content script already installed. */
async function open(harness: ContentHarness, path: string): Promise<void> {
  await harness.page.goto(new URL(`/scenarios/${harness.scenarioId}/${path}`, harness.lab.origin).href);
}

/** The selector the content script gives the first element of `tagName` whose text starts with `text`. */
async function selectorOf(harness: ContentHarness, tagName: string, text: string): Promise<string> {
  const element = (await harness.capture()).interactiveElements.find((candidate) => candidate.tagName === tagName && (candidate.text ?? "").startsWith(text));
  if (!element) throw new Error(`The snapshot of ${harness.scenarioId} carried no ${tagName} reading "${text}".`);
  return element.selector;
}

test.describe("on the company website's price list", () => {
  type PriceList = { harness: ContentHarness; primary: string; secondary: string };

  /**
   * The services page with its price list loaded and two folded sections in
   * view: "Boiler installation" is the primary control and "Repairs &
   * call-outs", just above it, the secondary.
   */
  async function priceList(openHarness: (scenarioId: string) => Promise<ContentHarness>, page: Page): Promise<PriceList> {
    const harness = await openHarness("company-website");
    await mutate(harness, "set-consent", { choice: "all" });
    await mutate(harness, "dismiss-newsletter");
    await mutate(harness, "dismiss-chat-greeting");
    await open(harness, "services");
    await expect(page.getByRole("button", { name: /^Boiler installation/u })).toHaveAttribute("aria-expanded", "false");
    await page.getByRole("button", { name: /^Boiler installation/u }).scrollIntoViewIfNeeded();
    const primary = await selectorOf(harness, "button", "Boiler installation");
    const secondary = await selectorOf(harness, "button", "Repairs & call-outs");
    await expect(page.locator(secondary)).toHaveAttribute("aria-expanded", "false");
    return { harness, primary, secondary };
  }

  test("coordinates: the element at a viewport point", async ({ openHarness, page }) => {
    const { harness, primary, secondary } = await priceList(openHarness, page);
    const reply = await harness.runAction({ commandId: "coordinates", actionType: "web.dom.click", coordinates: centre(await viewportRect(page, secondary)) });
    expect(reply).toMatchObject({ status: "succeeded", element: { selector: secondary } });
    await expect(page.locator(secondary)).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator(primary)).toHaveAttribute("aria-expanded", "false");
  });

  test("visual target: the element under the centre of its viewport bounds", async ({ openHarness, page }) => {
    const { harness, primary, secondary } = await priceList(openHarness, page);
    const bounds = await viewportRect(page, secondary);
    const reply = await harness.runAction({ commandId: "visual-bounds", actionType: "web.dom.click", visualTarget: visualTarget({ bounds }) });
    expect(reply).toMatchObject({ status: "succeeded", element: { selector: secondary }, visualTarget: { bounds } });
    await expect(page.locator(secondary)).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator(primary)).toHaveAttribute("aria-expanded", "false");
  });

  test("order: a selector hit wins over coordinates, and a selector miss falls through to them", async ({ openHarness, page }) => {
    const { harness, primary, secondary } = await priceList(openHarness, page);
    const secondaryPoint = centre(await viewportRect(page, secondary));
    const hit = await harness.runAction({ commandId: "order-hit", actionType: "web.dom.click", selector: primary, coordinates: secondaryPoint });
    expect(hit).toMatchObject({ status: "succeeded", element: { selector: primary } });
    await expect(page.locator(primary)).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator(secondary)).toHaveAttribute("aria-expanded", "false");
    // Opening the primary section unfolds its table below the secondary, which stays where it was.
    const stillAt = centre(await viewportRect(page, secondary));
    expect(stillAt).toEqual(secondaryPoint);
    const miss = await harness.runAction({ commandId: "order-miss", actionType: "web.dom.click", selector: "[data-testid=\"missing\"]", coordinates: secondaryPoint });
    expect(miss).toMatchObject({ status: "succeeded", message: "Element clicked.", element: { selector: secondary } });
    await expect(page.locator(secondary)).toHaveAttribute("aria-expanded", "true");
  });
});

test("company-website: fingerprint: a name only a <label> carries resolves nothing", async ({ openHarness, page }) => {
  const harness = await openHarness("company-website");
  await mutate(harness, "set-consent", { choice: "all" });
  await mutate(harness, "dismiss-newsletter");
  await mutate(harness, "dismiss-chat-greeting");
  await open(harness, "newsletter");
  // The field is named "Email address" only by its <label>; its own name is `email`.
  const field = page.getByLabel("Email address");
  await expect(field).toHaveAttribute("name", "email");
  expect(await field.getAttribute("aria-label")).toBeNull();
  const reply = await harness.runAction({
    commandId: "fingerprint-label",
    actionType: "web.dom.type",
    text: "ada@example.test",
    options: { element: { tagName: "input", name: "Email address" } }
  });
  // The page has open shadow roots (its consent banner and chat widget), so the fingerprint is looked for in them too, and both misses are named.
  expect(reply).toMatchObject({ status: "failed", message: "No target resolved from element fingerprint, element fingerprint in the page's open shadow roots." });
  await expect(field).toHaveValue("");
});

test.describe("on the job board's search form", () => {
  test("no strategy supplied: the focused element", async ({ openHarness, page }) => {
    const harness = await openHarness("job-board");
    await mutate(harness, "consent", { choice: "accepted" });
    await page.reload();
    await expect(page.locator("rf-consent")).toHaveCount(0);
    const whereSelector = (await harness.capture()).interactiveElements.find((element) => element.tagName === "input" && element.accessibleName === "Where")?.selector;
    expect(whereSelector).toBeDefined();
    await page.getByLabel("Where").focus();
    const reply = await harness.runAction({ commandId: "active-element", actionType: "web.dom.type", text: "Bristol" });
    expect(reply).toMatchObject({ status: "succeeded", element: { selector: whereSelector } });
    await expect(page.getByLabel("Where")).toHaveValue("Bristol");
    await expect(page.getByLabel("What")).toHaveValue("");
  });

  test("every strategy misses: one failure naming each miss in order", async ({ openHarness }) => {
    const harness = await openHarness("job-board");
    const reply = await harness.runAction({
      commandId: "all-miss",
      actionType: "web.dom.click",
      selector: "[data-testid=\"missing\"]",
      coordinates: { x: -10, y: -10 },
      visualTarget: visualTarget({ bounds: { x: -100, y: -100, width: 10, height: 10 } }),
      options: { element: { attributes: { "data-testid": "missing" } } }
    });
    expect(reply).toMatchObject({
      status: "failed",
      // The board has open shadow roots (its consent wall and chat widget), so every strategy is tried again inside them, in the same order.
      message: "No target resolved from selector [data-testid=\"missing\"], coordinates -10,-10, visual target -95,-95, element fingerprint, "
        + "selector [data-testid=\"missing\"] in the page's open shadow roots, coordinates -10,-10 in the page's open shadow roots, "
        + "visual target -95,-95 in the page's open shadow roots, element fingerprint in the page's open shadow roots."
    });
  });
});

test.describe("on the bigbox product page", () => {
  type ProductPage = { harness: ContentHarness; target: string; reviews: ReturnType<Page["locator"]> };

  /** The paper towels page with its first three reviews in, and "See more reviews" below the fold. */
  async function productPage(openHarness: (scenarioId: string) => Promise<ContentHarness>, page: Page): Promise<ProductPage> {
    const harness = await openHarness("bigbox-retail");
    await mutate(harness, "consent", { choice: "accept" });
    await mutate(harness, "dismiss-promo");
    await open(harness, "ip/valueridge-essentials-select-a-size-paper-towels/418830127");
    const reviews = page.locator("section", { has: page.getByRole("heading", { name: "Customer reviews" }) }).locator("article");
    await expect(reviews).toHaveCount(3);
    const target = await selectorOf(harness, "button", "See more reviews");
    expect((await documentRect(page, target)).y).toBeGreaterThan(viewportHeight(page));
    return { harness, target, reviews };
  }

  test("selector: resolves below the fold, and click scrolls the target into view", async ({ openHarness, page }) => {
    const { harness, target, reviews } = await productPage(openHarness, page);
    const reply = await harness.runAction({ commandId: "selector-below-fold", actionType: "web.dom.click", selector: target });
    expect(reply).toMatchObject({ status: "succeeded", element: { selector: target } });
    expect(reply.snapshot?.viewport.scrollY).toBeGreaterThan(0);
    await expect(reviews).toHaveCount(6);
  });

  test("coordinates: a point below the fold resolves nothing, because points are viewport-relative", async ({ openHarness, page }) => {
    const { harness, target, reviews } = await productPage(openHarness, page);
    const point = centre(await documentRect(page, target));
    expect(point.y).toBeGreaterThan(viewportHeight(page));
    const reply = await harness.runAction({ commandId: "coordinates-below-fold", actionType: "web.dom.click", coordinates: point });
    expect(reply).toMatchObject({ status: "failed", message: `No target resolved from coordinates ${point.x},${point.y}, coordinates ${point.x},${point.y} in the page's open shadow roots.` });
    await page.waitForTimeout(800);
    await expect(reviews).toHaveCount(3);
  });

  test("visual target: document bounds are de-scrolled, so they resolve only once the target is in view", async ({ openHarness, page }) => {
    const { harness, target, reviews } = await productPage(openHarness, page);
    const documentBounds = await documentRect(page, target);
    const click = () => harness.runAction({ commandId: "document-bounds", actionType: "web.dom.click", visualTarget: visualTarget({ documentBounds }) });
    const point = centre(documentBounds);
    expect(await click()).toMatchObject({ status: "failed", message: `No target resolved from visual target ${point.x},${point.y}, visual target ${point.x},${point.y} in the page's open shadow roots.` });
    await page.evaluate((top) => window.scrollTo(0, top), Math.round(documentBounds.y - 200));
    expect(await click()).toMatchObject({ status: "succeeded", element: { selector: target } });
    await expect(reviews).toHaveCount(6);
  });

  test("fingerprint: resolves below the fold, and click scrolls the target into view", async ({ openHarness, page }) => {
    const { harness, target, reviews } = await productPage(openHarness, page);
    const reply = await harness.runAction({
      commandId: "fingerprint-below-fold",
      actionType: "web.dom.click",
      options: { element: { tagName: "button", visibleText: "See more reviews" } }
    });
    expect(reply).toMatchObject({ status: "succeeded", element: { selector: target } });
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    await expect(reviews).toHaveCount(6);
  });
});
