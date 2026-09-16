// A dataset's id (D16): readable from its name, unique by its nonce, and always
// one Core accepts. The nonce rows carry the weight. A re-recorded extraction
// must get a new id, so a nonce is never cut or rewritten into another's text.
//
// No page value appears here. Every label is a dataset name.

import assert from "node:assert/strict";
import test from "node:test";
import { webAutomationDatasetId } from "../dataset-id";

// Core's dataset id pattern, restated with a pointer: `datasetIdPattern`,
// `record-sets/output.ts:11` in Core's contracts.
const CORE_DATASET_ID_PATTERN = /^[A-Za-z0-9._:-]{1,200}$/;

const NONCE = "3f2c9a4e-6b1d-4c8e-9f0a-2d7e5b1c8a36";

test("the id is the reduced name, a colon, and the nonce", () => {
  assert.equal(webAutomationDatasetId("Product catalog", NONCE), `product-catalog:${NONCE}`);
  assert.equal(webAutomationDatasetId("Orders (2026 Q3)", "n1"), "orders-2026-q3:n1");
  assert.equal(webAutomationDatasetId("v1.2_prices", "n1"), "v1.2_prices:n1");
  assert.equal(webAutomationDatasetId("Commandes réglées", "n1"), "commandes-reglees:n1");
});

test("a name with nothing an id can hold becomes dataset", () => {
  for (const label of ["", "  ", "€", "価格表", "::"]) {
    assert.equal(webAutomationDatasetId(label, "n1"), "dataset:n1", JSON.stringify(label));
  }
});

test("the same name recorded again with a new nonce gets a new id", () => {
  assert.notEqual(webAutomationDatasetId("Products", "first"), webAutomationDatasetId("Products", "second"));
  // Nonces that differ only in case are two recordings, and stay two ids.
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
  for (const nonce of ["", `${sentinel}:x`, `${sentinel} x`, `${sentinel}/x`, `${sentinel}é`, `${sentinel}${"x".repeat(57)}`]) {
    assert.throws(
      () => webAutomationDatasetId("Products", nonce),
      (error: unknown) => error instanceof RangeError && !error.message.includes(sentinel),
      JSON.stringify(nonce)
    );
  }
  // The longest nonce that is kept.
  assert.doesNotThrow(() => webAutomationDatasetId("Products", `${sentinel}${"x".repeat(56)}`));
});

test("every id returned is one Core accepts", () => {
  const labels = ["Products", "", "a".repeat(500), "価格", "😀 list", "tab\there", "col:one", "..", "-", "Straße"];
  for (const label of labels) {
    for (const nonce of ["n", NONCE, "x".repeat(64), "A.b_C-9"]) {
      assert.match(webAutomationDatasetId(label, nonce), CORE_DATASET_ID_PATTERN, `${JSON.stringify(label)} ${nonce}`);
    }
  }
});
