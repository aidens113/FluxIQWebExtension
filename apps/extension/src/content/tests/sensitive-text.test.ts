// `textOutsideSensitiveControls` is the reader a descriptor's text comes
// through, so a sensitive control's contents -- a textarea's text, a select's
// option labels, an editable region's words -- never reach `text`,
// `visibleText` or `accessibleName` (decision D2, applied to descriptors).
//
// The runner is Node, so the page is the hand-built stub in `stub-page.ts`.
// That a real page's snapshot carries none of it is the content harness's
// (`e2e/content/tests/actions.spec.ts`).

import assert from "node:assert/strict";
import test from "node:test";
import { element, input, withStubPage } from "./stub-page";

const load = () => import("../sensitive-text");
const collapsed = (text: string) => text.replace(/\s+/gu, " ").trim();

test("a container's text leaves out a sensitive textarea's text and a sensitive select's option labels", async () => {
  await withStubPage(load, ({ textOutsideSensitiveControls }) => {
    const form = element("form", {},
      element("label", {}, "Recovery note ", element("textarea", { "data-sensitive": "true" }, "SYNTHETIC_RECOVERY_NOTE")),
      element("label", {}, "Security answer ", element("select", { "data-sensitive": "true" }, element("option", {}, "SYNTHETIC_ANSWER_LABEL"))),
      element("label", {}, "Contact time ", element("select", {}, element("option", {}, "Mornings")))
    );
    assert.equal(collapsed(textOutsideSensitiveControls(form)), "Recovery note Security answer Contact time Mornings");
  });
});

test("the rule is the shared one: a multi-token card autocomplete marks a text-bearing element too", async () => {
  await withStubPage(load, ({ textOutsideSensitiveControls }) => {
    const row = element("div", {}, "Card ", element("span", { autocomplete: "billing cc-number" }, "SYNTHETIC_CARD_TEXT"), " on file");
    assert.equal(collapsed(textOutsideSensitiveControls(row)), "Card on file");
  });
});

test("an element that is, or sits inside, a sensitive control gives no text, read whole or own", async () => {
  await withStubPage(load, ({ textOutsideSensitiveControls }) => {
    const option = element("option", {}, "SYNTHETIC_ANSWER_LABEL");
    const select = element("select", { "data-sensitive": "true" }, option);
    const nested = element("span", {}, "SYNTHETIC_NESTED_WORDS");
    const editable = element("div", { "data-sensitive": "true" }, "SYNTHETIC_EDITABLE_NOTE ", nested);
    for (const target of [select, option, editable, nested]) {
      assert.equal(textOutsideSensitiveControls(target), "");
      assert.equal(textOutsideSensitiveControls(target, "own"), "");
    }
  });
});

test("a read that reaches no text-bearing sensitive control is the text unchanged", async () => {
  await withStubPage(load, ({ textOutsideSensitiveControls }) => {
    // A password input is sensitive but holds no text, so the label reads as before.
    const label = element("label", {}, "  Password\n ", input("password", "SYNTHETIC_PASSWORD_VALUE"));
    assert.equal(textOutsideSensitiveControls(label), label.textContent);
    assert.equal(textOutsideSensitiveControls(element("p", {}, "Plain ", element("b", {}, "words"))), "Plain words");
  });
});

test("isWithinSensitiveControl: an element that is, or sits inside, a sensitive control -- and not one that only holds one", async () => {
  await withStubPage(load, ({ isWithinSensitiveControl }) => {
    const option = element("option", {}, "SYNTHETIC_ANSWER_LABEL");
    const select = element("select", { autocomplete: "one-time-code" }, option);
    const label = element("label", {}, "Security answer ", select);
    // Text is not what the check reads: an empty element inside a marked region is inside it all the same.
    const empty = element("b");
    const region = element("div", { "data-sensitive": "true" }, "SYNTHETIC_EDITABLE_NOTE ", empty);
    const ordinaryOption = element("option", {}, "Mornings");
    element("select", {}, ordinaryOption);
    for (const target of [select, option, region, empty, input("password", "SYNTHETIC_PASSWORD_VALUE")]) {
      assert.equal(isWithinSensitiveControl(target), true);
    }
    for (const target of [label, ordinaryOption]) assert.equal(isWithinSensitiveControl(target), false);
  });
});

test("own text is the element's own text nodes joined by a space, without its children's words", async () => {
  await withStubPage(load, ({ textOutsideSensitiveControls }) => {
    const container = element("div", {}, "Order", element("span", {}, "shipped"), "total");
    assert.equal(textOutsideSensitiveControls(container, "own"), "Order total");
  });
});
