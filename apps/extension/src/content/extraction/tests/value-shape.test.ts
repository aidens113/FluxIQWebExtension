// The shape a column's label may carry in place of its values: `number` for a
// cart line's quantity, `currency amount` for its price, and nothing for
// anything that is not wholly one or the other.

import assert from "node:assert/strict";
import test from "node:test";
import { valueShape } from "../value-shape";

test("a quantity column is a number, and a price column a currency amount, so the two are told apart", () => {
  assert.equal(valueShape(["1", "2"]), "number");
  assert.equal(valueShape(["$79.99", "$12.49"]), "currency amount");
});

test("currency amounts are recognised by the symbol's Unicode category, on either side, with grouping and a sign", () => {
  assert.equal(valueShape(["€ 12,50", "1.299,00 €", "-£5", "¥1,200", "$1,299.00"]), "currency amount");
});

test("numbers take grouping, fractions and a sign", () => {
  assert.equal(valueShape(["1,234", "3.7", "-2", "  10  "]), "number");
});

test("empty samples are skipped, and a column with no value has no shape", () => {
  assert.equal(valueShape(["", " ", "4"]), "number");
  assert.equal(valueShape(["", "  "]), undefined);
  assert.equal(valueShape([]), undefined);
});

test("a column is shaped only when every value is: a mix, words, or a code is not", () => {
  assert.equal(valueShape(["1", "$2.00"]), undefined);
  assert.equal(valueShape(["3.7 out of 5 stars"]), undefined);
  assert.equal(valueShape(["SKU 123"]), undefined);
  assert.equal(valueShape(["USD 12.00"]), undefined);
  assert.equal(valueShape(["$"]), undefined);
  assert.equal(valueShape(["Delete"]), undefined);
});
