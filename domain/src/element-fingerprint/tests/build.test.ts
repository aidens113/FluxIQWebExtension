// The one builder of a saved step's control identity (t425): every signal the
// page offers, each class token on its own, and never what the control holds.

import assert from "node:assert/strict";
import test from "node:test";
import { webElementFingerprint } from "..";

test("a control the page describes many ways is saved with every one of them", () => {
  const fingerprint = webElementFingerprint({
    tagName: "input",
    selector: "#fb1l6ufkg",
    inputType: "text",
    label: "Quantity",
    attributes: { id: "fb1l6ufkg", name: "qty", class: "qty-input  form-control", type: "text", inputmode: "numeric", placeholder: "1", "aria-label": "How many", "data-testid": "quantity" },
    context: { formId: "add-to-cart", listPosition: { index: 2, total: 3 } },
    secret: false
  });
  assert.deepEqual(fingerprint, {
    selector: "#fb1l6ufkg",
    id: "fb1l6ufkg",
    classNames: ["qty-input", "form-control"],
    tagName: "input",
    name: "qty",
    inputType: "text",
    testId: "quantity",
    accessibleName: "How many",
    label: "Quantity",
    // The identifying attributes only, in the builder's one list: the id and
    // class are fields of their own, an input's type is its `inputType`, and
    // `inputmode` says how the box behaves, not which box it is.
    attributes: { name: "qty", placeholder: "1", "aria-label": "How many", "data-testid": "quantity" },
    context: { formId: "add-to-cart", listPosition: { index: 2, total: 3 } }
  });
});

test("a field's contents and a control's state are never its identity", () => {
  const typed = webElementFingerprint({
    tagName: "input",
    inputType: "search",
    visibleText: "Voltbay USB-C hub",
    text: "Voltbay USB-C hub",
    value: "Voltbay USB-C hub",
    accessibleName: "Search",
    attributes: { value: "Voltbay USB-C hub", "aria-valuetext": "x", placeholder: "Search the store" },
    secret: false
  });
  assert.equal(typed.value, undefined);
  assert.equal(typed.visibleText, undefined);
  assert.equal(typed.text, undefined);
  assert.deepEqual(typed.attributes, { placeholder: "Search the store" });
  assert.equal(typed.accessibleName, "Search");

  const notes = webElementFingerprint({ tagName: "textarea", visibleText: "my notes", label: "Notes", secret: false });
  assert.equal(notes.visibleText, undefined);
  assert.equal(notes.label, "Notes");

  const toggled = webElementFingerprint({ tagName: "input", inputType: "checkbox", value: "newsletter", attributes: { checked: "", "aria-checked": "true", value: "newsletter" }, label: "Send me news", secret: false });
  assert.equal(toggled.checked, undefined);
  assert.equal(toggled.attributes, undefined, "neither its state nor its value is one of the identifying attributes");
  assert.equal(toggled.value, "newsletter", "a checkbox's value is the author's word for it, and rides as `value`");

  // A button input's value is the words on it, not something a person entered.
  const go = webElementFingerprint({ tagName: "input", inputType: "submit", value: "Go", accessibleName: "Go", secret: false });
  assert.equal(go.value, "Go");
});

test("a secret control keeps the author's description of it and none of its words", () => {
  const password = webElementFingerprint({
    tagName: "input",
    inputType: "password",
    accessibleName: "hunter2",
    visibleText: "hunter2",
    value: "hunter2",
    label: "Password",
    attributes: { id: "pw", placeholder: "Your password", value: "hunter2" },
    secret: true
  });
  assert.equal(JSON.stringify(password).includes("hunter2"), false);
  assert.equal(password.label, "Password");
  assert.equal(password.id, "pw");
  assert.deepEqual(password.attributes, { placeholder: "Your password" });
});

test("blank strings and blank class tokens say nothing", () => {
  const fingerprint = webElementFingerprint({ tagName: "button", visibleText: "  ", classNames: [" ", "primary", "primary"], id: "", secret: false });
  assert.deepEqual(fingerprint, { classNames: ["primary"], tagName: "button" });
});
