// Each state token, and their order.

import assert from "node:assert/strict";
import test from "node:test";
import type { WebLlmEvidenceElement } from "../../../elements";
import { webLlmStateTokens } from "../state-tokens";
import { bodyLines } from "../../tests/packet-fixture";

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

// t513: a content-editable region is a field whose value is its text. The
// capture reads that text as the element's words, and nothing else carried it,
// so a filled composer printed `field "Write something..."` and the model and
// the judges both took it for empty.
test("a content-editable field states its text as its value, spaced as a reader sees it", () => {
  const editable = (fields: Partial<WebLlmEvidenceElement>) => el({ tag: "div", attributes: [["contenteditable", "true"]], ...fields });
  assert.deepEqual(webLlmStateTokens(editable({ name: "Write something...", text: "Lunch at noon" }), "field", undefined, "Write something..."), ["=\"Lunch at noon\""]);
  assert.deepEqual(webLlmStateTokens(editable({ name: "Note", text: "Line oneLine two", readable: "Line one Line two" }), "field", undefined, "Note"), ["=\"Line one Line two\""]);
  assert.deepEqual(webLlmStateTokens(editable({}), "field", undefined), ["=\"\""], "a region with no words at all is empty");
  assert.deepEqual(webLlmStateTokens(editable({ name: "Note" }), "field", undefined, "Note"), [], "text the capture may have folded into the name is not guessed at");
  assert.deepEqual(webLlmStateTokens(el({ tag: "div", text: "Read only", attributes: [["contenteditable", "false"]] }), undefined, undefined), []);
  assert.deepEqual(webLlmStateTokens(editable({ text: "Lunch at noon" }), "button", undefined), [], "only a field holds a value");
});

test("a filled content-editable field's line shows what it holds", () => {
  const lines = bodyLines([{ tag: "div", name: "Write something...", text: "Lunch at noon", attributes: [["contenteditable", "true"]] }]);
  assert.deepEqual(lines, ["t1 field \"Write something...\" =\"Lunch at noon\""]);
});
