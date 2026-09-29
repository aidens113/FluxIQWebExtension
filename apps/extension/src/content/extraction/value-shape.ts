// What a column's values look like, as one word the column's label can carry
// in place of the values themselves.
//
// **Why this exists.** A cart line's price (`$79.99`) and its quantity (`2`)
// are both text leaves. On a page whose class names are hashed, they were
// offered as `div > p.x9 > span` and `div > div.x3 > span.x4 > span.x5`. The
// model choosing columns is shown the label, the kind and the coverage, and
// nothing else (D3). A live build bound `price` to the quantity, and every row
// read `"1"` (`lane-run-mum06sfc-f1d9403f.md`, cause 2). Nothing it was shown
// could have told the two apart.
//
// A shape is not a value. It is one of two fixed words, and it says what the
// page's values are written as, never what they are:
//
// - `currency amount`: every value is a number with a currency symbol (Unicode
//   category `Sc`) on one side. A three-letter code is not taken as one:
//   `SKU 123` would read as money;
// - `number`: every value is a number and nothing else.
//
// These patterns read digits, separators and the currency-symbol category. They
// read no words, so the rule `value-statement.ts` sets against word lists
// holds. A shape changes only what a column is called. What the column reads
// stays the same, so a wrong shape costs a less helpful label, never a wrong
// value. A column with any value outside both patterns, or with no value at
// all, gets no shape and keeps its label as it was.

/**
 * A whole number with thousands grouping, or plain digits, either with an
 * optional fraction. Samples have their whitespace collapsed to one space
 * first, so a no-break space some locales group thousands with is a space here.
 */
const NUMBER = String.raw`(?:\d{1,3}(?:[,. ]\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?)`;

/** A currency symbol, by its Unicode category. */
const CURRENCY = String.raw`\p{Sc}`;

const SIGN = String.raw`[-+]?`;

const CURRENCY_AMOUNT = new RegExp(String.raw`^${SIGN}(?:${CURRENCY} ?${SIGN}${NUMBER}|${NUMBER} ?${CURRENCY})$`, "u");

const PLAIN_NUMBER = new RegExp(String.raw`^${SIGN}${NUMBER}$`, "u");

/**
 * The shape every non-empty sample shares, or `undefined` when they share none
 * or there is no non-empty sample. Samples are compared once whitespace is
 * collapsed. They are only matched here and never kept.
 */
export function valueShape(samples: readonly string[]): "currency amount" | "number" | undefined {
  const values = samples.map((sample) => sample.replace(/\s+/gu, " ").trim()).filter((sample) => sample !== "");
  if (values.length === 0) return undefined;
  if (values.every((value) => PLAIN_NUMBER.test(value))) return "number";
  if (values.every((value) => CURRENCY_AMOUNT.test(value))) return "currency amount";
  return undefined;
}
