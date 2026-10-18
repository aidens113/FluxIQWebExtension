// A press on a control the page has not shown yet scrolls toward where it would
// be, inside the node's own retries, through the real content-script bundle on
// company-website's team page (T2 harness: no background worker, no Core, no
// model). The oracle is the page itself: the grid has grown.
//
// Live (install-core): every click on the team page's "Show more people"
// failed `web.target.not_shown`, "the element's display is none ... did not
// recover within its 4 attempts". The page loads its grid a batch at a time as
// the grid's end scrolls into view, and unhides the button only after its
// automatic loads, so the button is never shown to a runtime that only waits.
// A person told to press it scrolls down to it; the retries now do the same
// (`src/content/action-runtime/reveal/`).

import type { Page } from "@playwright/test";
import type { BrowserActionResult } from "../../../../../src/shared/protocol.js";
import { expect, test } from "../../../index.js";
import type { ContentHarness } from "../../../index.js";
import { TEAM } from "../../../../../../scenario-lab/src/scenarios/company-website/data/index.js";

const PEOPLE = 'section[aria-label="Our people"]';
const MORE = `${PEOPLE} > button`;
/** The grid is the section's second `div`, after the branch chips. */
const GRID = `${PEOPLE} > div:nth-of-type(2)`;

const actualOf = (reply: BrowserActionResult): string => (reply.validation.status === "none" ? "" : reply.validation.actual);

/** One site operation, as the page's own scripts send it. */
async function apply(harness: ContentHarness, operation: string, payload: object = {}): Promise<void> {
  const response = await fetch(`${harness.lab.origin}/api/${harness.scenarioId}/${operation}`, {
    method: "POST",
    headers: { authorization: `Bearer ${harness.lab.runToken}`, "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  expect(response.ok, `${operation} answered ${response.status}`).toBe(true);
}

/** The person cards in the grid, skeletons aside. */
const people = (page: Page): Promise<number> => page.locator(GRID).evaluate((grid) => [...grid.children].filter((card) => !card.hasAttribute("data-skeleton") && card.getAttribute("aria-hidden") !== "true").length);

async function openTeamAtTop(harness: ContentHarness): Promise<void> {
  // Consent answered and the timed prompts dismissed, so the press meets the page alone.
  await apply(harness, "set-consent", { choice: "essential" });
  await apply(harness, "dismiss-newsletter");
  await apply(harness, "dismiss-chat-greeting");
  await harness.page.goto(new URL("/scenarios/company-website/team", harness.lab.origin).href);
  await expect.poll(async () => (await harness.messages()).some((message) => message.type === "fluxiq.contentReady")).toBe(true);
  await expect.poll(() => people(harness.page), { message: "the first batch arrives on load" }).toBe(8);
  // The batch endpoint refuses two requests closer than 900 ms; the first scroll must not be refused for the page load's own.
  await harness.page.waitForTimeout(1_000);
  await harness.page.evaluate(() => window.scrollTo(0, 0));
  await expect(harness.page.locator(MORE), "the button is not shown until the grid has loaded its batches").toBeHidden();
}

test.describe("company-website: a control not shown yet is scrolled toward, as a person would", () => {
  test.setTimeout(60_000);

  test("Show more people, pressed from the top of the page: the grid grows to the button, the press lands, and the next press loads more", async ({ openHarness, page }) => {
    const harness = await openHarness("company-website");
    await openTeamAtTop(harness);
    expect(await page.evaluate(() => window.scrollY), "the press starts from the top").toBe(0);

    const first = await harness.runAction({ commandId: "more-1", actionType: "web.dom.click", selector: MORE });
    expect(first.status, `${first.message} | ${actualOf(first)} | ${first.failure?.actual ?? ""}`).toBe("succeeded");
    expect(actualOf(first), "the account says the target was revealed by scrolling").toMatch(/scrolling \d+ times? toward where the target would be, which revealed it/u);
    expect(await people(page), "scrolling toward the button loaded the grid's batches").toBeGreaterThan(8);
    await expect(page.locator(MORE)).toBeVisible();

    // The page's first press only shows a spinner; the second loads the next batch.
    const before = await people(page);
    const second = await harness.runAction({ commandId: "more-2", actionType: "web.dom.click", selector: MORE });
    expect(second.status, `${second.message} | ${actualOf(second)}`).toBe("succeeded");
    await expect.poll(() => people(page), { message: "the press loaded more people", timeout: 10_000 }).toBeGreaterThan(before);
  });

  test("Next page reaches every batch when its detected Load more begins hidden", async ({ openHarness, page }) => {
    test.setTimeout(90_000);
    const harness = await openHarness("company-website");
    await openTeamAtTop(harness);
    let ended = false;
    for (let move = 0; move < 8 && !ended; move += 1) {
      const before = await people(page);
      let result: BrowserActionResult | undefined;
      for (let attempt = 0; attempt < 4; attempt += 1) {
        result = await harness.runAction({
          commandId: `hybrid-${move}-${attempt}`,
          actionType: "web.dom.next_page",
          timeoutMs: 30_000,
          nextPage: { item: `${GRID} > article`, pagination: { mode: "loadMore", control: MORE } }
        });
        if (result.status === "succeeded") break;
        expect(result.failure?.code).toBe("web.validation.output_not_observed");
      }
      expect(result?.status, `${result?.message} | ${result && actualOf(result)}`).toBe("succeeded");
      ended = result!.nextPage?.outcome === "ended";
      if (!ended) expect(await people(page)).toBeGreaterThan(before);
      if (move === 0) expect(result!.nextPage).toEqual({ outcome: "moved", by: "scroll" });
    }
    expect(ended, "the list eventually ends after its final batch").toBe(true);
    expect(await people(page), "every fixture card is reachable through Next page, including the last batch").toBe(TEAM.length);
  });
});
