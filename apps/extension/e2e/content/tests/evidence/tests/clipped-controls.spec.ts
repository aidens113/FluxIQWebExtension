// A control scrolled out of sight inside its own scrolling container is not
// covered, through the real content-script bundle on bigbox-retail (T2).
//
// bigbox's store chooser lists its stores in a 320-pixel scrolling list. With
// the chooser open, the third and fourth cards' "Set as my store" sit below the
// list's visible edge, and the page evidence used to hit-test the centre of
// their whole box, land on the results tiles beneath the chooser, and report
// them covered by `main`. A live build was then refused the store switch before
// the press was sent, and spent its decisions looking for a layer that was not
// there (lane A, run 38, `run-muq3vuwx-94fdde27`). Controls a layer really
// covers -- the nav links under the open chooser -- are still reported.

import type { Page } from "@playwright/test";
import { expect, test } from "../../../index.js";

type Blocker = { selector: string; blocked: string[] };

async function shadowClass(page: Page, host: string, inner: string): Promise<string> {
  return await page.evaluate(([hostSelector, innerSelector]) => {
    const element = document.querySelector(hostSelector)?.shadowRoot?.querySelector(innerSelector);
    return element ? [...element.classList][0] ?? "" : "";
  }, [host, inner] as const);
}

test("bigbox: the chooser's stores below its scrolling list's edge are not reported covered; the nav links under the chooser still are", async ({ openHarness, page }) => {
  test.setTimeout(60_000);
  const harness = await openHarness("bigbox-retail");
  await page.getByRole("button", { name: "Accept all" }).click();
  await page.locator("a", { hasText: "No thanks" }).click({ timeout: 8_000 });
  const chip = await shadowClass(page, "vr-fulfillment-picker", "button");
  const press = await harness.runAction({ commandId: "chip", actionType: "web.dom.click", selector: `button.${chip}`, timeoutMs: 10_000 });
  expect(press.status, press.message).toBe("succeeded");

  // The oracle: the third card's button is below the list's visible edge.
  const clipped = await page.evaluate(() => {
    const root = document.querySelector("vr-fulfillment-picker")?.shadowRoot;
    const list = root?.querySelector("ul");
    const third = root?.querySelectorAll("li button")[1];
    if (!list || !third) return null;
    return third.getBoundingClientRect().top >= list.getBoundingClientRect().bottom;
  });
  expect(clipped, "the third store's button is scrolled out of the list's view").toBe(true);

  const snapshot = await harness.capture() as unknown as { evidence?: { overlays?: { blockers?: Blocker[] } } };
  const blocked = (snapshot.evidence?.overlays?.blockers ?? []).flatMap((blocker) => blocker.blocked);
  expect(blocked.filter((selector) => /li:nth-of-type\([34]\) > button$/u.test(selector)), "no store button inside the list is called covered").toEqual([]);
  expect(blocked.filter((selector) => /header > nav > a/u.test(selector)).length, "the nav links the open chooser lies over are still covered").toBeGreaterThan(0);
});
