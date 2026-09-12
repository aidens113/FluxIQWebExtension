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
  assert.equal(element?.tag, "input");
  assert.equal(element?.selector, "#field");
  assert.equal(element?.name, "Email");
  assert.equal(element?.inputType, "email");
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
