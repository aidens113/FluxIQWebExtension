// One page element reduced to a packet element -- and, above all, the elements
// that must never become one.
//
// The sensitivity half of this file is a leak proof. Until Wave 3 this module
// carried its own copy of the sensitivity rule that compared the whole
// `autocomplete` attribute instead of its tokens, so a card field marked
// `billing cc-number` -- the ordinary form, and the form that leaked a card
// number in Wave 2 -- was described in the packet an LLM reads, complete with
// its selector, name and form. The extension's copy of the rule had caught
// that form since Wave 1. The two copies disagreed and only one of them was
// tested.
//
// No value appears in these rows: a packet element never carries one, and the
// point of the sensitive rows is that the element itself does not appear.

import assert from "node:assert/strict";
import test from "node:test";
import { sanitizedEvidenceElement, type EvidenceElementContext } from "../elements";

const CONTEXT: EvidenceElementContext = { target: "tab.1", url: new URL("https://fixture.test/checkout") };

function described(raw: Record<string, unknown>): ReturnType<typeof sanitizedEvidenceElement> {
  return sanitizedEvidenceElement({ tagName: "input", selector: "#field", ...raw }, CONTEXT);
}

test("a multi-token card autocomplete is refused, which the module's own copy of the rule allowed through", () => {
  for (const autocomplete of ["billing cc-number", "shipping cc-exp", "section-pay billing cc-csc"]) {
    assert.equal(described({ attributes: { autocomplete } }), undefined, autocomplete);
  }
});

test("the card autocomplete is found however far into the attribute it sits", () => {
  // The old copy cut the attribute to 200 characters before reading it.
  const padded = `${"section-x ".repeat(60)}billing cc-number`;
  assert.equal(described({ attributes: { autocomplete: padded } }), undefined);
});

test("every control the old copy already refused is still refused", () => {
  assert.equal(described({ inputType: "password" }), undefined);
  assert.equal(described({ attributes: { autocomplete: "current-password" } }), undefined);
  assert.equal(described({ attributes: { autocomplete: "new-password" } }), undefined);
  assert.equal(described({ attributes: { autocomplete: "one-time-code" } }), undefined);
  assert.equal(described({ attributes: { autocomplete: "cc-number" } }), undefined);
  assert.equal(described({ attributes: { "data-sensitive": "true" } }), undefined);
});

test("the raw type attribute is enough on its own", () => {
  // A descriptor whose `inputType` was never derived still names the control.
  assert.equal(described({ attributes: { type: "password" } }), undefined);
});

test("an ordinary control is still described in full", () => {
  const element = described({
    inputType: "email",
    name: "Email",
    attributes: { autocomplete: "email" }
  });
  assert.equal(element?.element.tag, "input");
  assert.equal(element?.element.name, "Email");
  assert.equal(element?.element.inputType, "email");
  // Described and addressable, but the two are handed back separately: only the
  // first of them may be published to a model.
  assert.equal(Object.hasOwn(element!.element, "selector"), false);
  assert.equal(element?.selector, "#field");
});

test("a hidden or file input is described here, because they are not secrets", () => {
  // Reusable evidence keeps them out of its fingerprint by asking its own,
  // separately named question. The packet's rule is about secrets and must not
  // acquire that one by accident.
  assert.notEqual(described({ inputType: "file", name: "Receipt" }), undefined);
  assert.notEqual(described({ inputType: "hidden" }), undefined);
});

test("an element with no tag or no selector cannot be addressed and is dropped", () => {
  assert.equal(sanitizedEvidenceElement({ selector: "#field" }, CONTEXT), undefined);
  assert.equal(sanitizedEvidenceElement({ tagName: "input" }, CONTEXT), undefined);
  assert.equal(sanitizedEvidenceElement("input#field", CONTEXT), undefined);
});

test("an element's accessible name reaches the packet under the field the extension actually sends", () => {
  // The extension's gateway payload names it `accessibleName`. This module read
  // only `name`, so every real packet lost the label while fixtures built with
  // `name` kept passing -- the model repaired drifted controls without their names.
  const button = sanitizedEvidenceElement({ tagName: "button", selector: "#save", role: "button", accessibleName: "Save settings" }, CONTEXT);
  assert.equal(button?.element.name, "Save settings");
  // A producer that still says `name` is read too, and `accessibleName` wins where both are present.
  assert.equal(sanitizedEvidenceElement({ tagName: "button", selector: "#a", name: "Apply" }, CONTEXT)?.element.name, "Apply");
  assert.equal(sanitizedEvidenceElement({ tagName: "button", selector: "#b", name: "stale", accessibleName: "Current" }, CONTEXT)?.element.name, "Current");
});

// One example per repeating control (`apps/extension/src/content/repeat-exemplars.ts`).
// The page counts the run and puts the count on the exemplar; the packet
// carries it under its own word, so a model shown one row checkbox knows it
// stands for 280.
test("a run's size reaches the packet as `repeats`, and a count that says nothing does not", () => {
  const exemplar = (repeatCount: unknown) => sanitizedEvidenceElement({
    tagName: "input",
    selector: '[data-testid="queue-rows"] > tr:nth-of-type(1) > td:nth-of-type(1) > input',
    inputType: "checkbox",
    accessibleName: "Select the post for Mon 21 Sep 2026, 09:00",
    repeatCount
  }, CONTEXT)?.element.repeats;
  assert.equal(exemplar(280), 280);
  assert.equal(exemplar(2), 2);
  // One is not a run, and a count the page could not have taken is not a count.
  for (const nothing of [undefined, 1, 0, -3, 2.5, "280", 1_000_000]) assert.equal(exemplar(nothing), undefined, String(nothing));
});

// The record is half of a row control's address, and it stays on the domain's
// side of the boundary with the selector: `stable-handles.ts` keys on both.
test("the record an element sits in is handed back beside the selector, never inside the element", () => {
  const keyed = sanitizedEvidenceElement({
    tagName: "button",
    selector: '[data-testid="queue-rows"] > tr:nth-of-type(1) > td:nth-of-type(6) > button',
    accessibleName: "Post actions",
    context: { tablePosition: { row: 2, column: 6, columnHeader: "Actions" }, record: { keyAttribute: "data-post-id", key: "pst_7d3c9d" } }
  }, CONTEXT);
  const worded = sanitizedEvidenceElement({
    tagName: "button",
    selector: "ul > li:nth-of-type(3) > button",
    accessibleName: "Reply",
    context: { record: { text: "Priya Raman asked about the harbour loop" } }
  }, CONTEXT);
  const unplaced = sanitizedEvidenceElement({ tagName: "button", selector: "#save", accessibleName: "Save" }, CONTEXT);

  assert.ok(keyed?.record?.includes("pst_7d3c9d") && keyed.record.includes("data-post-id"));
  assert.ok(worded?.record?.includes("Priya Raman asked about the harbour loop"));
  assert.notEqual(keyed?.record, worded?.record);
  assert.equal(unplaced?.record, undefined, "a control in no record has none to add to its address");
  for (const element of [keyed?.element, worded?.element]) {
    const serialized = JSON.stringify(element);
    assert.doesNotMatch(serialized, /pst_7d3c9d|data-post-id|harbour loop|"record"/u);
  }
});
