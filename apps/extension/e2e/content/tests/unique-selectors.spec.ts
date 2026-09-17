// Every element a snapshot describes carries a selector that names exactly that
// element, on the page as captured.
//
// Why this is its own spec: a plan written by a model targets an element by an
// opaque handle, and the web domain resolves the handle to the selector the
// snapshot recorded (`domain/src/runtime/llm-evidence/plan-resolution/`). When
// several described elements share one selector -- every product link on the
// catalog used to be `[data-testid="product-link"]` -- the resolver has to
// refuse the handle as `web.handle.not_unique`, because acting on it would
// click the first match whatever the model meant. So the property measured
// here is the resolver's precondition:
//
// - on the Lab's list pages (catalog cards, a data table, a 240-row
//   directory), no two described elements share a selector;
// - each selector matches one element, and it is the element described --
//   checked against the descriptor's own xpath and tag, not merely a count;
// - a page that offers no unique anchor still gets a unique selector (duplicate
//   ids, repeated test ids with no unique container above them);
// - a selector never quotes a value or text, so a sensitive region's contents
//   cannot reach one.
//
// What it does not prove: selectors inside a shadow root (the resolver's
// `document.querySelector` never reached those either), and stability across
// a re-render that reorders a list -- a positional selector then names a
// different card, which is what the identity veto and scoring are for.

import type { Page } from "@playwright/test";
import type { DomElementDescriptor, DomSnapshot } from "../../../src/shared/protocol.js";
import { expect, test } from "../index.js";
import type { ContentHarness } from "../index.js";

/** Element kinds a plan clicks: the resolver's handle targets that matter most. */
const CLICKABLE_TAGS = new Set(["a", "button", "input", "select", "textarea", "summary", "label", "option"]);
const CLICKABLE_ROLES = new Set(["button", "link", "tab", "menuitem", "checkbox", "radio", "option", "switch", "row", "gridcell", "columnheader"]);

function clickable(descriptor: DomElementDescriptor): boolean {
  return CLICKABLE_TAGS.has(descriptor.tagName) ||
    Boolean(descriptor.hasClickHandler) ||
    (descriptor.role !== undefined && CLICKABLE_ROLES.has(descriptor.role));
}

type SelectorVerdict = {
  selector: string;
  tagName: string;
  matches: number;
  /** The one match is the element described, by every identity check that applied -- and at least one did. */
  sameElement: boolean;
  tagMatches: boolean;
};

/**
 * For each described element: how many elements its selector matches, and
 * whether the one match is the element described.
 *
 * "The element described" is established two independent ways, because the
 * selector under test cannot be its own oracle:
 *
 * - the descriptor's xpath, when it names exactly one node. `xpathFor` writes
 *   an id anchor as `/*[@id="x"]`, which XPath reads as "the root element, if
 *   its id is x", so an id-anchored xpath never resolves as written; it is read
 *   here as the `//*[@id="x"]` it was meant to be. (That defect is reported,
 *   not fixed here: it changes which replays the xpath fallback rescues.)
 * - the descriptor's page geometry, when the match has a box of its own: the
 *   match must sit exactly where the described element sat.
 */
async function verdicts(page: Page, descriptors: readonly DomElementDescriptor[]): Promise<SelectorVerdict[]> {
  return await page.evaluate((entries) => entries.map(({ selector, xpath, tagName, bounds }) => {
    let matched: Element[] = [];
    try { matched = [...document.querySelectorAll(selector)]; } catch { matched = []; }
    const match = matched.length === 1 ? matched[0]! : undefined;
    let checks = 0;
    let agrees = match !== undefined;
    if (match && xpath) {
      const readable = xpath.startsWith("/*[@id=") ? `/${xpath}` : xpath;
      const byXpath = document.evaluate(readable, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
      if (byXpath.snapshotLength === 1) {
        checks += 1;
        agrees &&= byXpath.snapshotItem(0) === match;
      }
    }
    if (match && bounds) {
      const rect = match.getBoundingClientRect();
      if (rect.width >= 2 && rect.height >= 2) {
        checks += 1;
        const near = (a: number, b: number) => Math.abs(a - b) <= 0.5;
        agrees &&= near(rect.left + window.scrollX, bounds.x) && near(rect.top + window.scrollY, bounds.y) &&
          near(rect.width, bounds.width) && near(rect.height, bounds.height);
      }
    }
    return {
      selector,
      tagName,
      matches: matched.length,
      sameElement: agrees && checks > 0,
      tagMatches: match !== undefined && match.tagName.toLowerCase() === tagName
    };
  }), descriptors.map((descriptor) => ({
    selector: descriptor.selector,
    xpath: descriptor.xpath,
    tagName: descriptor.tagName,
    bounds: descriptor.documentBounds
  })));
}

function duplicates(descriptors: readonly DomElementDescriptor[]): string[] {
  const seen = new Map<string, number>();
  for (const descriptor of descriptors) seen.set(descriptor.selector, (seen.get(descriptor.selector) ?? 0) + 1);
  return [...seen].filter(([, count]) => count > 1).map(([selector, count]) => `${count}x ${selector}`);
}

async function measure(harness: ContentHarness): Promise<{ snapshot: DomSnapshot; results: SelectorVerdict[]; captureMs: number }> {
  const started = Date.now();
  const snapshot = await harness.capture();
  const captureMs = Date.now() - started;
  const results = await verdicts(harness.page, snapshot.interactiveElements);
  return { snapshot, results, captureMs };
}

function expectAllUnique(snapshot: DomSnapshot, results: readonly SelectorVerdict[], label: string): void {
  const described = snapshot.interactiveElements;
  expect(described.length, `${label}: the snapshot describes elements`).toBeGreaterThan(0);
  expect(duplicates(described), `${label}: no two described elements share a selector`).toEqual([]);
  const wrong = results.filter((result) => result.matches !== 1 || !result.sameElement || !result.tagMatches);
  expect(wrong, `${label}: every selector matches exactly the element described`).toEqual([]);
}

const LIST_PAGES = [
  { scenarioId: "product-catalog", minClickables: 8 },
  { scenarioId: "data-table", minClickables: 1 },
  { scenarioId: "member-directory", minClickables: 1 }
] as const;

for (const { scenarioId, minClickables } of LIST_PAGES) {
  test(`${scenarioId}: every described element, and so every clickable, has a selector naming exactly that element`, async ({ openHarness }) => {
    const harness = await openHarness(scenarioId);
    const { snapshot, results } = await measure(harness);
    const clickables = snapshot.interactiveElements.filter(clickable);
    expect(clickables.length, `${scenarioId}: clickables are described`).toBeGreaterThanOrEqual(minClickables);
    expectAllUnique(snapshot, results, scenarioId);
    test.info().annotations.push({
      type: "measurement",
      description: `${scenarioId}: ${snapshot.interactiveElements.length} described, ${clickables.length} clickable, ` +
        `${results.filter((result) => result.matches === 1 && result.sameElement).length} resolve to exactly the element described`
    });
  });
}

test("product-catalog: each product link gets its own selector, and it still names the link by its test id", async ({ openHarness }) => {
  const harness = await openHarness("product-catalog");
  const snapshot = await harness.capture();
  const links = snapshot.interactiveElements.filter((descriptor) => descriptor.testId === "product-link");
  expect(links.length, "the catalog's product links are described").toBeGreaterThanOrEqual(8);
  expect(new Set(links.map((link) => link.selector)).size).toBe(links.length);
  for (const link of links) expect(link.selector).toContain(`[data-testid="product-link"]`);
  const hrefs = await harness.page.evaluate((selectors) => selectors.map((selector) =>
    (document.querySelector(selector) as HTMLAnchorElement | null)?.href ?? null), links.map((link) => link.selector));
  expect(hrefs).toEqual(links.map((link) => link.href ?? null));
});

test("an element whose own anchor is unique keeps the short selector it always had", async ({ openHarness }) => {
  const harness = await openHarness("product-catalog");
  await harness.page.evaluate(() => {
    document.body.insertAdjacentHTML("beforeend",
      `<section id="fx-anchors"><button id="fx-by-id">By id</button><button data-testid="fx-by-testid">By test id</button>` +
      `<input name="fx-by-name" aria-label="By name"></section>`);
  });
  const { snapshot, results } = await measure(harness);
  const selectors = snapshot.interactiveElements.map((descriptor) => descriptor.selector);
  expect(selectors).toEqual(expect.arrayContaining(["#fx-by-id", `[data-testid="fx-by-testid"]`, `input[name="fx-by-name"]`]));
  expectAllUnique(snapshot, results, "anchored controls");
});

test("repeated anchors with no unique container, and duplicate ids, still get selectors naming one element each", async ({ openHarness }) => {
  const harness = await openHarness("product-catalog");
  await harness.page.evaluate(() => {
    const rows = [1, 2, 3].map((number) =>
      `<div class="fx-row"><span>Row ${number}</span><button data-testid="fx-edit">Edit ${number}</button>` +
      `<button id="fx-dup">Delete ${number}</button><input name="fx-qty" aria-label="Quantity ${number}"></div>`).join("");
    // Two lists with the same shape and no identifier anywhere above the rows.
    document.body.insertAdjacentHTML("beforeend", `<div>${rows}</div><div>${rows}</div>`);
  });
  const { snapshot, results } = await measure(harness);
  const injected = snapshot.interactiveElements.filter((descriptor) =>
    descriptor.testId === "fx-edit" || descriptor.id === "fx-dup" || descriptor.attributes?.["name"] === "fx-qty");
  expect(injected.length, "all eighteen injected controls are described").toBe(18);
  expectAllUnique(snapshot, results, "repeated anchors");
});

test("a selector never quotes page text or a value, so a sensitive region's contents cannot reach one", async ({ openHarness }) => {
  const harness = await openHarness("product-catalog");
  const secret = "SYNTHETIC_SELECTOR_SECRET_DO_NOT_USE";
  await harness.page.evaluate((value) => {
    const rows = [1, 2].map(() =>
      `<li><label>Card <input autocomplete="cc-number" value="${value}" placeholder="${value}" title="${value}"></label>` +
      `<span data-sensitive="true" aria-label="${value}">${value}</span><button aria-label="${value}">${value}</button></li>`).join("");
    document.body.insertAdjacentHTML("beforeend", `<ul>${rows}</ul>`);
  }, secret);
  const { snapshot, results } = await measure(harness);
  expectAllUnique(snapshot, results, "sensitive rows");
  for (const descriptor of snapshot.interactiveElements) expect(descriptor.selector).not.toContain(secret);
  const evidence = JSON.stringify(snapshot.evidence ?? {});
  expect(evidence).not.toContain(secret);
});

test("a large page is described with unique selectors without making the snapshot slow", async ({ openHarness }) => {
  const harness = await openHarness("member-directory");
  // The directory's 240 rows, plus a grid of 1,200 repeated, unanchored controls.
  await harness.page.evaluate(() => {
    const cells = Array.from({ length: 1_200 }, (_, index) => `<div class="fx-cell"><a href="#c${index}">Cell ${index}</a></div>`).join("");
    document.body.insertAdjacentHTML("beforeend", `<div class="fx-grid">${cells}</div>`);
  });
  const { snapshot, results, captureMs } = await measure(harness);
  expectAllUnique(snapshot, results, "large page");
  test.info().annotations.push({ type: "measurement", description: `large page: ${snapshot.interactiveElements.length} described, capture ${captureMs} ms` });
  expect(captureMs, "the capture round trip stays interactive").toBeLessThan(5_000);
});
