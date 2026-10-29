// How a covering layer's own controls are worded (`../own-controls.ts`): a help-desk
// panel whose header has an icon-only collapse button and whose body is three links.

import assert from "node:assert/strict";
import test from "node:test";
import { layerControlWords, type LayerControlRead } from "../own-controls";

const link = (name: string): LayerControlRead => ({ name, iconOnly: false, inHeader: false, link: true });

test("the header's icon-only button leads, described by where it is and its label, and links are said apart as content", () => {
  const words = layerControlWords([
    link("Order status"), link("Returns policy"), link("Shipping times"),
    { name: "Send", iconOnly: false, inHeader: false, link: false },
    { name: "Minimise", iconOnly: true, inHeader: true, link: false }
  ]);
  assert.deepEqual(words.controls, [`a control with no words in the layer's header, named "Minimise"`, `"Send"`]);
  assert.deepEqual(words.links, [`"Order status"`, `"Returns policy"`, `"Shipping times"`]);
});

test("an icon-only control with no label is still listed", () => {
  const words = layerControlWords([{ name: undefined, iconOnly: true, inHeader: true, link: false }, link("Help")]);
  assert.deepEqual(words.controls, ["a control with no words in the layer's header"]);
});

test("an unnamed link is not listed, and extra controls are counted", () => {
  const many = Array.from({ length: 7 }, (_, index): LayerControlRead => ({ name: `B${index}`, iconOnly: false, inHeader: false, link: false }));
  const words = layerControlWords([{ name: undefined, iconOnly: false, inHeader: false, link: true }, ...many]);
  assert.equal(words.controls.length, 5);
  assert.equal(words.moreControls, 2);
  assert.deepEqual(words.links, []);
});
