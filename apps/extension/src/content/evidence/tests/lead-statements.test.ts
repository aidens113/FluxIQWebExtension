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
