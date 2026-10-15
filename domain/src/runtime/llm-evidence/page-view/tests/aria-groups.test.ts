// Option sets drawn without a fieldset (t610): a `role="radiogroup"` named by
// `aria-labelledby`, a `role="group"` named by `aria-label`, a fieldset nested
// in a group, and a group with no name, through the sanitizer into the
// published page. The nearest named group around a control is what its line
// ends with, and a group's name is a line once.
//
// The page is a theatre's seat-booking form, not one of the realistic scenarios.

import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeWebLlmSnapshotWithBindings } from "../../sanitize";
import { publishedWebLlmPage } from "../published-page";

type Raw = Record<string, unknown>;

const main = { landmark: "main" };

/** One raw element, laid out down the page: `row` places it, every element on screen. */
function raw(tagName: string, selector: string, row: number, fields: Raw = {}, context: Raw = main): Raw {
  const bounds = { x: 20, y: 100 + row * 24, width: 220, height: 20 };
  return { tagName, selector, documentBounds: bounds, bounds, isVisibleOnViewport: true, context, ...fields };
}

function choice(type: "radio" | "checkbox", selector: string, row: number, words: string, parent: number, context: Raw = main): Raw {
  return raw("input", selector, row, { inputType: type, accessibleName: words, checked: false, parent }, context);
}

const accessibility = { ...main, fieldsetLegend: "Access needs" };
const drinks = { ...main, fieldsetLegend: "Interval drinks" };

/** The booking form; parents written by index. */
const BOOKING: Raw[] = [
  /* 0  t1  */ raw("form", "#booking", 0),
  /* 1  t2  */ raw("span", "#seat-label", 1, { visibleText: "Seating area", attributes: { id: "seat-label" }, parent: 0 }),
  /* 2  t3  */ raw("div", "#seats", 2, { role: "radiogroup", accessibleName: "Seating area", attributes: { role: "radiogroup", "aria-labelledby": "seat-label" }, ownText: "", parent: 0 }),
  /* 3  t4  */ choice("radio", "#stalls", 2, "Stalls", 2),
  /* 4  t5  */ choice("radio", "#circle", 3, "Circle", 2),
  /* 5  t6  */ raw("div", "#extras", 4, { role: "group", accessibleName: "Extras", attributes: { role: "group", "aria-label": "Extras" }, ownText: "", parent: 0 }),
  /* 6  t7  */ choice("checkbox", "#programme", 5, "Printed programme", 5),
  /* 7  t8  */ raw("fieldset", "#drinks", 6, { parent: 5 }),
  /* 8  t9  */ raw("legend", "#drinks > legend", 6, { accessibleName: "Interval drinks", visibleText: "Interval drinks", parent: 7 }, drinks),
  /* 9  t10 */ choice("checkbox", "#wine", 7, "Glass of wine", 7, drinks),
  /* 10 t11 */ choice("checkbox", "#cloakroom", 8, "Cloakroom ticket", 5),
  /* 11 t12 */ raw("div", "#marketing", 9, { role: "group", attributes: { role: "group" }, ownText: "", parent: 0 }),
  /* 12 t13 */ choice("checkbox", "#newsletter", 9, "Send me the season brochure", 11),
  /* 13 t14 */ raw("div", "#access", 10, { role: "group", accessibleName: "Access needs", attributes: { role: "group", "aria-label": "Access needs" }, ownText: "", parent: 0 }),
  /* 14 t15 */ raw("fieldset", "#access-set", 10, { parent: 13 }),
  /* 15 t16 */ raw("legend", "#access-set > legend", 10, { accessibleName: "Access needs", visibleText: "Access needs", parent: 14 }, accessibility),
  /* 16 t17 */ choice("checkbox", "#wheelchair", 11, "Wheelchair space", 14, accessibility)
];

function bookingSnapshot(): Raw {
  return {
    url: "https://theatre.test/book/evening-performance",
    title: "Book seats",
    viewport: { width: 1280, height: 720, scrollX: 0, scrollY: 0, documentWidth: 1280, documentHeight: 720, devicePixelRatio: 1 },
    interactiveElements: BOOKING
  };
}

function bodyLines(): string[] {
  const page = publishedWebLlmPage(sanitizeWebLlmSnapshotWithBindings(bookingSnapshot()).evidence).page;
  return page.slice(page.indexOf("\n\n") + 2).split("\n").filter((line) => !line.startsWith("[") && !line.startsWith("-"));
}

test("each control ends with the nearest named group around it, a fieldset or an ARIA group", () => {
  assert.deepEqual(bodyLines(), [
    // aria-labelledby: the label's own line says the group's name, so the group gets none.
    "t2 \"Seating area\"",
    "t4 radio \"Stalls\" unchecked group=\"Seating area\"",
    "t5 radio \"Circle\" unchecked group=\"Seating area\"",
    // aria-label: no element carries the words, so the group's name is its own line.
    "t6 \"Extras\"",
    "t7 checkbox \"Printed programme\" unchecked group=\"Extras\"",
    // A fieldset inside the group is nearer: its legend names its options.
    "t9 \"Interval drinks\"",
    "t10 checkbox \"Glass of wine\" unchecked group=\"Interval drinks\"",
    "t11 checkbox \"Cloakroom ticket\" unchecked group=\"Extras\"",
    // An unnamed group names nothing.
    "t13 checkbox \"Send me the season brochure\" unchecked",
    // A group whose legend says its name: the legend's line, once.
    "t16 \"Access needs\"",
    "t17 checkbox \"Wheelchair space\" unchecked group=\"Access needs\""
  ]);
});

test("a group's name is printed once", () => {
  const lines = bodyLines();
  for (const name of ["\"Seating area\"", "\"Extras\"", "\"Access needs\""]) {
    assert.equal(lines.filter((line) => line.split(" group=")[0]!.includes(name)).length, 1, name);
  }
});
