// One example per repeating control, on a real page built from a repeated
// template.
//
// `content/repeat-exemplars.ts` folds a run of identical row controls behind
// one exemplar that carries the run's size, so a reader can say "one of 50
// cards" without counting. Since t200 it annotates and nothing else: the
// snapshot lists every rendered element in composed document order and no
// longer ranks or cuts that list, so a run's followers stay where the page put
// them. The rows below run the real content script in Chromium and the real
// domain sanitizer on what it captured, because the count has to survive the
// join between the two.
//
// The page (t730: browser specs open only the ten realistic scenarios) is the
// job board's results list: an `ol` of `li > article` cards, each with its
// title as an `h2 > a`, sponsored cards built from the same template. Its
// header links, filter pills and search button are the page's own controls,
// which never fold. The run's size is read from the list the page rendered,
// since the board's page size is the visitor's choice (`limit`).
//
// What the synthetic scheduler's rows also pinned, and why it is not here:
// that the snapshot's head held the page's buttons ahead of the row
// checkboxes, that followers ranked after every distinct element, and that a
// row control just used stayed in the first forty. All three describe the
// ranking t200 removed, and all three failed on `dev` before this retarget
// (t730 report). A select-all checkbox sharing the rows' column has no
// counterpart on the ten sites.

import type { Page } from "@playwright/test";
import { sanitizeWebLlmSnapshot } from "@fluxiq-web-extension/domain";
import { expect, test } from "../index.js";
import type { ContentHarness } from "../index.js";
import type { DomElementDescriptor } from "../../../src/shared/protocol.js";

const RESULTS = "/scenarios/job-board/jobs";
/** Every card's title link, organic or sponsored: one position in the card template. */
const TITLE_LINK = "main ol > li > article h2 > a";

const nameOf = (element: DomElementDescriptor): string => element.accessibleName ?? element.visibleText ?? "";

/** Sends one of the scenario's own page mutations, as its page script would. */
async function mutate(harness: ContentHarness, operation: string, payload: Record<string, unknown> = {}): Promise<void> {
  const response = await fetch(`${harness.lab.origin}/api/${harness.scenarioId}/${operation}`, {
    method: "POST",
    headers: { authorization: `Bearer ${harness.lab.runToken}`, "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error(`${harness.scenarioId} answered ${response.status} to ${operation}.`);
}

/** Opens a results page holding `limit` cards, as a returning visitor sees it: consent answered, the alert offer and the chat put away. */
async function openResults(openHarness: (id: string) => Promise<ContentHarness>, limit: 10 | 25 | 50): Promise<ContentHarness> {
  const harness = await openHarness("job-board");
  await mutate(harness, "consent", { choice: "accepted" });
  await mutate(harness, "dismiss-alert-offer");
  await mutate(harness, "minimise-chat");
  await harness.page.goto(new URL(`${RESULTS}?limit=${limit}`, harness.lab.origin).href);
  await expect(harness.page.locator(TITLE_LINK).first()).toBeVisible();
  return harness;
}

/** For each descriptor, the index among `css`'s matches of the element its selector names, or -1 when it names none of them. */
async function positionsAmong(page: Page, elements: readonly DomElementDescriptor[], css: string): Promise<number[]> {
  return await page.evaluate(([selectors, query]) => {
    const matches = Array.from(document.querySelectorAll(query));
    return selectors.map((selector) => {
      try {
        const found = selector ? document.querySelector(selector) : null;
        return found ? matches.indexOf(found) : -1;
      } catch {
        return -1;
      }
    });
  }, [elements.map((element) => element.selector ?? ""), css] as const);
}

/** The descriptors of the cards' title links, each with its card's place in the list, in snapshot order. */
async function titleLinks(page: Page, elements: readonly DomElementDescriptor[]): Promise<Array<{ element: DomElementDescriptor; card: number }>> {
  const positions = await positionsAmong(page, elements, TITLE_LINK);
  return elements.flatMap((element, index) => (positions[index] !== undefined && positions[index] >= 0 ? [{ element, card: positions[index] }] : []));
}

test("a card's title link is one kind: one exemplar, the first card's, carrying the run's size, and the page's own controls are not folded", async ({ openHarness, page }) => {
  const harness = await openResults(openHarness, 50);
  const cards = await page.locator(TITLE_LINK).count();
  expect(cards, "a page of fifty is a template, not a short list of choices").toBeGreaterThan(5);
  const elements = (await harness.capture()).interactiveElements;

  const links = await titleLinks(page, elements);
  const exemplars = links.filter((link) => link.element.repeatCount !== undefined);
  expect(exemplars).toHaveLength(1);
  expect(exemplars[0]?.card, "the exemplar is the first card's").toBe(0);
  expect(exemplars[0]?.element.repeatCount).toBe(cards);

  // The page's own controls are distinct destinations and choices, each listed for itself.
  for (const name of ["Find jobs", "Date posted", "Remote", "Salary", "Job type"]) {
    const control = elements.find((element) => element.tagName === "button" && nameOf(element) === name);
    expect(control, name).toBeDefined();
    expect(control?.repeatCount, name).toBeUndefined();
  }
  const header = elements.filter((element) => element.tagName === "a" && element.context?.landmark === "navigation");
  expect(header.map(nameOf)).toEqual(expect.arrayContaining(["Find jobs", "Company reviews", "Salary guide"]));
  expect(header.filter((element) => element.repeatCount !== undefined)).toEqual([]);
});

test("the rest of the run stays in the snapshot, where the page put it (t200)", async ({ openHarness, page }) => {
  const harness = await openResults(openHarness, 50);
  const cards = await page.locator(TITLE_LINK).count();
  const links = await titleLinks(page, (await harness.capture()).interactiveElements);
  // Every card's link is listed, once, in the list's own order, and only the first carries the count.
  expect(links.map((link) => link.card)).toEqual(Array.from({ length: cards }, (_, index) => index));
  expect(links.slice(1).filter((link) => link.element.repeatCount !== undefined)).toEqual([]);
});

test("the packet a model is shown carries the run's size on the first card's link, beside the page's own button", async ({ openHarness, page }) => {
  const harness = await openResults(openHarness, 50);
  const cards = await page.locator(TITLE_LINK).count();
  const firstTitle = (await page.locator(TITLE_LINK).first().innerText()).trim();
  const packet = sanitizeWebLlmSnapshot(await harness.capture());
  // The card's other parts (company, salary, tags, snippet, footer) are runs of
  // text and fold the same way; the one link among them is the title.
  const counted = packet.elements.filter((element) => element.repeats === cards && element.tag === "a");
  expect(counted.map((element) => element.name ?? element.text ?? "")).toEqual([firstTitle]);
  expect(packet.elements.map((element) => element.name ?? element.text ?? "")).toContain("Find jobs");
});

test("a smaller page counts what is left", async ({ openHarness, page }) => {
  const harness = await openResults(openHarness, 10);
  const cards = await page.locator(TITLE_LINK).count();
  expect(cards).toBeLessThan(50);
  const exemplars = (await titleLinks(page, (await harness.capture()).interactiveElements)).filter((link) => link.element.repeatCount !== undefined);
  expect(exemplars.map((link) => [link.card, link.element.repeatCount])).toEqual([[0, cards]]);
});

// Nothing is recording here, so this is the runtime interaction ledger's
// case: an action presses one card's title, the board opens that posting in
// its pane, and the look that follows still lists that card's link as itself
// -- never as a follower the first card's link stands for.
test("a card's link just acted on is listed as itself, and the run's exemplar is unchanged", async ({ openHarness, page }) => {
  const harness = await openResults(openHarness, 10);
  const cards = await page.locator(TITLE_LINK).count();
  await page.locator(TITLE_LINK).nth(4).evaluate((anchor) => anchor.setAttribute("data-spec-fifth", ""));
  const pressed = await harness.runAction({ commandId: "open-fifth", actionType: "web.dom.click", selector: "[data-spec-fifth]" });
  expect(pressed.status, pressed.message).toBe("succeeded");
  const links = await titleLinks(page, (await harness.capture()).interactiveElements);
  const fifth = links.find((link) => link.card === 4);
  expect(fifth, "the card just pressed is in the snapshot").toBeDefined();
  expect(fifth?.element.repeatCount).toBeUndefined();
  expect(links.filter((link) => link.element.repeatCount !== undefined).map((link) => [link.card, link.element.repeatCount])).toEqual([[0, cards]]);
});
