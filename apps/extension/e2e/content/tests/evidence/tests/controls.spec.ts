// The controls that change what the page shows, and the facts that used to
// rank them, in the snapshot the real content script captures.
//
// Until t200 the snapshot was ranked and cut at 2,000 elements, and the packet
// a model read described the head of that ranking at a 6,000-byte budget. On
// the everything store's search page the Brightaisle Plus facet ranked 56th,
// behind twenty footer links, and reached no packet; the crossborder
// marketplace's filters, drawn as `<div>`s, ranked 58th, 61st and 62nd of 292
// and reached none either. The fixes were more ranking: page-state controls
// first, drawn controls promoted, a front layer's controls promoted, the main
// region's lead statements lifted, footer links demoted, a link's copy of the
// page's own address withheld.
//
// t200 removed the ranking, the cut and the budget: every rendered element is
// listed, in document order, whole. What these rows pin is what replaced it:
//
// - every narrowing control is in the snapshot, where the page puts it, and
//   the footer is still after the rail -- because the page puts it there, not
//   because anything demoted it;
// - a facet link keeps its whole address, query included;
// - the two ranking rules that carried information are facts on the element:
//   `frontLayer` on a consent banner's answers, `leadStatement` on the main
//   region's "No results for ...";
// - a covering layer says what it is, as `kind` on its blocker entry.
//
// The rows run the real content script in Chromium. Nothing here edits a
// fixture, and nothing dismisses a consent banner except where a row says so.

import { expect, test } from "../../../index.js";
import type { ContentHarness } from "../../../index.js";
import { capture, type CapturedElement } from "./captured-snapshot.js";

/** What an element reads as: its accessible name, its label, or its text. */
const nameOf = (element: CapturedElement): string =>
  (element.accessibleName ?? element.label ?? element.visibleText ?? element.text ?? "").replace(/\s+/gu, " ").trim();

/** Opens a fixture page other than the scenario's start page, with the content script already installed. */
async function open(harness: ContentHarness, path: string, ready: string): Promise<void> {
  await harness.page.goto(new URL(path, harness.lab.origin).href);
  await harness.page.waitForSelector(ready);
}

/**
 * Answers the fixture's consent banner as a shopper would, for the rows that
 * are about the page under it rather than the banner.
 */
async function acceptConsent(harness: ContentHarness, name: string): Promise<void> {
  await harness.page.getByRole("button", { name, exact: true }).click();
  await expect(harness.page.getByRole("button", { name, exact: true })).toBeHidden();
}

const RESULTS_PATH = "/scenarios/everything-store/s?k=wireless+earbuds";
const RESULTS_READY = '[data-component="search-result"][data-sku][data-index="1"]';

test("everything-store: every control that narrows the results page is in the snapshot, the rail before the footer", async ({ openHarness }) => {
  const harness = await openHarness("everything-store");
  await open(harness, RESULTS_PATH, RESULTS_READY);
  await acceptConsent(harness, "Accept");
  const names = (await capture(harness)).interactiveElements.map(nameOf);

  // The facet the campaign's instruction turns on, the rest of the rail, the
  // page's own search and sort, the pager, and a brand refinement.
  for (const control of [
    "Brightaisle Plus", "4 Stars & Up", "Under $25", "$25 to $50", "$50 to $100", "$100 & Above",
    "Minimum price", "Maximum price", "Search Brightaisle", "Sort by:", "Go to next page, page 2", "Kinetra"
  ]) {
    expect(names, control).toContain(control);
  }
  // The footer is listed too -- nothing is dropped -- and it comes after the
  // rail because that is where the page draws it.
  for (const chrome of ["Sell on Brightaisle", "Become an Affiliate", "Careers", "Back to top"]) {
    expect(names, chrome).toContain(chrome);
    expect(names.indexOf(chrome), `${chrome} follows the facet in document order`).toBeGreaterThan(names.indexOf("Brightaisle Plus"));
  }
});

test("everything-store: a facet link keeps its whole address, query included", async ({ openHarness }) => {
  const harness = await openHarness("everything-store");
  await open(harness, RESULTS_PATH, RESULTS_READY);
  const snapshot = await capture(harness);

  // The capture used to delete a link's `href` when it pointed back at this
  // page, because the packet published it stripped of its query. A facet's
  // real destination is its query, so it is carried whole.
  const facet = snapshot.interactiveElements.find((element) => nameOf(element) === "Brightaisle Plus" && element.attributes?.href !== undefined);
  expect(facet, "the facet link is in the snapshot").toBeDefined();
  expect(facet?.href, "the address is on the descriptor").toBeDefined();
  expect(facet?.attributes?.href, "the authored address keeps its query").toContain("k=wireless+earbuds");
});

test("everything-store: the consent banner's answers are marked as painted over the page, and its blocker says it is a consent layer", async ({ openHarness }) => {
  const harness = await openHarness("everything-store");
  await open(harness, RESULTS_PATH, RESULTS_READY);
  const snapshot = await capture(harness);
  const elements = snapshot.interactiveElements;

  // The banner is `position: fixed` over the page. Its answers carry the
  // fact; the rail under it does not, and stays where the page put it.
  for (const answer of ["Accept", "Decline"]) {
    const control = elements.find((element) => element.tagName.toLowerCase() === "button" && nameOf(element) === answer);
    expect(control, answer).toBeDefined();
    expect(control?.frontLayer, `${answer} is on the front layer`).toBe(true);
  }
  const facet = elements.find((element) => nameOf(element) === "Brightaisle Plus");
  expect(facet, "the rail is still there, under the banner").toBeDefined();
  expect(facet?.frontLayer).toBeUndefined();

  // What the banner covers is reported, and the covering layer says what it is.
  const blockers = snapshot.evidence?.overlays?.blockers ?? [];
  expect(blockers.length, "the banner covers controls").toBeGreaterThan(0);
  expect(blockers.some((blocker) => blocker.kind === "consent"), "a blocker is recognised as the consent layer").toBe(true);
});

test("everything-store: a search that found nothing marks the page's own statements of it", async ({ openHarness }) => {
  const harness = await openHarness("everything-store");
  // Live run 21 typed a query the store matched nothing for and read the page
  // as results for all 64 of its decisions.
  await open(harness, "/scenarios/everything-store/s?k=zzqxv+wqpf+nonexistent", '[data-testid="result-count"]');
  await acceptConsent(harness, "Accept");
  const elements = (await capture(harness)).interactiveElements;
  const statements = elements.filter((element) => element.leadStatement === true).map(nameOf);

  expect(statements.some((statement) => statement.startsWith("No results for")), "the results bar's count").toBe(true);
  expect(statements, "the empty-state advice").toContain("Try checking your spelling or use more general terms.");
  // Every statement stays where the page put it: the flag moves nothing.
  const firstStatement = elements.findIndex((element) => element.leadStatement === true);
  const firstHeaderControl = elements.findIndex((element) => nameOf(element) === "Search Brightaisle");
  expect(firstHeaderControl, "the header's search precedes the main region in document order").toBeLessThan(firstStatement);
  // The footer's words are the footer's.
  expect(statements).not.toContain("Back to top");
});

test("crossborder-marketplace: the filters drawn as divs are in the snapshot", async ({ openHarness }) => {
  const harness = await openHarness("crossborder-marketplace");
  // The results arrive in two fetched batches; measuring before they land
  // would measure a page that is not yet the one the instruction reads.
  await open(harness, "/scenarios/crossborder-marketplace/search?q=usb+c+hub", "a[href*='/item/']");
  await expect(harness.page.locator("a[href*='/item/']")).not.toHaveCount(0);
  const names = (await capture(harness)).interactiveElements.map(nameOf);

  // "Ships from Spain, free shipping, rated 4.5 or higher" turns on the first
  // three; the price range's OK and the sort are `<div>`s too, and so is the
  // consent banner's answer.
  for (const control of ["Spain", "Free shipping", "4★ & up", "China", "Poland", "Czech Republic", "Hubsmith", "Voltbay", "OK", "Best Match", "Accept all"]) {
    expect(names, control).toContain(control);
  }
});

test("bigbox-retail: the results sidebar's checkbox facets are all in the snapshot", async ({ openHarness }) => {
  const harness = await openHarness("bigbox-retail");
  await open(harness, "/scenarios/bigbox-retail/search?q=paper+towels", "body");
  await acceptConsent(harness, "Accept all");
  const names = (await capture(harness)).interactiveElements.map(nameOf);

  for (const facet of ["ValueRidge (", "Pickup (", "Today (", "4 & up ("]) {
    expect(names.some((name) => name.startsWith(facet)), facet).toBe(true);
  }
  expect(names).toContain("Sort by");
  expect(names).toContain("Next page");
});

test("job-board: the filter buttons, the sort link and the job cards are all in the snapshot", async ({ openHarness }) => {
  const harness = await openHarness("job-board");
  await open(harness, "/scenarios/job-board/jobs?q=rust", "body");
  const elements = (await capture(harness)).interactiveElements;
  const names = elements.map(nameOf);

  for (const control of ["Date posted", "Job type", "Remote", "Salary", "date", "Next"]) {
    expect(names, control).toContain(control);
  }
  expect(elements.filter((element) => element.tagName.toLowerCase() === "article").length, "every job card is listed").toBeGreaterThan(0);
});
