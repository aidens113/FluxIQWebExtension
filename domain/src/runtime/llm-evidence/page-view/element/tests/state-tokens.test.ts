// Each state token, and their order.

import assert from "node:assert/strict";
import test from "node:test";
import type { WebLlmEvidenceElement } from "../../../elements";
import { webLlmStateTokens } from "../state-tokens";

const el = (fields: Partial<WebLlmEvidenceElement> & { tag: string }): WebLlmEvidenceElement => ({ target: "t1", ...fields });

test("a field states its value, or that it is empty", () => {
  assert.deepEqual(webLlmStateTokens(el({ tag: "input", value: "wireless \"earbuds\"" }), "field", undefined), ["=\"wireless \\\"earbuds\\\"\""]);
  assert.deepEqual(webLlmStateTokens(el({ tag: "input", hasValue: false }), "field:email", undefined), ["=\"\""]);
  assert.deepEqual(webLlmStateTokens(el({ tag: "input", hasValue: true }), "field", undefined), [], "a value the capture did not read is not guessed");
});

test("a select states its selected label, then every option", () => {
  const select = el({ tag: "select", selectedValue: "all", options: [{ value: "all", label: "All" }, { value: "home", label: "Home & Kitchen" }] });
  assert.deepEqual(webLlmStateTokens(select, "select", undefined), ["=\"All\"", "[All|Home & Kitchen]"]);
  assert.deepEqual(webLlmStateTokens(el({ tag: "select", options: [{ value: "a", label: "A" }] }), "select", undefined), ["[A]"]);
});

test("checked, open, disabled, column, link, covered-by, focused and the layer's tokens, in that order", () => {
  const element = el({
    tag: "div", checked: true, expanded: false, attributes: [["aria-disabled", "true"]], cell: { row: 2, column: 3, header: "Unit price" },
    coveredBy: ["t9", "t10"], focused: true, isDialog: { modal: true, kind: "consent" }, covers: ["t4", "t5"]
  });
  assert.deepEqual(webLlmStateTokens(element, "checkbox", "~/x"), [
    "checked", "closed", "disabled", "@\"Unit price\"", "~/x", "covered-by t9,t10", "focused", "modal", "consent", "covers 2"
  ]);
});

test("aria-checked, the disabled attribute, a column with no header, and coversCount", () => {
  assert.deepEqual(webLlmStateTokens(el({ tag: "div", attributes: [["aria-checked", "false"], ["disabled", ""]], cell: { row: 1, column: 4 } }), "checkbox", undefined), ["unchecked", "disabled", "@c4"]);
  assert.deepEqual(webLlmStateTokens(el({ tag: "td", cell: { row: 1, column: 2, header: "Price" } }), undefined, undefined), ["@Price"]);
  assert.deepEqual(webLlmStateTokens(el({ tag: "div", covers: ["t2"], coversCount: 7, kind: "promotion" }), "layer", undefined), ["promotion", "covers 7"]);
});

test("selected, pressed, current, marked and a refusing cursor's disabled, after open and before the column (t229)", () => {
  const element = el({
    tag: "div", expanded: true, cursor: "not-allowed", marked: true,
    attributes: [["aria-selected", "true"], ["aria-pressed", "true"], ["aria-current", "page"]]
  });
  assert.deepEqual(webLlmStateTokens(element, "clickable", undefined), ["open", "selected", "pressed", "current", "marked", "disabled"]);
  const unset = el({ tag: "a", attributes: [["aria-selected", "false"], ["aria-pressed", "false"], ["aria-current", "false"]] });
  assert.deepEqual(webLlmStateTokens(unset, "link", undefined), [], "a state the page wrote as false is not stated");
  assert.deepEqual(webLlmStateTokens(el({ tag: "span", marked: true }), undefined, undefined), [], "a text line is not marked");
});

test("a field's placeholder is printed apart, first, unless it is the field's words (t229)", () => {
  const field = el({ tag: "input", hasValue: false, attributes: [["placeholder", "Autumn Mega Sale: up to 70% off"]] });
  assert.deepEqual(webLlmStateTokens(field, "field[search]", undefined), ["placeholder \"Autumn Mega Sale: up to 70% off\"", "=\"\""]);
  assert.deepEqual(webLlmStateTokens(field, "field[search]", undefined, "Autumn Mega Sale: up to 70% off"), ["=\"\""]);
  assert.deepEqual(webLlmStateTokens(field, "button", undefined), [], "only a field has a placeholder to print");
});
