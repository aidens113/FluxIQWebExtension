// domain/src/extraction/tests/dataset-id.test.ts
import assert from "node:assert/strict";
import test from "node:test";

// domain/src/extraction/dataset-id.ts
var MAX_ID_LENGTH = 200;
var NONCE_PATTERN = /^[A-Za-z0-9._-]{1,64}$/u;
var SEPARATOR = ":";
var FALLBACK_NAME = "dataset";
var OUTSIDE_NAME_CHARACTERS = /[^a-z0-9._-]+/u;
var COMBINING_MARKS = new RegExp("\\p{M}+", "gu");
function webAutomationDatasetId(label, nonce) {
  if (!NONCE_PATTERN.test(nonce)) {
    throw new RangeError("A dataset id nonce must be 1 to 64 characters of A-Z, a-z, 0-9, '.', '_' or '-'.");
  }
  const words = label.toLowerCase().normalize("NFKD").replace(COMBINING_MARKS, "").split(OUTSIDE_NAME_CHARACTERS).filter((word) => word.length > 0);
  const name = words.join("-").slice(0, MAX_ID_LENGTH - SEPARATOR.length - nonce.length) || FALLBACK_NAME;
  return `${name}${SEPARATOR}${nonce}`;
}

// domain/src/extraction/tests/dataset-id.test.ts
var CORE_DATASET_ID_PATTERN = /^[A-Za-z0-9._:-]{1,200}$/;
var NONCE = "3f2c9a4e-6b1d-4c8e-9f0a-2d7e5b1c8a36";
test("the id is the reduced name, a colon, and the nonce", () => {
  assert.equal(webAutomationDatasetId("Product catalog", NONCE), `product-catalog:${NONCE}`);
  assert.equal(webAutomationDatasetId("Orders (2026 Q3)", "n1"), "orders-2026-q3:n1");
  assert.equal(webAutomationDatasetId("v1.2_prices", "n1"), "v1.2_prices:n1");
  assert.equal(webAutomationDatasetId("Commandes r\xE9gl\xE9es", "n1"), "commandes-reglees:n1");
});
test("a name with nothing an id can hold becomes dataset", () => {
  for (const label of ["", "  ", "\u20AC", "\u4FA1\u683C\u8868", "::"]) {
    assert.equal(webAutomationDatasetId(label, "n1"), "dataset:n1", JSON.stringify(label));
  }
});
test("the same name recorded again with a new nonce gets a new id", () => {
  assert.notEqual(webAutomationDatasetId("Products", "first"), webAutomationDatasetId("Products", "second"));
  assert.notEqual(webAutomationDatasetId("Products", "abc"), webAutomationDatasetId("Products", "ABC"));
});
test("a long name is cut so the whole id fits, and the nonce is kept whole", () => {
  const longest = "n".repeat(64);
  const id = webAutomationDatasetId("word ".repeat(100), longest);
  assert.equal(id.length, 200);
  assert.ok(id.endsWith(`:${longest}`));
  assert.equal(webAutomationDatasetId("a".repeat(300), NONCE), `${"a".repeat(200 - 1 - NONCE.length)}:${NONCE}`);
});
test("a nonce that cannot be kept as it is is refused, and the refusal does not repeat it", () => {
  const sentinel = "SENTINEL";
  for (const nonce of ["", `${sentinel}:x`, `${sentinel} x`, `${sentinel}/x`, `${sentinel}\xE9`, `${sentinel}${"x".repeat(57)}`]) {
    assert.throws(
      () => webAutomationDatasetId("Products", nonce),
      (error) => error instanceof RangeError && !error.message.includes(sentinel),
      JSON.stringify(nonce)
    );
  }
  assert.doesNotThrow(() => webAutomationDatasetId("Products", `${sentinel}${"x".repeat(56)}`));
});
test("every id returned is one Core accepts", () => {
  const labels = ["Products", "", "a".repeat(500), "\u4FA1\u683C", "\u{1F600} list", "tab	here", "col:one", "..", "-", "Stra\xDFe"];
  for (const label of labels) {
    for (const nonce of ["n", NONCE, "x".repeat(64), "A.b_C-9"]) {
      assert.match(webAutomationDatasetId(label, nonce), CORE_DATASET_ID_PATTERN, `${JSON.stringify(label)} ${nonce}`);
    }
  }
});
