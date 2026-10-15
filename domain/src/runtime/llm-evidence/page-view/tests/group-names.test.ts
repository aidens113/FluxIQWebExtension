// The group resolver's edges (t610, `../group-names.ts`) on hand-built packets
// from a recipe site's ingredient filter.

import assert from "node:assert/strict";
import test from "node:test";
import { webLlmGroupNames } from "../group-names";
import { webLlmPageTree } from "../page-tree";
import { bodyLines, fixturePacket, type FixtureElement } from "./packet-fixture";

function groupsOf(elements: readonly FixtureElement[]) {
  const packet = fixturePacket(elements);
  const groups = webLlmGroupNames(packet.elements, webLlmPageTree(packet.elements));
  return packet.elements.map((element) => groups.groupOf(element));
}

test("aria-labelledby is read from the packet where the capture gave the group no name", () => {
  assert.deepEqual(groupsOf([
    { tag: "h3", text: "Diet", attributes: [["id", "diet-h"]] },
    { tag: "div", role: "group", attributes: [["role", "group"], ["aria-labelledby", "diet-h"]] },
    { tag: "input", inputType: "checkbox", name: "Vegan", parent: "t2" }
  ]), [undefined, undefined, "Diet"]);
});

test("a group with neither aria-label nor aria-labelledby is passed over for the named one around it", () => {
  assert.deepEqual(groupsOf([
    { tag: "div", role: "radiogroup", name: "Cooking time", attributes: [["role", "radiogroup"], ["aria-label", "Cooking time"]] },
    { tag: "div", role: "group", parent: "t1" },
    { tag: "input", inputType: "radio", name: "Under 30 minutes", parent: "t2" }
  ]), [undefined, "Cooking time", "Cooking time"]);
});

test("a group labelled by an element with no line of its own still gets its line", () => {
  assert.deepEqual(bodyLines([
    { tag: "span", text: "Cuisine", hidden: true, attributes: [["id", "cuisine-h"]] },
    { tag: "div", role: "group", name: "Cuisine", attributes: [["role", "group"], ["aria-labelledby", "cuisine-h"]] },
    { tag: "input", inputType: "checkbox", name: "Thai", parent: "t2" }
  ]), ["t2 \"Cuisine\"", "t3 checkbox \"Thai\" group=\"Cuisine\""]);
});
