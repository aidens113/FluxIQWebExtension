// The four ways the content script resolves an action's target -- a CSS
// selector, a viewport point (`coordinates`), the centre of the visual
// target's bounds, and the element fingerprint in `options.element` -- tried
// in that order, the first hit winning, with the focused element as the
// fallback when no strategy was supplied at all. These specs pin today's
// behaviour on purpose, known defects included: an ambiguous target silently
// takes the first match in document order, points resolve only inside the
// viewport, and stale viewport bounds win over document bounds. Phase 1.3
// changes resolution and must change these assertions with it.

import type { Page } from "@playwright/test";
import { expect, test } from "../index.js";

type Rect = { x: number; y: number; width: number; height: number };

const PRIMARY = '[data-testid="choice-primary"]';
const SECONDARY = '[data-testid="choice-secondary"]';
const BELOW_FOLD = '[data-testid="below-fold-target"]';

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

test.describe("on ambiguous-targets", () => {
  test("selector: an ambiguous selector takes the first match in document order", async ({ openHarness, page }) => {
    const harness = await openHarness("ambiguous-targets");
    await expect(page.locator("button")).toHaveCount(2);
    const reply = await harness.runAction({ commandId: "selector-ambiguous", actionType: "web.dom.click", selector: "button" });
    expect(reply).toMatchObject({ status: "succeeded", element: { selector: PRIMARY } });
    await expect(page.getByTestId("result")).toHaveText("primary");
    expect((await harness.finalState()).state).toEqual({ selected: "primary" });
  });

  test("coordinates: the element at a viewport point", async ({ openHarness, page }) => {
    const harness = await openHarness("ambiguous-targets");
    const reply = await harness.runAction({ commandId: "coordinates", actionType: "web.dom.click", coordinates: centre(await viewportRect(page, SECONDARY)) });
    expect(reply).toMatchObject({ status: "succeeded", element: { selector: SECONDARY } });
    await expect(page.getByTestId("result")).toHaveText("secondary");
  });

  test("visual target: the element under the centre of its viewport bounds", async ({ openHarness, page }) => {
    const harness = await openHarness("ambiguous-targets");
    const bounds = await viewportRect(page, SECONDARY);
    const reply = await harness.runAction({ commandId: "visual-bounds", actionType: "web.dom.click", visualTarget: visualTarget({ bounds }) });
    expect(reply).toMatchObject({ status: "succeeded", element: { selector: SECONDARY }, visualTarget: { bounds } });
    await expect(page.getByTestId("result")).toHaveText("secondary");
  });

  test("fingerprint: matching text takes the first match; a test id is exact", async ({ openHarness, page }) => {
    const harness = await openHarness("ambiguous-targets");
    const byText = await harness.runAction({
      commandId: "fingerprint-text",
      actionType: "web.dom.click",
      options: { element: { tagName: "button", visibleText: "Continue" } }
    });
    expect(byText).toMatchObject({ status: "succeeded", element: { selector: PRIMARY } });
    await expect(page.getByTestId("result")).toHaveText("primary");
    const byTestId = await harness.runAction({
      commandId: "fingerprint-testid",
      actionType: "web.dom.click",
      options: { element: { attributes: { "data-testid": "choice-secondary" } } }
    });
    expect(byTestId).toMatchObject({ status: "succeeded", element: { selector: SECONDARY } });
    await expect(page.getByTestId("result")).toHaveText("secondary");
  });

  test("fingerprint: a name only a <label> carries resolves nothing", async ({ openHarness, page }) => {
    const harness = await openHarness("ambiguous-targets");
    await expect(page.getByLabel("Email")).toHaveCount(2);
    const reply = await harness.runAction({
      commandId: "fingerprint-label",
      actionType: "web.dom.type",
      text: "ada@example.test",
      options: { element: { tagName: "input", name: "Email" } }
    });
    expect(reply).toMatchObject({ status: "failed", message: "No target resolved from element fingerprint." });
    await expect(page.getByTestId("email-primary")).toHaveValue("");
    await expect(page.getByTestId("email-secondary")).toHaveValue("");
  });

  test("order: a selector hit wins over coordinates, and a selector miss falls through to them", async ({ openHarness, page }) => {
    const harness = await openHarness("ambiguous-targets");
    const secondaryPoint = centre(await viewportRect(page, SECONDARY));
    const hit = await harness.runAction({ commandId: "order-hit", actionType: "web.dom.click", selector: PRIMARY, coordinates: secondaryPoint });
    expect(hit).toMatchObject({ status: "succeeded", element: { selector: PRIMARY } });
    await expect(page.getByTestId("result")).toHaveText("primary");
    const miss = await harness.runAction({ commandId: "order-miss", actionType: "web.dom.click", selector: '[data-testid="missing"]', coordinates: secondaryPoint });
    expect(miss).toMatchObject({ status: "succeeded", message: "Element clicked.", element: { selector: SECONDARY } });
    await expect(page.getByTestId("result")).toHaveText("secondary");
  });

  test("no strategy supplied: the focused element", async ({ openHarness, page }) => {
    const harness = await openHarness("ambiguous-targets");
    await page.getByTestId("email-secondary").focus();
    const reply = await harness.runAction({ commandId: "active-element", actionType: "web.dom.type", text: "ada@example.test" });
    expect(reply).toMatchObject({ status: "succeeded", element: { selector: '[data-testid="email-secondary"]' } });
    await expect(page.getByTestId("email-secondary")).toHaveValue("ada@example.test");
    await expect(page.getByTestId("email-primary")).toHaveValue("");
  });

  test("every strategy misses: one failure naming each miss in order", async ({ openHarness }) => {
    const harness = await openHarness("ambiguous-targets");
    const reply = await harness.runAction({
      commandId: "all-miss",
      actionType: "web.dom.click",
      selector: '[data-testid="missing"]',
      coordinates: { x: -10, y: -10 },
      visualTarget: visualTarget({ bounds: { x: -100, y: -100, width: 10, height: 10 } }),
      options: { element: { attributes: { "data-testid": "missing" } } }
    });
    expect(reply).toMatchObject({
      status: "failed",
      message: 'No target resolved from selector [data-testid="missing"], coordinates -10,-10, visual target -95,-95, element fingerprint.'
    });
  });
});

test.describe("on long-document", () => {
  test("selector: resolves below the fold, and click scrolls the target into view", async ({ openHarness, page }) => {
    const harness = await openHarness("long-document");
    expect((await documentRect(page, BELOW_FOLD)).y).toBeGreaterThan(viewportHeight(page));
    const reply = await harness.runAction({ commandId: "selector-below-fold", actionType: "web.dom.click", selector: BELOW_FOLD });
    expect(reply).toMatchObject({ status: "succeeded", element: { selector: BELOW_FOLD } });
    expect(reply.snapshot?.viewport.scrollY).toBeGreaterThan(0);
    await expect(page.getByTestId("result")).toHaveText("Reached");
    expect((await harness.finalState()).state).toMatchObject({ reached: true });
  });

  test("coordinates: a point below the fold resolves nothing, because points are viewport-relative", async ({ openHarness, page }) => {
    const harness = await openHarness("long-document");
    const point = centre(await documentRect(page, BELOW_FOLD));
    expect(point.y).toBeGreaterThan(viewportHeight(page));
    const reply = await harness.runAction({ commandId: "coordinates-below-fold", actionType: "web.dom.click", coordinates: point });
    expect(reply).toMatchObject({ status: "failed", message: `No target resolved from coordinates ${point.x},${point.y}.` });
    await expect(page.getByTestId("result")).toHaveText("Pending");
  });

  test("visual target: document bounds are de-scrolled, so they resolve only once the target is in view", async ({ openHarness, page }) => {
    const harness = await openHarness("long-document");
    const documentBounds = await documentRect(page, BELOW_FOLD);
    const click = () => harness.runAction({ commandId: "document-bounds", actionType: "web.dom.click", visualTarget: visualTarget({ documentBounds }) });
    const point = centre(documentBounds);
    expect(await click()).toMatchObject({ status: "failed", message: `No target resolved from visual target ${point.x},${point.y}.` });
    await page.evaluate((top) => window.scrollTo(0, top), Math.round(documentBounds.y - 200));
    expect(await click()).toMatchObject({ status: "succeeded", element: { selector: BELOW_FOLD } });
    await expect(page.getByTestId("result")).toHaveText("Reached");
  });

  test("visual target: viewport bounds win over document bounds, even when stale", async ({ openHarness, page }) => {
    const harness = await openHarness("long-document");
    const documentBounds = await documentRect(page, BELOW_FOLD);
    await page.evaluate((top) => window.scrollTo(0, top), Math.round(documentBounds.y - 200));
    const recordedBounds = await viewportRect(page, BELOW_FOLD);
    await page.evaluate(() => window.scrollTo(0, 0));
    const reply = await harness.runAction({
      commandId: "stale-bounds",
      actionType: "web.dom.click",
      visualTarget: visualTarget({ bounds: recordedBounds, documentBounds })
    });
    expect(reply.status).toBe("succeeded");
    expect(reply.element?.selector).not.toBe(BELOW_FOLD);
    await expect(page.getByTestId("result")).toHaveText("Pending");
    expect((await harness.finalState()).state).toMatchObject({ reached: false });
  });

  test("fingerprint: resolves below the fold, and click scrolls the target into view", async ({ openHarness, page }) => {
    const harness = await openHarness("long-document");
    const reply = await harness.runAction({
      commandId: "fingerprint-below-fold",
      actionType: "web.dom.click",
      options: { element: { attributes: { "data-testid": "below-fold-target" } } }
    });
    expect(reply).toMatchObject({ status: "succeeded", element: { selector: BELOW_FOLD } });
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    await expect(page.getByTestId("result")).toHaveText("Reached");
  });
});
