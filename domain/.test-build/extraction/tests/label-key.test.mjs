// src/extraction/tests/label-key.test.ts
import assert from "node:assert/strict";
import test from "node:test";

// src/actions/extraction/field-key.ts
var FIELD_KEY_PATTERN = /^[A-Za-z0-9_-]{1,100}$/;
var RESERVED_FIELD_KEYS = /* @__PURE__ */ new Set(["__proto__", "constructor", "prototype"]);
function isWebAutomationExtractFieldKey(key) {
  return typeof key === "string" && FIELD_KEY_PATTERN.test(key) && !RESERVED_FIELD_KEYS.has(key);
}

// src/actions/extraction/read-request.ts
var REFUSED = Symbol("refused");

// src/extraction/label-key.ts
var MAX_KEY_LENGTH = 100;
var FALLBACK_KEY = "field";
var RESERVED_KEY_SUFFIX = "_field";
var OUTSIDE_KEY_CHARACTERS = /[^a-z0-9_-]+/u;
var COMBINING_MARKS = new RegExp("\\p{M}+", "gu");
function webAutomationExtractionFieldKey(label, taken) {
  const words = label.toLowerCase().normalize("NFKD").replace(COMBINING_MARKS, "").split(OUTSIDE_KEY_CHARACTERS).filter((word) => word.length > 0);
  let key = words.join("_").slice(0, MAX_KEY_LENGTH) || FALLBACK_KEY;
  if (!isWebAutomationExtractFieldKey(key)) key = `${key}${RESERVED_KEY_SUFFIX}`;
  if (!taken.has(key)) return key;
  for (let ordinal = 2; ; ordinal += 1) {
    const suffix = `_${ordinal}`;
    const candidate = `${key.slice(0, MAX_KEY_LENGTH - suffix.length)}${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
}

// src/extraction/tests/label-key.test.ts
var CORE_FIELD_ID_PATTERN = /^[A-Za-z0-9_-]{1,100}$/;
var PROTOTYPE_NAMES = ["__proto__", "constructor", "prototype"];
var none = /* @__PURE__ */ new Set();
test("a label becomes a lower-case key with each run of other characters as one underscore", () => {
  assert.equal(webAutomationExtractionFieldKey("Product name", none), "product_name");
  assert.equal(webAutomationExtractionFieldKey("Unit   price (USD)", none), "unit_price_usd");
  assert.equal(webAutomationExtractionFieldKey("price.amount", none), "price_amount");
  assert.equal(webAutomationExtractionFieldKey("unit_price", none), "unit_price");
  assert.equal(webAutomationExtractionFieldKey("e-mail address", none), "e-mail_address");
  assert.equal(webAutomationExtractionFieldKey("SKU-42", none), "sku-42");
});
test("no underscore is left at either end from a run that was dropped", () => {
  assert.equal(webAutomationExtractionFieldKey("Price ($)", none), "price");
  assert.equal(webAutomationExtractionFieldKey("  * Name *  ", none), "name");
});
test("accents are dropped rather than splitting a word", () => {
  assert.equal(webAutomationExtractionFieldKey("Pr\xE9nom", none), "prenom");
  assert.equal(webAutomationExtractionFieldKey("Stra\xDFe N\xBA", none), "stra_e_no");
});
test("a label with nothing a key can hold becomes field", () => {
  for (const label of ["", "   ", "\u20AC\u20AC\u20AC", "()", "\u4FA1\u683C", "\0	\n"]) {
    assert.equal(webAutomationExtractionFieldKey(label, none), "field", JSON.stringify(label));
  }
});
test("a prototype name is never returned", () => {
  assert.equal(webAutomationExtractionFieldKey("__proto__", none), "__proto___field");
  assert.equal(webAutomationExtractionFieldKey("constructor", none), "constructor_field");
  assert.equal(webAutomationExtractionFieldKey("Prototype", none), "prototype_field");
  assert.equal(webAutomationExtractionFieldKey(" constructor ", none), "constructor_field");
  assert.equal(webAutomationExtractionFieldKey("constructor", /* @__PURE__ */ new Set(["constructor_field"])), "constructor_field_2");
});
test("a key already taken gets the first free suffix", () => {
  assert.equal(webAutomationExtractionFieldKey("Price", /* @__PURE__ */ new Set(["price"])), "price_2");
  assert.equal(webAutomationExtractionFieldKey("Price", /* @__PURE__ */ new Set(["price", "price_2"])), "price_3");
  assert.equal(webAutomationExtractionFieldKey("Price", /* @__PURE__ */ new Set(["price", "price_3"])), "price_2");
  assert.equal(webAutomationExtractionFieldKey("Price", /* @__PURE__ */ new Set(["Price"])), "price");
  assert.equal(webAutomationExtractionFieldKey("", /* @__PURE__ */ new Set(["field"])), "field_2");
});
test("a long label is cut to 100 characters, and a suffix still fits", () => {
  const long = "a".repeat(150);
  assert.equal(webAutomationExtractionFieldKey(long, none), "a".repeat(100));
  assert.equal(webAutomationExtractionFieldKey(long, /* @__PURE__ */ new Set(["a".repeat(100)])), `${"a".repeat(98)}_2`);
  const taken = /* @__PURE__ */ new Set(["a".repeat(100)]);
  for (let ordinal = 2; ordinal <= 9; ordinal += 1) taken.add(`${"a".repeat(98)}_${ordinal}`);
  assert.equal(webAutomationExtractionFieldKey(long, taken), `${"a".repeat(97)}_10`);
  taken.add(`${"a".repeat(97)}_10`);
  assert.equal(webAutomationExtractionFieldKey(long, taken), `${"a".repeat(97)}_11`);
  for (const key of taken) assert.equal(key.length, 100, key);
});
test("every key returned is one Core and the parameter lift accept, and none is already taken", () => {
  const labels = [
    "Product name",
    "",
    " ",
    "__proto__",
    "constructor",
    "prototype",
    "PROTOTYPE",
    "Price",
    "price",
    "Price ($)",
    "a".repeat(150),
    `${"word ".repeat(40)}end`,
    "prix\u20AC",
    "\u4FA1\u683C",
    "Pr\xE9nom",
    "\u{1F600} rating",
    "tab	here",
    "semi;colon",
    "col:header",
    "dot.ted",
    "slash/ed",
    "__",
    "-",
    "0"
  ];
  const taken = /* @__PURE__ */ new Set();
  for (const label of [...labels, ...labels]) {
    const key = webAutomationExtractionFieldKey(label, taken);
    assert.match(key, CORE_FIELD_ID_PATTERN, JSON.stringify(label));
    assert.ok(!PROTOTYPE_NAMES.includes(key), JSON.stringify(label));
    assert.equal(isWebAutomationExtractFieldKey(key), true, JSON.stringify(label));
    assert.ok(!taken.has(key), `${JSON.stringify(label)} gave a key already taken: ${key}`);
    taken.add(key);
  }
});
