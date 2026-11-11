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
//
// The grid's batch endpoint refuses two requests closer than 900 ms with a 429
// and `Retry-After: 2`, and the page waits that out and asks again on its own.
// A retry's scroll lands inside that window about half the time (the grid also
// asks for the next batch the moment one lands with its end in view), and then
// the button is unhidden 3.0 to 3.1 s after the first scroll. The reveal ladder
// waits that out as a person told "Trying again in 2 seconds" would (t759,
// `recovery/budget.ts`), so the press lands on either path and this spec
// asserts the same outcome for both.

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

  test("Show more people, pressed from the top of the page: the grid grows to the button, and one command presses past the page's spinner and loads more", async ({ openHarness, page }) => {
    const harness = await openHarness("company-website");
    await openTeamAtTop(harness);
    expect(await page.evaluate(() => window.scrollY), "the press starts from the top").toBe(0);

    // The page's first press of the button only shows a spinner. A press the page answers with
    // nothing but its own notice is pressed once more inside the same command (t898, from E1's
    // trace): it changed nothing but the notice, so it is certain to have done nothing. So the one
    // command lands on the revealed button and loads the next batch. The account still says the
    // runtime scrolled toward the button until it could be pressed.
    const before = await people(page);
    const first = await harness.runAction({ commandId: "more-1", actionType: "web.dom.click", selector: MORE });
    const firstSaid = `${first.message} | ${actualOf(first)} | ${first.failure?.actual ?? ""}`;
    expect(first.status, firstSaid).toBe("succeeded");
    expect(firstSaid, "the account says the target was scrolled toward until it could be pressed").toMatch(/scrolling \d+ times? toward where the target would be/u);
    expect(firstSaid, "the page's swallowed first press was pressed once more").toMatch(/pressed once more/u);
    await expect.poll(() => people(page), { message: "the one command's second press loaded more people", timeout: 10_000 }).toBeGreaterThan(Math.max(before, 8));
  });

  // t903, E1's trace of company-website-apprentices: a Flow's replay scrolls to the end of the
  // team page and presses "Show more people" about 0.7 s after it loads. Nothing is left to scroll,
  // and the page is still loading its people behind skeleton cards, waiting out its own 429s; it
  // shows the button seconds later. The press waited the dismissed-dialog ladder (about 1.35 s) and
  // gave up, so Core retried the step. It now waits while the page shows that work, and lands; the
  // page's swallowed first press is then pressed once more inside the same command (t898).
  test("Show more people, pressed at the end of the page right after it loads: the press waits while the page loads its people, and lands", async ({ openHarness, page }) => {
    const harness = await openHarness("company-website");
    await apply(harness, "set-consent", { choice: "essential" });
    await apply(harness, "dismiss-newsletter");
    await apply(harness, "dismiss-chat-greeting");
    await harness.page.goto(new URL("/scenarios/company-website/team", harness.lab.origin).href);
    await expect.poll(async () => (await harness.messages()).some((message) => message.type === "fluxiq.contentReady")).toBe(true);
    // As the replay's own scrolls leave it: at the end of the page, before the page has shown the button.
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect(page.locator(MORE), "the button is still hidden while the page loads its people").toBeHidden();

    const first = await harness.runAction({ commandId: "more-end-1", actionType: "web.dom.click", selector: MORE, timeoutMs: 10_000 });
    const said = `${first.message} | ${actualOf(first)} | ${first.failure?.actual ?? ""}`;
    // The press reached the button inside this one command, never `web.target.not_shown`; the
    // page's own swallowed first press (t743) is pressed once more in the same command (t898), so
    // the command lands.
    expect(first.failure?.code, said).not.toBe("web.target.not_shown");
    expect(first.status, said).toBe("succeeded");
    expect(said, "the page's swallowed first press was pressed once more").toMatch(/pressed once more/u);
    expect(await people(page), "the page loaded its batches while the press waited").toBeGreaterThan(8);
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
