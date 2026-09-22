// A Runtime Debug dataset preview row against the stored record it shows.

import assert from "node:assert/strict";
import test from "node:test";
import { previewRowMatches } from "../dataset-panel.js";

test("a preview row shows the record's schema fields in order, an absent value as a dash", () => {
  const record = { name: "Desk lamp", price: null, rating: "4.5" };
  assert.equal(previewRowMatches(["Desk lamp", "-", "4.5"], record, 3), true);
  assert.equal(previewRowMatches(["Desk lamp", "", "4.5"], record, 3), false);
  assert.equal(previewRowMatches(["4.5", "-", "Desk lamp"], record, 3), false);
});

test("a key past the schema's fields is not a column, and a missing or extra cell fails", () => {
  const record = { name: "Desk lamp", url: "/p/desk", unexpected: "x" };
  assert.equal(previewRowMatches(["Desk lamp", "/p/desk"], record, 2), true);
  assert.equal(previewRowMatches(["Desk lamp"], record, 2), false);
  assert.equal(previewRowMatches(["Desk lamp", "/p/desk", "x"], record, 2), false);
});
