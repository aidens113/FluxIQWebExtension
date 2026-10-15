// The group an option sits in when the page draws its option set as an ARIA
// group rather than a fieldset (t610), as a description and a search say it:
// a raw capture through the sanitizer into `web.describe_element` and
// `web.find_on_page`. The capture carries no `fieldsetLegend` here; the group
// is read from the packet's tree.
//
// The page is a bicycle-hire booking form, not one of the realistic scenarios.

import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeWebLlmSnapshotWithBindings } from "../../sanitize";
import { webLlmDescribeElement } from "../description";
import { webLlmFindOnPage } from "../search";

type Raw = Record<string, unknown>;

function raw(tagName: string, selector: string, row: number, fields: Raw): Raw {
  const bounds = { x: 20, y: 100 + row * 24, width: 220, height: 20 };
  return { tagName, selector, documentBounds: bounds, bounds, isVisibleOnViewport: true, context: { landmark: "main" }, ...fields };
}

function evidence() {
  return sanitizeWebLlmSnapshotWithBindings({
    url: "https://bikehire.test/book",
    title: "Hire a bike",
    viewport: { width: 1280, height: 720, scrollX: 0, scrollY: 0, documentWidth: 1280, documentHeight: 720, devicePixelRatio: 1 },
    interactiveElements: [
      /* t1 */ raw("span", "#frame-label", 0, { visibleText: "Frame size", attributes: { id: "frame-label" } }),
      /* t2 */ raw("div", "#frame", 1, { role: "radiogroup", accessibleName: "Frame size", attributes: { role: "radiogroup", "aria-labelledby": "frame-label" }, ownText: "" }),
      /* t3 */ raw("input", "#frame-m", 1, { inputType: "radio", accessibleName: "Medium", checked: false, attributes: { value: "frame:m" }, parent: 1 }),
      /* t4 */ raw("div", "#addons", 2, { role: "group", accessibleName: "Add-ons", attributes: { role: "group", "aria-label": "Add-ons" }, ownText: "" }),
      /* t5 */ raw("input", "#helmet", 3, { inputType: "checkbox", accessibleName: "Helmet", checked: false, parent: 3 }),
      /* t6 */ raw("span", "#helmet-note", 3, { visibleText: "One size fits most", parent: 3 }),
      /* t7 */ raw("div", "#other", 4, { role: "group", attributes: { role: "group" }, ownText: "" }),
      /* t8 */ raw("input", "#lock", 4, { inputType: "checkbox", accessibleName: "Lock", checked: false, parent: 6 })
    ]
  }).evidence;
}

test("a description names the ARIA group an option sits in, and an unnamed group names nothing", () => {
  const medium = webLlmDescribeElement(evidence(), "t3").element.split("\n");
  assert.equal(medium[0], "t3 <input> radio \"Medium\"");
  assert.match(medium[3]!, /^context: .* group="Frame size"/u);
  assert.match(webLlmDescribeElement(evidence(), "t5").element.split("\n")[3]!, / group="Add-ons"/u);
  assert.doesNotMatch(webLlmDescribeElement(evidence(), "t8").element, /group=/u, "an unnamed group names nothing");
  assert.doesNotMatch(webLlmDescribeElement(evidence(), "t1").element, /group=/u, "the label is outside the group it names");
});

test("a search for an ARIA group's name finds every element in the group, and a control prints its group", () => {
  assert.deepEqual(webLlmFindOnPage(evidence(), "add-ons", 0).found.split("\n"), [
    "3 matches for \"add-ons\"",
    "t4 div \"Add-ons\" on screen",
    "t5 checkbox \"Helmet\" group=\"Add-ons\" on screen",
    "t6 span \"One size fits most\" (group=\"Add-ons\") on screen"
  ]);
  assert.deepEqual(webLlmFindOnPage(evidence(), "medium", 0).found.split("\n"), [
    "1 match for \"medium\"",
    "t3 radio \"Medium\" group=\"Frame size\" on screen"
  ]);
});
