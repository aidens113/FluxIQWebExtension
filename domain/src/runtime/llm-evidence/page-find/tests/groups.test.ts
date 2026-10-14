// The group an option sits in, as a description and a search say it (t605): a
// raw capture shaped as the extension sends it -- `context.fieldsetLegend` on
// every element inside a fieldset -- through the sanitizer into
// `web.describe_element` and `web.find_on_page`. A search for the group's
// words finds the legend and every option under it.

import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeWebLlmSnapshotWithBindings } from "../../sanitize";
import { webLlmDescribeElement } from "../description";
import { webLlmFindOnPage } from "../search";

type Raw = Record<string, unknown>;

function raw(tagName: string, selector: string, row: number, fields: Raw, context: Raw): Raw {
  const bounds = { x: 20, y: 100 + row * 24, width: 220, height: 20 };
  return { tagName, selector, documentBounds: bounds, bounds, isVisibleOnViewport: true, context, ...fields };
}

const format = { landmark: "complementary", fieldsetLegend: "Format" };

function evidence() {
  return sanitizeWebLlmSnapshotWithBindings({
    url: "https://library.test/catalogue/search?q=river",
    title: "Catalogue search: river",
    viewport: { width: 1280, height: 720, scrollX: 0, scrollY: 0, documentWidth: 1280, documentHeight: 720, devicePixelRatio: 1 },
    interactiveElements: [
      /* t1 */ raw("fieldset", "#format", 0, {}, { landmark: "complementary" }),
      /* t2 */ raw("legend", "#format > legend", 0, { accessibleName: "Format", visibleText: "Format", parent: 0 }, format),
      /* t3 */ raw("input", "#audiobook", 1, { inputType: "checkbox", accessibleName: "Audiobook (12)", checked: false, attributes: { value: "format:audiobook" }, parent: 0 }, format),
      /* t4 */ raw("span", "#audiobook-count", 1, { visibleText: "12 titles", parent: 0 }, format),
      /* t5 */ raw("input", "#large-print", 2, { inputType: "checkbox", accessibleName: "Large print (3)", checked: true, parent: 0 }, { landmark: "complementary" })
    ]
  }).evidence;
}

test("a description names the group an option sits in, and a legend's words, as fields of the element", () => {
  const option = webLlmDescribeElement(evidence(), "t3").element.split("\n");
  assert.equal(option[0], "t3 <input> checkbox \"Audiobook (12)\"");
  assert.match(option[3]!, /^context: .* group="Format"/u);
  const legend = webLlmDescribeElement(evidence(), "t2").element.split("\n");
  assert.equal(legend[0], "t2 <legend> \"Format\"");
  assert.match(legend[3]!, /text="Format"/u, "the legend's words are kept beside its name");
  assert.doesNotMatch(legend[3]!, /group=/u, "a legend is not in a group of its own");
});

test("a search for a group's words finds the legend and every element in the group, and an option prints its group", () => {
  const found = webLlmFindOnPage(evidence(), "format", 0).found.split("\n");
  assert.deepEqual(found, [
    "3 matches for \"format\"",
    "t2 legend \"Format\" on screen",
    // Its group, not its `value` attribute, is what matched: the group is searched first.
    "t3 checkbox \"Audiobook (12)\" group=\"Format\" on screen",
    "t4 span \"12 titles\" (group=\"Format\") on screen"
  ]);
});

test("an option matched by its own words prints its group as its view line does", () => {
  const found = webLlmFindOnPage(evidence(), "audiobook", 0).found.split("\n");
  assert.deepEqual(found, [
    "1 match for \"audiobook\"",
    "t3 checkbox \"Audiobook (12)\" group=\"Format\" on screen"
  ]);
});
