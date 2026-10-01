// A bar pinned to the viewport covers a control that scrolls with the page only
// where the control happens to sit, through the real content-script bundle on
// bigbox-retail's cart (T2).
//
// The click's gate scrolls its target to the viewport's centre before it
// hit-tests, so the page evidence may call a control covered only when it would
// still be covered there. bigbox's cart keeps its "Estimated total ... Continue
// to checkout" bar fixed at the bottom, and the recommendations under it were
// reported covered and refused before the press was sent (lane A, run 39,
// `run-muq4jztv-ea489aa9`). The oracle is the browser's own hit test after the
// same scroll the gate makes.

import { expect, test } from "../../../index.js";

type Blocker = { selector: string; blocked: string[] };

test("bigbox cart: every control the evidence calls covered is still covered once scrolled to the viewport's centre", async ({ openHarness, page }) => {
  test.setTimeout(60_000);
  const harness = await openHarness("bigbox-retail");
  await page.getByRole("button", { name: "Accept all" }).click();
  await page.locator("a", { hasText: "No thanks" }).click({ timeout: 8_000 });
  await page.goto(new URL("/scenarios/bigbox-retail/cart", harness.url).href);
  await expect.poll(async () => (await harness.messages()).some((message) => message.type === "fluxiq.contentReady")).toBe(true);
  await page.waitForTimeout(500);

  const snapshot = await harness.capture() as unknown as { evidence?: { overlays?: { blockers?: Blocker[] } } };
  const blocked = [...new Set((snapshot.evidence?.overlays?.blockers ?? []).flatMap((blocker) => blocker.blocked))];
  const stillCovered = await page.evaluate((selectors) => selectors.map((selector) => {
    const element = document.querySelector(selector);
    if (!element) return { selector, covered: null as boolean | null };
    const before = window.scrollY;
    element.scrollIntoView({ block: "center", inline: "center", behavior: "instant" });
    const rect = element.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    window.scrollTo(0, before);
    return { selector, covered: !(hit && (hit === element || element.contains(hit) || hit.contains(element))) };
  }), blocked);
  const falseCovers = stillCovered.filter((entry) => entry.covered === false).map((entry) => entry.selector);
  expect(falseCovers, "nothing the gate's own scroll uncovers is called covered").toEqual([]);
});
