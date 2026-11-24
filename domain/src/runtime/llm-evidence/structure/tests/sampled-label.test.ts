// A readable label built from a sample is recognised, so a saved read's schema
// from before t997 loses it (`../sampled-label.ts`); page words are not.

import assert from "node:assert/strict";
import test from "node:test";
import { webLlmSampledLabel } from "../sampled-label";

test("every shape the field sample builds is recognised, a state mark's note included", () => {
  for (const label of ["link: 'A synthetic title'", "text: '3 synthetic reviews'", "price: '9,87 €'", "number: '42'", "lines: 'Today · Tomorrow'", "button: 'Go'", "heading: 'A heading'", "image: '/a.png'", "button: 'Follow' (pressed)"]) {
    assert.equal(webLlmSampledLabel(label), true, label);
  }
});

test("a label the page wrote in words, a path or a bare element word is not a sample", () => {
  for (const label of ["Price", "Brightaisle Plus", "data-testid", "div.x1a > span.x2b", "span:2", "link", "item url", "Note: 'quoted' here"]) {
    assert.equal(webLlmSampledLabel(label), false, label);
  }
});
