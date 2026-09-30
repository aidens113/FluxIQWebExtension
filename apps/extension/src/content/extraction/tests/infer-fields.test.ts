// T1 coverage of what a proposed field says, which is decided without reading
// the page: decision D12's Exclude pre-selection for a sensitive source, and
// decision D16's optional field for one the page does not show in every item.
// Finding the sources needs a document, so which fields a real item exposes is
// proven by `e2e/content/tests/extraction/inference.spec.ts`.

import assert from "node:assert/strict";
import test from "node:test";
import { readField } from "../field-reader";
import { inferFields, proposedFieldSpec, type FieldSource } from "../infer-fields";
import { fakeShadowDom } from "./fake-shadow-dom";

const PRICE: FieldSource = { kind: "text", label: "product-price", selector: '[data-testid="product-price"]', sensitive: false };

test("a sensitive source is proposed excluded, so inference never proposes reading it", () => {
  const card: FieldSource = { kind: "value", label: "card-number", selector: 'input[name="card"]', sensitive: true };
  assert.deepEqual(proposedFieldSpec(card, 1), {
    kind: "value",
    selector: 'input[name="card"]',
    required: true,
    handling: "exclude"
  });
});

test("every kind is excluded when its element is sensitive, not only a control's value", () => {
  for (const kind of ["text", "link", "value", "attribute", "column"] as const) {
    const spec = proposedFieldSpec({ ...PRICE, kind, sensitive: true }, 1);
    assert.equal(spec.handling, "exclude", kind);
  }
});

test("an ordinary source carries no handling at all, so the picker's own default decides", () => {
  const spec = proposedFieldSpec(PRICE, 1);
  assert.ok(!Object.prototype.hasOwnProperty.call(spec, "handling"), JSON.stringify(spec));
  assert.deepEqual(spec, { kind: "text", selector: '[data-testid="product-price"]', required: true });
});

test("a field some items lack is proposed optional, so a record without it carries null", () => {
  assert.equal(proposedFieldSpec(PRICE, 0.75).required, false);
  assert.equal(proposedFieldSpec(PRICE, 0).required, false);
  assert.equal(proposedFieldSpec(PRICE, 1).required, true);
});

test("an attribute source names its attribute and a column source its header, and neither carries the other", () => {
  const image = proposedFieldSpec({ kind: "attribute", label: "product-image src", selector: "img", attribute: "src", sensitive: false }, 1);
  assert.deepEqual(image, { kind: "attribute", selector: "img", attribute: "src", required: true });
  const column = proposedFieldSpec({ kind: "column", label: "Price", header: "Price", columnIndex: 2, sensitive: false }, 1);
  assert.deepEqual(column, { kind: "column", header: "Price", required: true });
});

// And the one source decided on a document here: an element whose words the
// page draws only in an open shadow root. The professional network's sent
// invitations draw each request's age as a childless `gl-time-ago` whose
// shadow root holds "Sent 1 month ago", and until 2026-09-30 no column was
// proposed for it, so "a month or more ago" had nothing to filter on.

const dom = fakeShadowDom();

function sentRow(name: string, age: string | undefined): Element {
  const time = dom.el("gl-time-ago", { datetime: "2026-08-19T08:00:00.000Z", format: "sent" });
  if (age !== undefined) dom.shadow(time, dom.el("span", {}, age));
  return dom.el("li", { "data-entity-urn": "urn:gl:invitation:1" },
    dom.el("div", {}, dom.el("div", {}, dom.el("strong", {}, name)), dom.el("div", {}, "Data engineer"), time),
    dom.el("div", {}, dom.el("button", { type: "button" }, "Withdraw")));
}

test("an element whose words are only in its open shadow root is proposed as a text column that reads them", () => {
  const run = [sentRow("Aoife Brennan", "Sent 1 month ago"), sentRow("Rosa Meijer", "Sent 4 weeks ago"), sentRow("Marit Dekker", "Sent 8 months ago")];
  const fields = inferFields(run[0]!, run);
  const age = fields.find((field) => field.spec.kind === "text" && field.spec.selector?.endsWith("gl-time-ago") === true);
  assert.ok(age, JSON.stringify(fields.map((field) => field.spec)));
  assert.equal(age.coverage, 1);
  assert.equal(age.spec.required, true);
  // The label is page structure, never the words read (D3).
  assert.doesNotMatch(age.label, /month|week|Sent/u);
  const reader = { kind: "text" as const, selector: age.spec.selector!, required: true };
  assert.deepEqual(run.map((row) => readField(row, age.key, reader)), ["Sent 1 month ago", "Sent 4 weeks ago", "Sent 8 months ago"]);
});

test("an element with no words in its light DOM or its shadow root is not proposed", () => {
  const run = [sentRow("Aoife Brennan", undefined), sentRow("Rosa Meijer", undefined)];
  const fields = inferFields(run[0]!, run);
  assert.equal(fields.some((field) => field.spec.selector?.endsWith("gl-time-ago") === true), false, JSON.stringify(fields.map((field) => field.spec)));
});
