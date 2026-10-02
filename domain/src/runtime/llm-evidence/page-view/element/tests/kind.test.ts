// The kind word each element prints, and none for plain text.

import assert from "node:assert/strict";
import test from "node:test";
import type { WebLlmEvidenceElement } from "../../../elements";
import { webLlmElementKind } from "../kind";

const el = (fields: Partial<WebLlmEvidenceElement> & { tag: string }): WebLlmEvidenceElement => ({ target: "t1", ...fields });

test("every kind the format names", () => {
  const rows: Array<[Partial<WebLlmEvidenceElement> & { tag: string }, string | undefined]> = [
    [{ tag: "a", href: "https://shop.test/x" }, "link"],
    [{ tag: "a", attributes: [["href", "#"]] }, "link"],
    [{ tag: "span", role: "link" }, "link"],
    [{ tag: "button" }, "button"],
    [{ tag: "div", role: "button" }, "button"],
    [{ tag: "input", inputType: "submit" }, "button"],
    [{ tag: "input", inputType: "image" }, "button"],
    [{ tag: "input", inputType: "reset" }, "button"],
    [{ tag: "input" }, "field"],
    [{ tag: "input", inputType: "search" }, "field[search]"],
    [{ tag: "input", inputType: "email" }, "field:email"],
    [{ tag: "input", inputType: "number" }, "field:number"],
    [{ tag: "textarea" }, "field"],
    [{ tag: "div", role: "textbox" }, "field"],
    [{ tag: "div", role: "searchbox" }, "field[search]"],
    [{ tag: "div", attributes: [["contenteditable", ""]] }, "field"],
    [{ tag: "select" }, "select"],
    [{ tag: "input", inputType: "checkbox" }, "checkbox"],
    [{ tag: "input", inputType: "radio" }, "radio"],
    [{ tag: "button", role: "switch" }, "switch"],
    [{ tag: "summary" }, "toggle"],
    [{ tag: "button", role: "tab" }, "tab"],
    [{ tag: "li", role: "menuitem" }, "menuitem"],
    [{ tag: "li", role: "menuitemcheckbox" }, "menuitem"],
    [{ tag: "li", role: "option" }, "option"],
    [{ tag: "div", role: "slider" }, "slider"],
    [{ tag: "li", role: "treeitem" }, "treeitem"],
    [{ tag: "h2" }, "h2"],
    [{ tag: "h6" }, "h6"],
    [{ tag: "img" }, "img"],
    [{ tag: "i", role: "img" }, "img"],
    [{ tag: "div", hasClickHandler: true }, "clickable"],
    [{ tag: "div", cursor: "pointer" }, "clickable"],
    [{ tag: "div", cursor: "not-allowed" }, "clickable"],
    [{ tag: "label", cursor: "pointer" }, undefined],
    [{ tag: "div", isDialog: { modal: true } }, "dialog"],
    [{ tag: "div", covers: ["t2"] }, "layer"],
    [{ tag: "div", coversCount: 3 }, "layer"],
    [{ tag: "span" }, undefined],
    [{ tag: "p" }, undefined],
    [{ tag: "a" }, undefined],
    [{ tag: "input", inputType: "hidden" }, undefined]
  ];
  for (const [fields, kind] of rows) assert.equal(webLlmElementKind(el(fields)), kind, JSON.stringify(fields));
});

test("the role the page wrote decides before the tag", () => {
  assert.equal(webLlmElementKind(el({ tag: "a", href: "https://shop.test/", role: "button" })), "button");
  assert.equal(webLlmElementKind(el({ tag: "input", inputType: "checkbox", role: "switch" })), "switch");
  assert.equal(webLlmElementKind(el({ tag: "button", hasClickHandler: true })), "button", "clickable only when nothing else names it");
});

test("a search box is field[search]: by type, role, a search landmark or form, or a q/search name or id (t229)", () => {
  const rows: Array<[Partial<WebLlmEvidenceElement> & { tag: string }, string | undefined]> = [
    [{ tag: "input", landmark: "search" }, "field[search]"],
    [{ tag: "input", searchForm: true }, "field[search]"],
    [{ tag: "input", attributes: [["name", "q"]] }, "field[search]"],
    [{ tag: "input", attributes: [["id", "Search"]] }, "field[search]"],
    [{ tag: "div", role: "combobox", landmark: "search" }, "field[search]"],
    [{ tag: "input", attributes: [["name", "email"]] }, "field"],
    [{ tag: "input", inputType: "email", landmark: "search" }, "field:email"],
    [{ tag: "select", landmark: "search" }, "select"]
  ];
  for (const [fields, kind] of rows) assert.equal(webLlmElementKind(el(fields)), kind, JSON.stringify(fields));
});
