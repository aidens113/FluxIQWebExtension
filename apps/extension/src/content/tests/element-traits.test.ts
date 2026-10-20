// `isSensitiveFormControl`: the live element adapted to the one sensitivity
// rule in `domain/src/sensitivity/`. Every capture path asks it, directly or
// through `isWithinSensitiveControl` (`sensitive-text.ts`), so what it misses
// leaves the page on all of them at once.
//
// The rows here are the card security code. bigbox-retail's card frame carries
// `<input name="cvc" inputmode="numeric">` under the label "Security code" and
// no `autocomplete`, and a headed probe (t730 c2) found what was typed into it
// in the snapshot, every recorded keydown and the recorded `dom.input`, while
// this adapter handed the rule only type, `autocomplete` and `data-sensitive`.
// It now hands over the input's `name`, `id` and the words that label it.
//
// The runner is Node, so the page is the hand-built stub in `stub-page.ts`. No
// value here is real: every one is a synthetic string, and none is asserted on.

import assert from "node:assert/strict";
import test from "node:test";
import { element, input, withStubPage } from "./stub-page";

const load = () => import("../element-traits");
const TYPED = "SYNTHETIC_TYPED_CODE";

test("a card security code is sensitive by its name or its id, with no autocomplete", async () => {
  await withStubPage(load, ({ isSensitiveFormControl }) => {
    assert.equal(isSensitiveFormControl(input("text", TYPED, { name: "cvc", inputmode: "numeric" })), true);
    assert.equal(isSensitiveFormControl(input("tel", TYPED, { id: "card-cvv" })), true);
    assert.equal(isSensitiveFormControl(input("number", TYPED, { name: "payment[securityCode]" })), true);
  });
});

test("a card security code is sensitive by the words that label it", async () => {
  await withStubPage(load, ({ isSensitiveFormControl }) => {
    const wrapped = input("text", TYPED, { name: "field-7" });
    element("label", {}, "Security code ", wrapped);
    assert.equal(isSensitiveFormControl(wrapped), true, "a wrapping <label>");
    assert.equal(isSensitiveFormControl(input("text", TYPED, { "aria-label": "CVC" })), true, "aria-label");
    assert.equal(isSensitiveFormControl(input("text", TYPED, { placeholder: "CVV" })), true, "placeholder");
  });
});

test("other fields stay ordinary: a promo code, a ZIP code, and a non-text control named for a code", async () => {
  await withStubPage(load, ({ isSensitiveFormControl }) => {
    const zip = input("text", TYPED, { name: "zip" });
    element("label", {}, "ZIP code ", zip);
    assert.equal(isSensitiveFormControl(zip), false);
    assert.equal(isSensitiveFormControl(input("text", TYPED, { name: "promo", placeholder: "Promo code" })), false);
    // A checkbox holds no typed code, whatever it is called.
    assert.equal(isSensitiveFormControl(input("checkbox", "on", { name: "cvc" })), false);
    // A select is not an input: its names and labels are not consulted, only its own marking.
    assert.equal(isSensitiveFormControl(element("select", { name: "cvc" })), false);
  });
});

test("the rule's existing signals still hold through the adapter", async () => {
  await withStubPage(load, ({ isSensitiveFormControl }) => {
    assert.equal(isSensitiveFormControl(input("password", TYPED)), true);
    assert.equal(isSensitiveFormControl(input("text", TYPED, { autocomplete: "section-pay billing cc-csc" })), true);
    assert.equal(isSensitiveFormControl(element("div", { "data-sensitive": "true" })), true);
    assert.equal(isSensitiveFormControl(input("text", TYPED, { name: "email", autocomplete: "email" })), false);
  });
});
