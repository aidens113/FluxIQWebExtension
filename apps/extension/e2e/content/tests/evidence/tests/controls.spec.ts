// The controls that change what the page shows, in the packet a model is given.
//
// The defect these rows close, measured here on 2026-09-23 before the fix:
// on the everything store's search page the snapshot held 611 elements and
// ranked the Brightaisle Plus facet 56th, behind twenty footer links -- "Sell
// on Brightaisle", "Become an Affiliate", "Sustainability", "Careers", "Back to
// top". The packet carried 27 elements at its 6,000-byte budget and the facet
// was in none of them, nor at 24,000 bytes, because the cut is the
// forty-element bound rather than the budget. Both runs of campaign
// `ten-sites-r5` then read the unnarrowed list -- "1-16 of over 1,000 results"
// where the narrowed page reads "of 43" -- and no work downstream can recover
// a filter the model was never shown.
//
// The rows run the real content script in Chromium and the real domain
// sanitizer over what it captured, at the live exploration budget and no
// larger, because the defect lives in the join between the two: the capture's
// ranking decides which forty elements the packet may describe, and each side's
// own suite was green while the rail was invisible.
//
// Three of the ten campaign sites, chosen for the three shapes a narrowing
// control comes in: the everything store's facets are links, ValueRidge's are
// checkboxes, and Rolefinch's are buttons that open a menu. Nothing here
// dismisses a fixture's consent banner except where a row says so, and no
// fixture is edited to make a packet read better.

import { sanitizeWebLlmSnapshot, WEB_LLM_EVIDENCE_BYTE_BUDGETS } from "@fluxiq-web-extension/domain";
import { expect, test } from "../../../index.js";
import type { ContentHarness } from "../../../index.js";

/** What a packet element reads as, which is all a model has to name it by. */
const described = (packet: ReturnType<typeof sanitizeWebLlmSnapshot>): string[] =>
  packet.elements.map((element) => (element.name ?? element.text ?? "").replace(/\s+/gu, " ").trim());

/** The packet as the exploration tools build it: no budget named, so the 6,000-byte default holds. */
async function packetOf(harness: ContentHarness): Promise<ReturnType<typeof sanitizeWebLlmSnapshot>> {
  const packet = sanitizeWebLlmSnapshot(await harness.capture());
  const bytes = new TextEncoder().encode(JSON.stringify(packet)).byteLength;
  expect(bytes, "the packet measured here is the one the live budget carries").toBeLessThanOrEqual(WEB_LLM_EVIDENCE_BYTE_BUDGETS.exploration);
  return packet;
}

/** Opens a fixture page other than the scenario's start page, with the content script already installed. */
async function open(harness: ContentHarness, path: string, ready: string): Promise<void> {
  await harness.page.goto(new URL(path, harness.lab.origin).href);
  await harness.page.waitForSelector(ready);
}

/**
 * Answers the fixture's consent banner as a shopper would. A page under a
 * banner cannot be clicked at all, so the state a narrowing Flow is authored
 * in is the one after it has been answered.
 */
async function acceptConsent(harness: ContentHarness, name: string): Promise<void> {
  await harness.page.getByRole("button", { name, exact: true }).click();
  await expect(harness.page.getByRole("button", { name, exact: true })).toBeHidden();
}

test("everything-store: every control that narrows the results page is in the packet", async ({ openHarness }) => {
  const harness = await openHarness("everything-store");
  await open(harness, "/scenarios/everything-store/s?k=wireless+earbuds", '[data-component="search-result"][data-sku][data-index="1"]');
  await acceptConsent(harness, "Accept");
  const names = described(await packetOf(harness));

  // The facet the campaign's instruction turns on, and the rest of the rail
  // beside it: the review filter, all four price bands, and the custom range.
  for (const control of ["Brightaisle Plus", "4 Stars & Up", "Under $25", "$25 to $50", "$50 to $100", "$100 & Above", "Minimum price", "Maximum price"]) {
    expect(names, control).toContain(control);
  }
  // The page's own search and sort, and the way to the rest of the results.
  for (const control of ["Search Brightaisle", "Sort by:", "Go to next page, page 2"]) {
    expect(names, control).toContain(control);
  }
  // A brand refinement is a distinct destination, not one of a run: the model
  // has to be able to name the brand it wants.
  expect(names).toContain("Kinetra");
});

test("everything-store: the footer's links no longer crowd the rail out", async ({ openHarness }) => {
  const harness = await openHarness("everything-store");
  await open(harness, "/scenarios/everything-store/s?k=wireless+earbuds", '[data-component="search-result"][data-sku][data-index="1"]');
  await acceptConsent(harness, "Accept");
  const packet = await packetOf(harness);
  const names = described(packet);

  // Each of these was ahead of the Brightaisle Plus facet in the ranked
  // snapshot, and each is the same on every page of the store.
  for (const chrome of ["Sell on Brightaisle", "Become an Affiliate", "Sustainability", "Careers", "Back to top", "Your Orders"]) {
    expect(names, chrome).not.toContain(chrome);
  }
  // The footer's own form is a GET form with no action, so it submits to
  // whatever page it stands on. That is not a refinement of this one.
  for (const chrome of ["Get deals in your inbox", "Subscribe"]) {
    expect(names, chrome).not.toContain(chrome);
  }
  // Demoted, not dropped: the snapshot still carries them for a page small
  // enough to describe them.
  const snapshot = await harness.capture();
  const carried = snapshot.interactiveElements.map((element) => element.accessibleName ?? element.visibleText ?? "");
  expect(carried).toContain("Back to top");
});

test("everything-store: the consent banner covering the page keeps its answers in the packet", async ({ openHarness }) => {
  const harness = await openHarness("everything-store");
  await open(harness, "/scenarios/everything-store/s?k=wireless+earbuds", '[data-component="search-result"][data-sku][data-index="1"]');
  const packet = await packetOf(harness);
  const names = described(packet);

  // The banner is a fixed layer over the page: the snapshot's own overlay
  // evidence says it blocks controls, so nothing behind it can be clicked
  // until it is answered, and both answers have to be nameable.
  expect(packet.blockedBy?.blocks ?? 0, "the fixture's banner is covering controls").toBeGreaterThan(0);
  expect(names).toContain("Accept");
  expect(names).toContain("Decline");
  // And the rail is still there, under it.
  expect(names).toContain("Brightaisle Plus");
});

test("bigbox-retail: the results sidebar's checkbox facets are all in the packet", async ({ openHarness }) => {
  const harness = await openHarness("bigbox-retail");
  await open(harness, "/scenarios/bigbox-retail/search?q=paper+towels", "body");
  await acceptConsent(harness, "Accept all");
  const names = described(await packetOf(harness));

  // ValueRidge's refinements are checkboxes in a sidebar rather than links, so
  // they are the page's own controls and were never the crowded-out case. The
  // row is here because promoting the facet links must not push them out:
  // every group the instruction needs -- the retailer, the pickup method, the
  // rating -- is named.
  for (const facet of ["ValueRidge (", "Pickup (", "Today (", "4 & up ("]) {
    expect(names.some((name) => name.startsWith(facet)), facet).toBe(true);
  }
  expect(names).toContain("Sort by");
  expect(names).toContain("Next page");
});

test("job-board: the filter buttons and the sort link are in the packet", async ({ openHarness }) => {
  const harness = await openHarness("job-board");
  await open(harness, "/scenarios/job-board/jobs?q=rust", "body");
  const names = described(await packetOf(harness));

  // Rolefinch's refinements are buttons that open a menu, which are page
  // controls; its sort is a link to the same path with `sort=date`, which is
  // the shape this ranking was built for.
  for (const control of ["Date posted", "Job type", "Remote", "Salary", "date", "Next"]) {
    expect(names, control).toContain(control);
  }
});
