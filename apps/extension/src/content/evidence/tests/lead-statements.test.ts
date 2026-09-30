// What the page's main region says about itself, lifted to rank with the
// controls that change what it shows (`../lead-statements.ts`).
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

/** Document order over one built tree: position in its pre-order walk. */
function orderOf(root: Element): (left: Element, right: Element) => number {
  const positions = new Map(descendants(root).map((node, index) => [node, index] as const));
  return (left, right) => (positions.get(left) ?? 0) - (positions.get(right) ?? 0);
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
  return { page, count, emptyLine, adviceLine, sortLabel, railHeading, bannerLine, footerHeading, footerLine };
}

test("a search that found nothing: the count and both empty-state lines are lifted, in document order", async () => {
  await withStubPage(load, ({ mainLeadStatements }) => {
    const shown = noResultsPage();
    // Candidates arrive in gathering order, not document order: controls first, then text.
    const candidates = [shown.sortLabel, ...descendants(shown.page).reverse()];
    const lifted = [...mainLeadStatements(candidates, orderOf(shown.page))];
    assert.deepEqual(lifted.map(textOf), [
      "No results for \"a long query\"",
      "No results for a long query.",
      "Try checking your spelling or use more general terms."
    ]);
  });
});

test("the header's, the footer's and the filter rail's words are not the main region's own", async () => {
  await withStubPage(load, ({ mainLeadStatements }) => {
    const shown = noResultsPage();
    const lifted = mainLeadStatements(descendants(shown.page), orderOf(shown.page));
    for (const outside of [shown.bannerLine, shown.footerHeading, shown.footerLine, shown.railHeading]) {
      assert.equal(lifted.has(outside), false, textOf(outside));
    }
  });
});

test("a control's words are the control's, and a word inside a statement is the statement's", async () => {
  await withStubPage(load, ({ mainLeadStatements }) => {
    const shown = noResultsPage();
    const lifted = mainLeadStatements(descendants(shown.page), orderOf(shown.page));
    assert.equal(lifted.has(shown.sortLabel), false, "the sort's label");
    const strong = descendants(shown.emptyLine).find((node) => node.tagName === "STRONG");
    assert.ok(strong);
    assert.equal(lifted.has(strong), false, "the query in bold is part of its line, not a line of its own");
  });
});

test("at most three are lifted, the first three the region shows", async () => {
  await withStubPage(load, ({ mainLeadStatements }) => {
    const lines = ["One.", "Two.", "Three.", "Four.", "Five."].map((words) => element("p", {}, words));
    const page = element("main", {}, ...lines);
    const lifted = [...mainLeadStatements(descendants(page), orderOf(page))];
    assert.deepEqual(lifted.map(textOf), ["One.", "Two.", "Three."]);
  });
});

test("an item's own words and a long passage of prose stay where they rank", async () => {
  await withStubPage(load, ({ mainLeadStatements }) => {
    const itemPrice = element("p", {}, "$44.99");
    const item = withMatches(element("li", {}, element("span", {}, "Kettle"), itemPrice), ["li"]);
    const prose = element("p", {}, "word ".repeat(80));
    const status = element("p", {}, "1-16 of 42 results");
    const page = element("main", {}, element("ul", {}, item), prose, status);
    const lifted = [...mainLeadStatements(descendants(page), orderOf(page))];
    assert.deepEqual(lifted.map(textOf), ["1-16 of 42 results"]);
  });
});

test("a page with no main region lifts nothing, so it ranks as it always has", async () => {
  await withStubPage(load, ({ mainLeadStatements }) => {
    const page = element("div", {}, element("p", {}, "No results."), element("footer", {}, element("p", {}, "Help")));
    assert.equal(mainLeadStatements(descendants(page), orderOf(page)).size, 0);
  });
});
