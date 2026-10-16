// A page's option groups and result count, as data beside the view (t655): a
// raw capture shaped as the extension sends it, through the sanitizer. A
// library catalogue's search results, not any realistic scenario's site.

import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeWebLlmSnapshotWithBindings } from "../../sanitize";
import { webLlmPageOptionGroups, webLlmPageResultCount } from "..";

const ORIGIN = "https://library.test";

type Raw = Record<string, unknown>;

function raw(tagName: string, selector: string, row: number, fields: Raw = {}, context: Raw = {}): Raw {
  const bounds = { x: 20, y: 100 + row * 24, width: 220, height: 20 };
  return { tagName, selector, documentBounds: bounds, bounds, isVisibleOnViewport: true, context, ...fields };
}

const sidebar = { landmark: "complementary", heading: "Refine results" };
const format = { ...sidebar, fieldsetLegend: "Format" };

function option(index: number, row: number, words: string, legend: Raw, checked: boolean): Raw[] {
  return [
    raw("label", `#opt-${index}`, row, { accessibleName: words, visibleText: words }, legend),
    raw("input", `#opt-${index} > input`, row, { inputType: "checkbox", accessibleName: words, checked }, legend)
  ];
}

/** A results page: its count, a Format fieldset with `chosen` checked, and a sort link outside any group. */
function page(chosen: string | undefined, results: string): Raw[] {
  const elements: Raw[] = [
    /* 0 */ raw("aside", "aside", 0, {}, { landmark: "complementary" }),
    /* 1 */ raw("fieldset", "#format", 1, { parent: 0 }, sidebar),
    /* 2 */ raw("legend", "#format > legend", 1, { accessibleName: "Format", visibleText: "Format", parent: 1 }, format),
    ...option(3, 2, "Hardcover (40)", format, chosen === "Hardcover"),
    ...option(5, 3, "Paperback (12)", format, chosen === "Paperback"),
    ...option(7, 4, "Audiobook (1,204)", format, chosen === "Audiobook"),
    /* 9 */ raw("p", "#count", 5, { accessibleName: results, visibleText: results }, { landmark: "main" }),
    /* 10 */ raw("a", "#sort", 6, { accessibleName: "Sort by title", visibleText: "Sort by title", href: `${ORIGIN}/search?sort=title` }, { landmark: "main" })
  ];
  for (const [label, fieldset] of [[3, 1], [5, 1], [7, 1]] as const) {
    elements[label]!.parent = fieldset;
    elements[label + 1]!.parent = label;
  }
  return elements;
}

function packet(elements: Raw[]) {
  return sanitizeWebLlmSnapshotWithBindings({
    url: `${ORIGIN}/search?q=river`,
    title: "Catalogue search",
    viewport: { width: 1280, height: 720, scrollX: 0, scrollY: 0, documentWidth: 1280, documentHeight: 720, devicePixelRatio: 1 },
    interactiveElements: elements
  }).evidence;
}

test("a group's options say their words, the count the page shows beside each, and which is chosen", () => {
  assert.deepEqual(webLlmPageOptionGroups(packet(page("Hardcover", "Showing 1-20 of 40 results"))), [{
    name: "Format",
    options: [
      { words: "Hardcover", count: 40, chosen: true },
      { words: "Paperback", count: 12, chosen: false },
      { words: "Audiobook", count: 1204, chosen: false }
    ]
  }]);
});

test("a control in no named group is no option, and a page without groups says none", () => {
  const groups = webLlmPageOptionGroups(packet(page(undefined, "40 results")));
  assert.equal(groups.flatMap((group) => group.options).some((option) => option.words.startsWith("Sort")), false);
  assert.deepEqual(webLlmPageOptionGroups(packet([raw("a", "#home", 0, { accessibleName: "Home", visibleText: "Home", href: `${ORIGIN}/` }, { landmark: "main" })])), []);
});

test("the one number of results the page states, and none where it states none or several", () => {
  assert.equal(webLlmPageResultCount(packet(page("Hardcover", "Showing 1-20 of 1,240 results"))), 1240);
  assert.equal(webLlmPageResultCount(packet(page("Hardcover", "Refine your search"))), undefined);
  assert.equal(webLlmPageResultCount(packet(page("Hardcover", "40 results, 12 items in your basket"))), undefined);
});
