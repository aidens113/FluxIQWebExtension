// What the packet spends its six thousand bytes on, and what it is still
// missing once it stops spending them on itself.
//
// Two defects, measured here on 2026-09-23 with the real content script in
// Chromium and the real domain sanitizer over what it captured, at the live
// exploration budget and no larger.
//
// **The packet repeated its own address.** The domain reports a link as origin
// and pathname and never its query, so every link back to the page it is on was
// published as a byte-for-byte copy of the packet's own `location`. On the
// everything store's search page that was twenty-two of thirty-two described
// elements carrying the identical 58-byte string: 1,320 bytes, 22% of the
// budget, and not merely redundant -- a facet link's real destination *is* its
// query, so the address published was the wrong one. Dropping it bought eight
// more elements on that page and nine on the crossborder marketplace, at the
// same budget.
//
// **A filter drawn as a `<div>` reached no packet at all.** The crossborder
// marketplace renders "Spain", "Free shipping" and "4★ & up" as
// `<div class="filterOption">` with listeners attached in script. No browser
// control, no link, no ARIA role, so the capture ranked them 58th, 61st and
// 62nd of 292 elements and the packet's thirty-one never reached them. That
// site's whole instruction depends on those three.
//
// The rows below are the two together, plus the restraint the second one needs:
// the job board's twelve clickable `<article>` cards and the big-box
// retailer's eighteen facet count spans are *not* controls, and a rule that
// took them would fill the packet with the page's own contents. No fixture is
// edited to make a packet read better.

import { sanitizeWebLlmSnapshot, WEB_LLM_EVIDENCE_BYTE_BUDGETS } from "@fluxiq-web-extension/domain";
import { expect, test } from "../../../index.js";
import type { ContentHarness } from "../../../index.js";

type Packet = ReturnType<typeof sanitizeWebLlmSnapshot>;

/** What a packet element reads as, which is all a model has to name it by. */
const described = (packet: Packet): string[] =>
  packet.elements.map((element) => (element.name ?? element.text ?? "").replace(/\s+/gu, " ").trim());

/** The packet as the exploration tools build it: no budget named, so the 6,000-byte default holds. */
async function packetOf(harness: ContentHarness): Promise<Packet> {
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

test("everything-store: no element spends the budget saying where the page already is", async ({ openHarness }) => {
  const harness = await openHarness("everything-store");
  await open(harness, "/scenarios/everything-store/s?k=wireless+earbuds", '[data-component="search-result"][data-sku][data-index="1"]');
  await harness.page.getByRole("button", { name: "Accept", exact: true }).click();
  await expect(harness.page.getByRole("button", { name: "Accept", exact: true })).toBeHidden();
  const packet = await packetOf(harness);

  // Twenty-two of these before the change, every one of them this same string.
  const repeated = packet.elements.filter((element) => element.href === packet.location);
  expect(repeated.map((element) => element.name ?? element.text), "a link back to this page publishes no address").toEqual([]);

  // And the rail it was crowding is still there, still early. t100 rescued the
  // facet from index -1 to index 9; nothing here may push it back out.
  const names = described(packet);
  expect(names).toContain("Brightaisle Plus");
  expect(names.indexOf("Brightaisle Plus")).toBeLessThan(15);
  for (const control of ["4 Stars & Up", "Under $25", "$100 & Above", "Minimum price", "Maximum price", "Sort by:", "Search Brightaisle", "Go to next page, page 2", "Kinetra"]) {
    expect(names, control).toContain(control);
  }
});

test("everything-store: a link that goes somewhere else still says where", async ({ openHarness }) => {
  const harness = await openHarness("everything-store");
  await open(harness, "/scenarios/everything-store/s?k=wireless+earbuds", '[data-component="search-result"][data-sku][data-index="1"]');
  await harness.page.getByRole("button", { name: "Accept", exact: true }).click();
  await expect(harness.page.getByRole("button", { name: "Accept", exact: true })).toBeHidden();
  const packet = await packetOf(harness);

  // Only the address that repeats this page's own is withheld. The store's
  // logo goes to the store root and a product goes to its detail page; both
  // are destinations the model may need, and both still carry one.
  const addressed = packet.elements.filter((element) => element.href !== undefined);
  expect(addressed.length, "links off this page keep their address").toBeGreaterThan(0);
  for (const element of addressed) {
    expect(element.href, "every address published still says something new").not.toBe(packet.location);
  }
});

test("everything-store: the address the packet stops publishing is still on the wire", async ({ openHarness }) => {
  const harness = await openHarness("everything-store");
  await open(harness, "/scenarios/everything-store/s?k=wireless+earbuds", '[data-component="search-result"][data-sku][data-index="1"]');
  const snapshot = await harness.capture();

  // Only the packet's stripped duplicate goes. The descriptor still carries the
  // `href` attribute the author wrote -- query included, which the packet's
  // copy never had -- so recorded web state, the element fingerprint and every
  // other reader of the snapshot still has the real destination.
  const facet = snapshot.interactiveElements.find((element) => (element.accessibleName ?? element.visibleText) === "Brightaisle Plus");
  expect(facet, "the facet is in the snapshot").toBeDefined();
  expect(facet?.href, "the packet-facing address is withheld").toBeUndefined();
  expect(facet?.attributes?.href, "the authored address is not").toContain("?");
  expect(facet?.attributes?.href).toContain("k=wireless+earbuds");
});

test("crossborder-marketplace: the filters drawn as divs are in the packet", async ({ openHarness }) => {
  const harness = await openHarness("crossborder-marketplace");
  // The results arrive in two fetched batches, and the page has 292 elements
  // once they have. Measuring it before they land would measure a page whose
  // packet was never full, which is the state the defect hides in.
  await open(harness, "/scenarios/crossborder-marketplace/search?q=usb+c+hub", "a[href*='/item/']");
  await expect(harness.page.locator("a[href*='/item/']")).not.toHaveCount(0);
  const names = described(await packetOf(harness));

  // The three the site's own instruction turns on -- "ships from Spain, free
  // shipping, rated 4.5 or higher" -- and the rest of the rail beside them.
  for (const filter of ["Spain", "Free shipping", "4★ & up", "China", "Poland", "Czech Republic", "Hubsmith", "Voltbay"]) {
    expect(names, filter).toContain(filter);
  }
  // The button that applies the price range, and the sort the instruction asks
  // the results to keep. Both are `<div>`s here too.
  expect(names).toContain("OK");
  expect(names).toContain("Best Match");
  // The consent banner is drawn the same way, and the page behind it cannot be
  // narrowed until it is answered.
  expect(names).toContain("Accept all");
});

test("job-board: a clickable job card is not mistaken for a control", async ({ openHarness }) => {
  const harness = await openHarness("job-board");
  await open(harness, "/scenarios/job-board/jobs?q=rust", "body");
  const packet = await packetOf(harness);
  const names = described(packet);

  // Rolefinch draws twelve `<article>` job cards with a pointer cursor. They
  // are the page's contents, not controls of it, and promoting them would rank
  // the results ahead of every way of narrowing them. The four filter buttons,
  // the sort and the pager all stay ahead of the first card.
  const firstCard = packet.elements.findIndex((element) => element.tag === "article");
  expect(firstCard, "the page's cards are still described").toBeGreaterThan(0);
  for (const control of ["Date posted", "Job type", "Remote", "Salary", "date", "Next"]) {
    expect(names, control).toContain(control);
    expect(names.indexOf(control), `${control} ranks ahead of the results`).toBeLessThan(firstCard);
  }
});

test("bigbox-retail: a facet's count is not described a second time as a control", async ({ openHarness }) => {
  const harness = await openHarness("bigbox-retail");
  await open(harness, "/scenarios/bigbox-retail/search?q=paper+towels", "body");
  await harness.page.getByRole("button", { name: "Accept all", exact: true }).click();
  await expect(harness.page.getByRole("button", { name: "Accept all", exact: true })).toBeHidden();
  const names = described(await packetOf(harness));

  // ValueRidge's eighteen facets are checkboxes inside labels, and each label
  // holds a `<span>` with the match count. The span inherits the label's
  // pointer cursor, so it looks like a control and is not one: what there is to
  // press is the checkbox, which is already described with the count in its own
  // name. Eighteen `(28)`-shaped elements in the packet would be the whole rail
  // a second time.
  expect(names.filter((name) => /^\(\d+\)$/u.test(name)), "no facet count is described on its own").toEqual([]);
  for (const facet of ["ValueRidge (", "Pickup (", "Today (", "4 & up ("]) {
    expect(names.some((name) => name.startsWith(facet)), facet).toBe(true);
  }
});
