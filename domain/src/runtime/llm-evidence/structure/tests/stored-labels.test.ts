// One stored label per field, none a declaration could bind to the wrong field,
// and none carrying a page value to tell two apart (t997, `../stored-labels.ts`).
// Core binds an exact id first, then the one field whose label folds to the
// name (`packages/contracts/src/record-sets/process/binding/bind.ts`).

import assert from "node:assert/strict";
import test from "node:test";
import { webLlmUniqueStoredLabels } from "../stored-labels";

test("distinct labels are kept as they are", () => {
  assert.deepEqual(webLlmUniqueStoredLabels([{ id: "title", label: "Title" }, { id: "rate", label: "rate" }, { id: "badge", label: "Member badge" }]), ["Title", "rate", "Member badge"]);
});

test("a repeated label is told apart by its field's id and a number, never a value", () => {
  assert.deepEqual(webLlmUniqueStoredLabels([{ id: "price", label: "Price" }, { id: "price_2", label: "Price" }, { id: "price_3", label: "PRICE" }]), ["Price", "Price (price_2 2)", "PRICE (price_3 2)"]);
});

test("a label that folds to another field's id is not given, so a name binds one field only", () => {
  // `Rate` on `cost` would bind `RATE` to `cost` and `rate` to `rate`.
  assert.deepEqual(webLlmUniqueStoredLabels([{ id: "cost", label: "Rate" }, { id: "rate", label: "rate" }]), ["Rate (cost 2)", "rate"]);
  // Whichever comes first: ids are reserved before any label is given.
  assert.deepEqual(webLlmUniqueStoredLabels([{ id: "rate", label: "rate" }, { id: "cost", label: "RATE" }]), ["rate", "RATE (cost 2)"]);
});

test("a field may carry its own id as its label", () => {
  assert.deepEqual(webLlmUniqueStoredLabels([{ id: "member_badge", label: "member_badge" }]), ["member_badge"]);
  // A model's name for a detected column keeps the detected key as its label while no field has that id.
  assert.deepEqual(webLlmUniqueStoredLabels([{ id: "badge", label: "member_badge" }, { id: "rate", label: "rate" }]), ["member_badge", "rate"]);
  // When one does, the id binds that field and the label steps aside.
  assert.deepEqual(webLlmUniqueStoredLabels([{ id: "badge", label: "member_badge" }, { id: "member_badge", label: "Rating" }]), ["member_badge (badge 2)", "Rating"]);
});

test("labels stay within Core's bound", () => {
  const long = "w".repeat(250);
  const [first, second] = webLlmUniqueStoredLabels([{ id: "a", label: long }, { id: "b", label: long }]);
  assert.equal(first?.length, 200);
  assert.ok((second?.length ?? 0) <= 200);
  assert.notEqual(first, second);
});
