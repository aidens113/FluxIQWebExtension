// What the page's main region says about itself, marked on each element that
// says it (`../lead-statements.ts`).
//
// The page below is the everything store's results page for a search that
// found nothing, as it is built (`apps/scenario-lab/src/scenarios/
// everything-store/pages/results/search.ts`): a results bar whose count reads
// "No results for ...", the filter rail in an `aside`, then the empty-state
// lines, with the site's header and footer around the main region. Live run 21
// (`run-muntufao-7b7bc04a`) searched with a query the store matched nothing
// for, and the packet the model was given held forty controls and none of
// those lines, so it read that page as results five times over.
//
// Until t200 the rule lifted the first three lines to the head of a ranked
// list. Nothing is ranked or cut now, so every line the rule recognises is
// marked, where the page put it.
//
// The DOM is a stub because the extension's unit runner is Node; the rule reads
// only tags, roles, text nodes and parents. Document order is the order the
// stub page was built in.

import assert from "node:assert/strict";
import test from "node:test";
import { withSelectorMemo } from "../../selector";
import { element, withStubPage } from "../../tests/stub-page";

type Module = typeof import("../lead-statements");

const load = (): Promise<Module> => import("../lead-statements");

/** Every element under `root`, root first, in document order. */
function descendants(root: Element): Element[] {
  return [root, ...(root as unknown as { querySelectorAll(selector: string): Element[] }).querySelectorAll("*")];
}

/** A record the page renders once per item, as `identity/record.ts` recognises one: an `<li>`. */
function withMatches(node: Element, tags: readonly string[]): Element {
  return Object.assign(node, { matches: (selector: string) => selector.split(",").some((part) => tags.includes(part.trim())) });
}

function textOf(node: Element): string {
  return node.textContent?.replace(/\s+/g, " ").trim() ?? "";
}

function noResultsPage() {
  const count = element("span", { "data-testid": "result-count" }, "No results for \"a long query\"");
  const sortLabel = element("label", { for: "sort" }, "Sort by:");
  const railHeading = element("p", {}, "Delivery");
  const railFacet = element("a", { href: "/s?rh=plus" }, element("span", {}, "Brightaisle Plus"));
  const emptyLine = element("p", {}, "No results for ", element("strong", {}, "a long query"), ".");
  const adviceLine = element("p", {}, "Try checking your spelling or use more general terms.");
  const main = element("main", {},
    element("div", {}, count, element("div", {}, sortLabel, element("select", { id: "sort" }))),
    element("div", {},
      element("aside", { "aria-label": "Filters" }, element("div", {}, railHeading, railFacet)),
      element("div", {}, element("div", {}, emptyLine, adviceLine))));
  const bannerLine = element("p", {}, "Exclusive app-only deals every day.");
  const footerHeading = element("p", {}, element("strong", {}, "Get to Know Us"));
  const footerLine = element("p", {}, "Conditions of use and privacy notice.");
  const page = element("div", {},
    element("header", {}, bannerLine, element("a", { href: "/cart" }, "Cart")),
    main,
    element("footer", {}, footerHeading, footerLine));
  return { page, count, emptyLine, adviceLine, sortLabel, railHeading, railFacet, bannerLine, footerHeading, footerLine };
}

test("a search that found nothing: the count and both empty-state lines are marked, and nothing else", async () => {
  await withStubPage(load, ({ isLeadStatement }) => {
    const shown = noResultsPage();
    const marked = descendants(shown.page).filter(isLeadStatement);
    assert.deepEqual(marked.map(textOf), [
      "No results for \"a long query\"",
      "No results for a long query.",
      "Try checking your spelling or use more general terms."
    ]);
  });
});

test("the header's, the footer's and the filter rail's words are not the main region's own", async () => {
  await withStubPage(load, ({ isLeadStatement }) => {
    const shown = noResultsPage();
    for (const outside of [shown.bannerLine, shown.footerHeading, shown.footerLine, shown.railHeading]) {
      assert.equal(isLeadStatement(outside), false, textOf(outside));
    }
  });
});

test("a control's words are the control's, and a word inside a statement is the statement's", async () => {
  await withStubPage(load, ({ isLeadStatement }) => {
    const shown = noResultsPage();
    assert.equal(isLeadStatement(shown.sortLabel), false, "the sort's label");
    const facetWords = descendants(shown.railFacet).find((node) => node.tagName === "SPAN");
    assert.ok(facetWords);
    assert.equal(isLeadStatement(facetWords), false, "a link's words");
    const strong = descendants(shown.emptyLine).find((node) => node.tagName === "STRONG");
    assert.ok(strong);
    assert.equal(isLeadStatement(strong), false, "the query in bold is part of its line, not a line of its own");
  });
});

test("every statement is marked, not the first three: there is no cap", async () => {
  await withStubPage(load, ({ isLeadStatement }) => {
    const words = ["One.", "Two.", "Three.", "Four.", "Five.", "Six.", "Seven."];
    const page = element("main", {}, ...words.map((line) => element("p", {}, line)));
    assert.deepEqual(descendants(page).filter(isLeadStatement).map(textOf), words);
  });
});

test("an item's own words and a long passage of prose are not statements", async () => {
  await withStubPage(load, ({ isLeadStatement }) => {
    const itemPrice = element("p", {}, "$44.99");
    const item = withMatches(element("li", {}, element("span", {}, "Kettle"), itemPrice), ["li"]);
    const prose = element("p", {}, "word ".repeat(80));
    const status = element("p", {}, "1-16 of 42 results");
    const page = element("main", {}, element("ul", {}, item), prose, status);
    assert.deepEqual(descendants(page).filter(isLeadStatement).map(textOf), ["1-16 of 42 results"]);
  });
});

test("a labelled region inside the main region is still the main region's", async () => {
  await withStubPage(load, ({ isLeadStatement }) => {
    const line = element("p", {}, "Your cart is empty.");
    element("main", {}, element("div", { role: "region", "aria-label": "Cart" }, line));
    assert.equal(isLeadStatement(line), true);
  });
});

test("a page with no main region has no lead statements", async () => {
  await withStubPage(load, ({ isLeadStatement }) => {
    const page = element("div", {}, element("p", {}, "No results."), element("footer", {}, element("p", {}, "Help")));
    assert.deepEqual(descendants(page).filter(isLeadStatement), []);
  });
});

/** `main` holding `count` short lines, each after a run of markup whitespace, then a container that has words of its own. */
function wideMain(count: number) {
  const lines = Array.from({ length: count }, (_, index) => element("p", {}, `Line ${index}.`));
  const talky = element("div", {}, "Words of its own ", element("em", {}, "and a child's"), ".");
  const main = element("main", {}, ...lines.flatMap((line) => ["\n  ", line]), talky);
  return { main, talky };
}

test("inside a capture the marks are the ones read outside it, on a wide region and on the store's empty results", async () => {
  await withStubPage(load, ({ isLeadStatement }) => {
    for (const page of [noResultsPage().page, wideMain(500).main]) {
      const elements = descendants(page);
      const outside = elements.map(isLeadStatement);
      const inside = withSelectorMemo(() => elements.map(isLeadStatement));
      assert.deepEqual(inside, outside);
    }
    const { main } = wideMain(3);
    assert.deepEqual(descendants(main).filter(isLeadStatement).map(textOf), ["Line 0.", "Line 1.", "Line 2.", "Words of its own and a child's."]);
  });
});

test("inside a capture a parent's own words are read once, however many children ask (t289)", async () => {
  await withStubPage(load, ({ isLeadStatement }) => {
    /** How often `main`'s child nodes are read while every element of a `count`-line region is asked. */
    const reads = (count: number): number => {
      const { main } = wideMain(count);
      const childNodes = (main as unknown as { childNodes: unknown[] }).childNodes;
      let read = 0;
      Object.defineProperty(main, "childNodes", { get: () => { read += 1; return childNodes; } });
      withSelectorMemo(() => descendants(main).forEach(isLeadStatement));
      return read;
    };
    // Read once per child before: 2 lines cost a handful of reads, 400 lines hundreds.
    assert.equal(reads(400), reads(2));
  });
});
