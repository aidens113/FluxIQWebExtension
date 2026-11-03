// A Next authored on page two, played back from page one, on the realistic
// marketplace (`run-mw0jw263-0251c104`). From page two on, Previous is a link and
// Next is the pager's only div, so the first `div` in the pager is Next; on page
// one it is the disabled Previous. This pager's Next is a plain div and it marks
// its page only by a class, so the step used to answer that the list had no next
// page while the pager showed two more.
import { MARKET_SEED } from "../../../../../../scenario-lab/src/scenarios/crossborder-marketplace/manifest/index.js";
import { marketClasses } from "../../../../../../scenario-lab/src/scenarios/crossborder-marketplace/styles/index.js";
import type { BrowserActionCommand, BrowserActionResult } from "../../../../../src/shared/protocol.js";
import { expect, test, type ContentHarness } from "../../../index.js";

const SEARCH = "/scenarios/crossborder-marketplace/search?q=usb+c+hub";

async function arrived(harness: ContentHarness, message: unknown): Promise<BrowserActionResult> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    await harness.page.waitForLoadState("load");
    try {
      const delivered = await harness.deliver(message);
      if (delivered.responded) return delivered.response as BrowserActionResult;
    } catch (error) {
      if (!/Execution context was destroyed|Cannot find context/u.test(String(error))) throw error;
    }
    await harness.page.waitForTimeout(100);
  }
  throw new Error("The new document did not answer its marked Next landing.");
}

test("a Next pinned on page two, played back from page one, moves on by the page's own number", async ({ openHarness, page }) => {
  test.setTimeout(120_000);
  const harness = await openHarness("crossborder-marketplace");
  await expect(page.getByText("Welcome back, Mara!", { exact: true })).toBeVisible();
  await page.getByText("No thanks", { exact: true }).click();
  await page.getByText("Accept all", { exact: true }).click();
  await page.goto(new URL(SEARCH, harness.lab.origin).href);
  const classes = marketClasses(MARKET_SEED, "baseline");
  const item = `.${classes.card}`;
  await expect(page.locator(item).first()).toBeVisible();
  const pinned = `.${classes.pager} > div`;
  await expect(page.locator(pinned).first()).toHaveText("‹ Previous");
  await expect(page.locator(`.${classes.pager}`).getByText("Next ›", { exact: true })).toBeVisible();
  const action: BrowserActionCommand = { commandId: "pinned-next", actionType: "web.dom.next_page", timeoutMs: 30_000, nextPage: { item, pagination: { next: pinned } } };
  const message = { type: "executeAction", topFrameOnly: true, action, extraction: { token: "pinned-next" } };
  const first = await harness.deliver(message).catch(() => undefined);
  const reply = first?.responded ? first.response as BrowserActionResult : await arrived(harness, { ...message, extraction: { token: "pinned-next", resume: { by: "next" } } });
  const said = JSON.stringify({ nextPage: reply.nextPage, validation: reply.validation });
  expect(reply.status, said).toBe("succeeded");
  expect(reply.validation?.actual, said).toMatch(/^moved/u);
  expect(new URL(page.url()).searchParams.get("page"), said).toBe("2");
});
