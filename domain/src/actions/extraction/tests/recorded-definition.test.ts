// D3: a recorded extraction carries no value read from the page.
//
// The picker runs in the page, so the object it hands the recorder is
// page-adjacent and cannot be trusted to hold only what it declares. These rows
// are the proof that the reader rebuilds the definition rather than copying it:
// a planted sample, a planted key anywhere in the structure, and a key or
// dataset id Core would refuse all have to be gone or refused.

import assert from "node:assert/strict";
import test from "node:test";
import { webAutomationRecordedExtraction } from "../recorded-definition";

/** A string that must never survive into a recording, planted where a careless picker would put page content. */
const SAMPLE = "SENTINEL-PAGE-VALUE-A-RECORDING-MUST-NOT-CARRY";

function listDefinition(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    form: "list",
    datasetId: "products:4f1c9a",
    label: "Products",
    itemCount: 24,
    request: {
      item: "li.product",
      fields: {
        name: { kind: "text", selector: ".name" },
        price: { kind: "text", selector: ".price" }
      }
    },
    fieldLabels: { name: "Product name", price: "Price" },
    ...overrides
  };
}

test("a sample value planted beside the definition is dropped", () => {
  const definition = webAutomationRecordedExtraction(listDefinition({
    samples: [{ name: SAMPLE, price: SAMPLE }],
    preview: { rows: [[SAMPLE]] },
    itemText: SAMPLE
  }));
  assert.ok(definition, "the definition itself is still read");
  assert.equal(JSON.stringify(definition).includes(SAMPLE), false, "no planted value reaches the recording");
  assert.deepEqual(Object.keys(definition).sort(), ["datasetId", "fieldLabels", "form", "itemCount", "label", "request"]);
});

test("an unknown key inside the request and inside a field spec is dropped too", () => {
  // The copy has to be field by field all the way down: an unknown key one
  // level in is exactly where a passed-through object would leak.
  const definition = webAutomationRecordedExtraction(listDefinition({
    request: {
      item: "li.product",
      fields: { name: { kind: "text", selector: ".name", sampleValue: SAMPLE } },
      containerText: SAMPLE
    }
  }));
  assert.ok(definition);
  assert.equal(JSON.stringify(definition).includes(SAMPLE), false);
  assert.deepEqual(definition.form === "list" ? definition.request.fields : undefined, { name: { kind: "text", selector: ".name" } });
});

test("a field key a page could have produced is refused, whole", () => {
  // The key names a column in Core's dataset schema, which refuses this pattern
  // and the prototype names. Refusing here is what stops a Flow being built
  // around a candidate Core would reject at approval.
  //
  // What this rule does and does not do is worth being exact about. It refuses a
  // key that could not be a column id -- a label with a space, a dotted path, a
  // prototype name, one over Core's bound. It is not, and cannot be, a test of
  // whether the key came from the page: `ORDER-TOTAL` is a perfectly well-formed
  // key. Keys are structure because the picker derives them from labels with
  // `webAutomationExtractionFieldKey`; what keeps page *values* out is that this
  // reader copies field by field, which the rows above cover.
  for (const key of ["Product name", "price.amount", "__proto__", "constructor", "prototype", "a".repeat(101), "prix€"]) {
    const definition = webAutomationRecordedExtraction(listDefinition({
      request: { item: "li.product", fields: { [key]: { kind: "text" } } },
      fieldLabels: {}
    }));
    assert.equal(definition, undefined, `a field keyed ${key} is not recorded`);
  }
  assert.ok(
    webAutomationRecordedExtraction(listDefinition({
      request: { item: "li.product", fields: { "order-total_2": { kind: "text" } } },
      fieldLabels: {}
    })),
    "the key grammar Core accepts is accepted"
  );
});

test("a dataset id Core would refuse is refused here", () => {
  for (const datasetId of ["products/4f1c", "products 4f1c", ".", "..", "", "a".repeat(201), 7, null]) {
    assert.equal(webAutomationRecordedExtraction(listDefinition({ datasetId })), undefined, JSON.stringify(datasetId));
  }
  assert.ok(webAutomationRecordedExtraction(listDefinition({ datasetId: "products.v2:4f1c-9a_b" })), "the id grammar Core accepts is accepted");
});

test("a label for a field the request does not read is dropped, and a malformed one refuses the definition", () => {
  const dropped = webAutomationRecordedExtraction(listDefinition({
    fieldLabels: { name: "Product name", price: "Price", card_number: "Card number" }
  }));
  assert.deepEqual(dropped?.form === "list" ? dropped.fieldLabels : undefined, { name: "Product name", price: "Price" }, "a label for a column that is not read names nothing");
  for (const label of [7, "", "   ", "a".repeat(201)]) {
    assert.equal(webAutomationRecordedExtraction(listDefinition({ fieldLabels: { name: label } })), undefined, JSON.stringify(label));
  }
});

test("a definition whose request cannot be read is not a definition", () => {
  // The request reader is the one that decides what the page is asked to do, so
  // a request it refuses must not be recorded as one it would accept.
  for (const request of [undefined, {}, { item: "li" }, { item: "", fields: { name: "a" } }, { item: "li", fields: {} }, { item: "li", fields: { name: { kind: "sample" } } }]) {
    assert.equal(webAutomationRecordedExtraction(listDefinition({ request })), undefined, JSON.stringify(request));
  }
});

test("the single-value form records what to read and what the user called it", () => {
  assert.deepEqual(
    webAutomationRecordedExtraction({ form: "value", label: "Order total", read: { mode: "attribute", attribute: "data-total" }, value: SAMPLE, text: SAMPLE }),
    { form: "value", label: "Order total", read: { mode: "attribute", attribute: "data-total" } }
  );
  assert.deepEqual(webAutomationRecordedExtraction({ form: "value", label: "Heading", read: { mode: "text" } }), { form: "value", label: "Heading", read: { mode: "text" } });
  // An attribute is required by that mode and refused on every other, so a read
  // cannot name one value and return another.
  assert.equal(webAutomationRecordedExtraction({ form: "value", label: "Heading", read: { mode: "attribute" } }), undefined, "an attribute read must name its attribute");
  assert.equal(webAutomationRecordedExtraction({ form: "value", label: "Heading", read: { mode: "text", attribute: "href" } }), undefined, "a text read must not name one");
  assert.equal(webAutomationRecordedExtraction({ form: "value", label: "Heading", read: { mode: "innerText" } }), undefined, "an unknown mode is not a read");
});

test("anything that is not a declared form is not a definition", () => {
  for (const value of [undefined, null, "list", 7, [], { form: "table" }, {}, listDefinition({ form: undefined })]) {
    assert.equal(webAutomationRecordedExtraction(value), undefined, JSON.stringify(value) ?? "undefined");
  }
});

test("itemCount is a count, not text the page supplied", () => {
  assert.equal(webAutomationRecordedExtraction(listDefinition({ itemCount: 0 }))?.form === "list", true, "an empty list was still a list when it was picked");
  for (const itemCount of [-1, 1.5, "24", undefined, null]) {
    assert.equal(webAutomationRecordedExtraction(listDefinition({ itemCount })), undefined, JSON.stringify(itemCount));
  }
});
