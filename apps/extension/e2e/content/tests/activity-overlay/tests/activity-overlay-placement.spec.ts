// Where the activity overlay sits on a real page, and that it stays there:
// clear of the page's header and logo, never across the middle of the
// viewport's edge, and still for ten seconds of scrolling (round 5 of the
// breadth reruns: the pill covered the site's logo and header and jumped
// between the top, the middle and the bottom of the left edge).
//
// The page is company-website, one of the ten realistic scenarios, the only
// fixtures browser runs may use; its sticky header, cookie consent and chat
// launcher make every plain corner busy, which is the case that sent the pill
// to the middle of the edge.

import type { Page } from "@playwright/test";
import { expect, test, type ContentHarness } from "../../../index.js";

const SCENARIO = "company-website";
const HOST = "fluxiq-activity-overlay";

type Box = { x: number; y: number; width: number; height: number };

async function show(harness: ContentHarness, sequence: number): Promise<void> {
  const display = {
    activityId: "build:e2e-placement",
    subjectKind: "build",
    phase: "exploring",
    headline: "Building your Flow",
    detail: "Reading the page",
    step: null,
    working: true,
    outcome: null,
    sequence
  };
  const delivery = await harness.deliver({ type: "fluxiq.activity.overlay", activity: null, display, overlay: "expanded", topFrameOnly: true });
  expect(delivery).toEqual({ responded: true, response: { ok: true } });
}

function overlayBox(page: Page): Promise<Box | null> {
  return page.evaluate((host) => {
    const rect = document.querySelector(host)?.getBoundingClientRect();
    return rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null;
  }, HOST);
}

/** The page's header and the logo inside it, as the page draws them now. */
function headerBoxes(page: Page): Promise<Box[]> {
  return page.evaluate(() => {
    const header = document.querySelector("header, [role=banner]");
    const logo = header?.querySelector("img, svg, [class*=logo i], [data-testid*=logo i]");
    return [header, logo]
      .filter((element): element is Element => Boolean(element))
      .map((element) => element.getBoundingClientRect())
      .filter((rect) => rect.width > 0 && rect.height > 0)
      .map((rect) => ({ x: rect.x, y: rect.y, width: rect.width, height: rect.height }));
  });
}

function overlaps(a: Box, b: Box): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

test("the overlay keeps clear of the header and logo, off the middle of the edge, and still through ten seconds of scrolling", async ({ openHarness, page }) => {
  test.setTimeout(45_000);
  const harness = await openHarness(SCENARIO);
  await show(harness, 1);
  // The first place is chosen at once; a page change after it moves it only once a better place has stayed better.
  await page.waitForTimeout(3_500);
  const placed = await overlayBox(page);
  expect(placed, "the overlay is on the page").not.toBeNull();
  const viewport = page.viewportSize()!;
  const inTop = placed!.y + placed!.height <= viewport.height * 0.4 + 1;
  const inBottom = placed!.y >= viewport.height * 0.6 - 1;
  expect(inTop || inBottom, `in the top or bottom band, not the middle: ${JSON.stringify(placed)}`).toBe(true);
  for (const box of await headerBoxes(page)) {
    expect(overlaps(placed!, box), `clear of the header and logo: overlay ${JSON.stringify(placed)}, page ${JSON.stringify(box)}`).toBe(false);
  }

  const seen: Box[] = [];
  const started = Date.now();
  let direction = 1;
  while (Date.now() - started < 10_000) {
    const moved = await page.evaluate((step) => {
      const before = window.scrollY;
      window.scrollBy(0, step);
      return window.scrollY !== before;
    }, 160 * direction);
    if (!moved) direction = -direction;
    await page.waitForTimeout(250);
    const box = await overlayBox(page);
    expect(box, "the overlay stays on the page while it scrolls").not.toBeNull();
    seen.push(box!);
  }
  const distinct = new Set(seen.map((box) => `${Math.round(box.x)},${Math.round(box.y)}`));
  expect([...distinct], `one place through ${seen.length} samples of scrolling`).toEqual([`${Math.round(placed!.x)},${Math.round(placed!.y)}`]);
});
