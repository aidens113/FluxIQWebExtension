// A filter group's heading and the group each of its options sits in, through
// the whole path (t605): a raw capture shaped as the extension sends it, the
// sanitizer, the published page.
//
// On `run-mv8p37k8-f1a90624` the page view printed every option of a results
// sidebar and none of its `<legend>`s, so an option's checkbox read as a bare
// name with nothing to say what it filtered by. Two things were lost: the
// sanitizer dropped a legend's text for equalling its name, and the view reads
// a legend's words from its text alone; and the extension's
// `context.fieldsetLegend` never reached the packet.
//
// The page here is a library catalogue's search results, not the run's shop.

import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeWebLlmSnapshotWithBindings } from "../../sanitize";
import { publishedWebLlmPage } from "../published-page";

const ORIGIN = "https://library.test";

type Raw = Record<string, unknown>;

/** One raw element, laid out down the page: `row` places it, every element on screen. */
function raw(tagName: string, selector: string, row: number, fields: Raw = {}, context: Raw = {}): Raw {
  const bounds = { x: 20, y: 100 + row * 24, width: 220, height: 20 };
  return { tagName, selector, documentBounds: bounds, bounds, isVisibleOnViewport: true, context, ...fields };
}

const sidebar = { landmark: "complementary", heading: "Refine results" };
const format = { ...sidebar, fieldsetLegend: "Format" };
const language = { ...sidebar, fieldsetLegend: "Language" };

/** One option: a `<label>` holding its checkbox and its words, as most filter sidebars write it. Parents are written by the caller. */
function option(index: number, row: number, words: string, legend: Raw, checked = false): Raw[] {
  return [
    raw("label", `#opt-${index}`, row, { accessibleName: words, visibleText: words }, legend),
    raw("input", `#opt-${index} > input`, row, { inputType: "checkbox", accessibleName: words, checked }, legend)
  ];
}

function snapshot(elements: Raw[]): Raw {
  return {
    url: `${ORIGIN}/catalogue/search?q=river`,
    title: "Catalogue search: river",
    viewport: { width: 1280, height: 720, scrollX: 0, scrollY: 0, documentWidth: 1280, documentHeight: 720, devicePixelRatio: 1 },
    interactiveElements: elements
  };
}

function pageOf(elements: Raw[]): string {
  const page = publishedWebLlmPage(sanitizeWebLlmSnapshotWithBindings(snapshot(elements)).evidence).page;
  return page.slice(page.indexOf("\n\n") + 2);
}

/** The sidebar: a heading, then two fieldsets, each a legend and its options; parents written by index. */
const SIDEBAR: Raw[] = (() => {
  const elements: Raw[] = [
    /* 0 */ raw("aside", "aside", 0, {}, { landmark: "complementary" }),
    /* 1 */ raw("h2", "aside > h2", 0, { accessibleName: "Refine results", visibleText: "Refine results", parent: 0 }, { landmark: "complementary" }),
    /* 2 */ raw("fieldset", "#format", 1, { parent: 0 }, sidebar),
    /* 3 */ raw("legend", "#format > legend", 1, { accessibleName: "Format", visibleText: "Format", parent: 2 }, format),
    ...option(4, 2, "Audiobook (12)", format),
    ...option(6, 3, "Hardcover (4)", format, true),
    /* 8 */ raw("fieldset", "#language", 4, { parent: 0 }, sidebar),
    /* 9 */ raw("legend", "#language > legend", 4, { accessibleName: "Language", visibleText: "Language", parent: 8 }, language),
    ...option(10, 5, "English (9)", language)
  ];
  // Each option's label sits in its fieldset; each checkbox in its label.
  for (const [label, fieldset] of [[4, 2], [6, 2], [10, 8]] as const) {
    elements[label]!.parent = fieldset;
    elements[label + 1]!.parent = label;
  }
  return elements;
})();

test("a fieldset's legend gets its own line, before its options, and each option ends with its group", () => {
  assert.deepEqual(pageOf(SIDEBAR).split("\n"), [
    "[complementary]",
    "t2 h2 \"Refine results\"",
    "t4 \"Format\"",
    "t6 checkbox \"Audiobook (12)\" unchecked group=\"Format\"",
    "t8 checkbox \"Hardcover (4)\" checked group=\"Format\"",
    "t10 \"Language\"",
    "t12 checkbox \"English (9)\" unchecked group=\"Language\""
  ]);
});

test("a table's caption gets its own line", () => {
  const table: Raw[] = [
    /* 0 */ raw("table", "table", 0, {}, { landmark: "main" }),
    /* 1 */ raw("caption", "table > caption", 0, { accessibleName: "Opening hours", visibleText: "Opening hours", parent: 0 }, { landmark: "main" }),
    /* 2 */ raw("td", "td:nth-of-type(1)", 1, { accessibleName: "Monday", visibleText: "Monday", parent: 0 }, { landmark: "main", tablePosition: { row: 1, column: 1 } }),
    /* 3 */ raw("td", "td:nth-of-type(2)", 1, { accessibleName: "9:00-17:00", visibleText: "9:00-17:00", parent: 0 }, { landmark: "main", tablePosition: { row: 1, column: 2 } })
  ];
  const lines = pageOf(table).split("\n");
  assert.deepEqual(lines.filter((line) => !line.startsWith("[") && !line.startsWith("-")), [
    "t2 \"Opening hours\"",
    "t3 \"Monday\" @c1",
    "t4 \"9:00-17:00\" @c2"
  ]);
});

test("a heading drawn by role, and a label naming no control beside it, keep their words", () => {
  const elements: Raw[] = [
    /* 0 */ raw("div", "#results-title", 0, { role: "heading", accessibleName: "42 results", visibleText: "42 results" }, { landmark: "main" }),
    /* 1 */ raw("label", "#sort-label", 1, { accessibleName: "Sort by", visibleText: "Sort by" }, { landmark: "main" }),
    /* 2 */ raw("a", "#sort-relevance", 2, { accessibleName: "Relevance", visibleText: "Relevance", href: `${ORIGIN}/catalogue/search?q=river&sort=relevance` }, { landmark: "main" })
  ];
  const lines = pageOf(elements).split("\n");
  assert.deepEqual(lines.slice(1, 3), ["t1 \"42 results\"", "t2 \"Sort by\""]);
});

test("a label repeating the control beside it still folds into the control's line", () => {
  const page = pageOf(SIDEBAR);
  assert.equal(page.split("\"Audiobook (12)\"").length - 1, 1, "the option's words once, on its checkbox");
});
