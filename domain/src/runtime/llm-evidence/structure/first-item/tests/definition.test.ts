import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import type { WebAutomationExtractionProposal, WebAutomationExtractionProposalFieldSpec } from "../../../../../extraction";
import { sanitizeWebLlmSnapshotWithBindings } from "../../../sanitize";
import { WEB_LLM_WITHHELD_TEXT } from "../../../withheld";
import { present } from "../../../present";
import { webLlmCaptureWalk } from "../walk";

type Entry = { tag: string; text?: string; attributes?: Record<string, string>; hidden?: boolean; children?: Entry[] };
const entry = (tag: string, text?: string, children?: Entry[], attributes?: Record<string, string>, hidden?: boolean): Entry => present<Entry>({ tag, text, children, attributes, hidden });
const term = (text: string, attributes?: Record<string, string>, children?: Entry[], hidden?: boolean): Entry => entry("dt", text, children, attributes, hidden);
const value = (text: string, attributes?: Record<string, string>, children?: Entry[], hidden?: boolean): Entry => entry("dd", text, children, attributes, hidden);
const pair = (label: string, text: string): Entry => ({ tag: "div", children: [term(label), value(text)] });
const list = (...children: Entry[]): Entry => ({ tag: "dl", children });
const field = (part: "term" | "value" = "value", selector?: string, label = "Edition"): WebAutomationExtractionProposalFieldSpec => present<WebAutomationExtractionProposalFieldSpec>({
  kind: "text", definition: { term: label, part }, selector, group: undefined, attribute: undefined, header: undefined,
  required: undefined, handling: undefined, lines: undefined, identity: undefined, mark: undefined
});

function captured(rows: Entry[][]) {
  const elements: JsonObject[] = [{ tagName: "ul", selector: "ul" }];
  function add(entries: Entry[], parent: number, parentSelector: string): void {
    const counts = new Map<string, number>();
    for (const entry of entries) {
      const position = (counts.get(entry.tag) ?? 0) + 1;
      counts.set(entry.tag, position);
      const selector = `${parentSelector} > ${entry.tag}:nth-of-type(${position})`;
      const descriptor: JsonObject = { tagName: entry.tag, selector, parent };
      if (entry.attributes !== undefined) descriptor.attributes = entry.attributes;
      if (entry.hidden === true) descriptor.hidden = true;
      if (entry.text !== undefined) descriptor.visibleText = entry.text;
      const index = elements.push(descriptor) - 1;
      add(entry.children ?? [], index, selector);
    }
  }
  add(rows.map((children) => ({ tag: "li", children })), 0, "ul");
  const binding = sanitizeWebLlmSnapshotWithBindings({ url: "https://archive.test/catalogue", interactiveElements: elements });
  const proposal: WebAutomationExtractionProposal = { container: "ul", item: "ul > li", itemCount: rows.length, confidence: 1, fields: [] };
  const walk = webLlmCaptureWalk(proposal, binding);
  return (spec: WebAutomationExtractionProposalFieldSpec) => walk.items.map((item) => walk.elementsOf(item, spec)?.map((node) => node.element.text ?? node.element.name));
}

test("definition fields find their exact term after an inserted or reordered pair", () => {
  const read = captured([
    [list(pair("Format", "Hardback"), pair("Edition", "Second"))],
    [list(pair("Edition", "Fourth"), pair("Format", "Digital"), pair("Language", "Welsh"))]
  ]);
  assert.deepEqual(read(field()), [["Second"], ["Fourth"]]);
  assert.deepEqual(read(field("term")), [["Edition"], ["Edition"]]);
  assert.deepEqual(read(field("value", undefined, "Edit")), [[], []]);
  assert.deepEqual(read(field("value", undefined, "edition")), [[], []]);
});

test("flat semantic terms can share exactly one definition and normalize whitespace", () => {
  const read = captured([[list(term("Edition"), term(" Issue \nnumber "), value("Fourth"), term("Format"), value("Digital"))]]);
  assert.deepEqual(read(field()), [["Fourth"]]);
  assert.deepEqual(read(field("value", undefined, "Issue number")), [["Fourth"]]);
  assert.deepEqual(read(field("term", undefined, " Issue   number ")), [["Issue number"]]);
});

test("missing, duplicate and nonunique definition associations never fall back", () => {
  const read = captured([
    [list(pair("Format", "Digital"))],
    [list(pair("Edition", "First"), pair("Edition", "Second"))],
    [list(term("Edition"), value("First"), value("Second"))],
    [list(term("Edition"))],
    [list(term("Edition"), term("Edition"), value("First"))],
    [list(pair("Edition", "First")), list(pair("Edition", "Second"))]
  ]);
  assert.deepEqual(read(field()), [[], [], [], [], [], []]);
  assert.deepEqual(read(field("term")), [[], [], [], [], [], []]);
});

test("an explicit list or containing scope limits exact-term uniqueness", () => {
  const catalogue: Entry = entry("dl", undefined, [pair("Edition", "Second")], { class: "catalogue" });
  const read = captured([[list(pair("Edition", "Unrelated")), { tag: "section", attributes: { class: "detail" }, children: [catalogue] }]]);
  assert.deepEqual(read(field()), [[]]);
  assert.deepEqual(read(field("value", ":scope dl.catalogue")), [["Second"]]);
  assert.deepEqual(read(field("value", ":scope > section.detail")), [["Second"]]);
  assert.deepEqual(read(field("value", ":scope dl.absent")), [[]]);
  assert.deepEqual(read(field("value", ":scope > dl:first-child")), [undefined]);
});

test("nested lists are not adopted as an outer pair or an unscoped row list", () => {
  const nested = list(pair("Edition", "Inner"));
  const read = captured([[list(term("Notes"), { tag: "dd", text: "Outer", children: [nested] })]]);
  assert.deepEqual(read(field()), [[]]);
  assert.deepEqual(read(field("value", ":scope > dl > dd > dl")), [["Inner"]]);
  assert.deepEqual(read(field("value", undefined, "Notes")), [[]]);
});

test("hidden, inert, sensitive and screened terms or values stay unreadable", () => {
  const read = captured([
    [list({ tag: "div", children: [term("Edition", undefined, undefined, true), value("First")] })],
    [list({ tag: "div", attributes: { "aria-hidden": "true" }, children: [term("Edition"), value("First")] })],
    [entry("dl", undefined, [pair("Edition", "First")], { inert: "" })],
    [list({ tag: "div", children: [term("Edition", { "data-sensitive": "true" }), value("First")] })],
    [list({ tag: "div", children: [term("Edition"), value("First", undefined, undefined, true)] })],
    [list(pair(WEB_LLM_WITHHELD_TEXT, "First"))],
    [list(pair("Edition", WEB_LLM_WITHHELD_TEXT))],
    [list({ tag: "div", children: [term("Edition", undefined, [{ tag: "span", text: "part", hidden: true }]), value("First")] })]
  ]);
  assert.deepEqual(read(field()), [[], [], [], [], [], [], [], []]);
  assert.deepEqual(read(field("term")), [[], [], [], [], [], [], [], []]);
  assert.deepEqual(read(field("value", undefined, WEB_LLM_WITHHELD_TEXT)), [[], [], [], [], [], [], [], []]);
});

test("an anchored field with an incompatible active reader does not become the item", () => {
  const read = captured([[list(pair("Edition", "Second"))]]);
  assert.deepEqual(read({ kind: "text", definition: { term: "Edition", part: "value" }, lines: true }), [[]]);
  assert.deepEqual(read({ kind: "link", definition: { term: "Edition", part: "value" } }), [[]]);
});

test("interactive or executable contents cannot become a definition term or value", () => {
  for (const child of [
    { tag: "button", text: "Edition" }, { tag: "input", attributes: { type: "text", value: "Edition" } },
    { tag: "script", text: "Edition" }, { tag: "span", text: "Edition", attributes: { contenteditable: "true" } },
    { tag: "span", text: "Edition", attributes: { role: "button" } }
  ]) {
    for (const part of ["term", "value"] as const) {
      const children = [term("Edition"), value("Second")];
      children[part === "term" ? 0 : 1]!.children = [child];
      assert.deepEqual(captured([[list({ tag: "div", children })]])(field()), [[]]);
      assert.deepEqual(captured([[list({ tag: "div", children })]])(field("term")), [[]]);
    }
  }
});

test("case-insensitive fallback control roles and native editable forms block captured terms, values and ancestor content", () => {
  const blockedAttributes: Array<Record<string, string>> = [
    { role: "note TeXtBoX" }, { role: "CHECKBOX status" },
    { contenteditable: "" }, { contenteditable: "TRUE" }, { contenteditable: "Plaintext-Only" }
  ];
  for (const attributes of blockedAttributes) {
    for (const location of ["term", "value", "term-descendant", "value-descendant", "parent", "row-content"] as const) {
      const name = term("Edition", location === "term" ? attributes : undefined);
      const definition = value("Second", location === "value" ? attributes : undefined);
      if (location === "term-descendant") name.children = [{ tag: "span", text: "Edition", attributes }];
      if (location === "value-descendant") definition.children = [{ tag: "span", text: "Second", attributes }];
      const group = entry("div", undefined, [name, definition], location === "parent" ? attributes : undefined);
      const entries: Entry[] = location === "row-content"
        ? [{ tag: "section", attributes, children: [list(group)] }]
        : [list(group)];
      const read = captured([entries]);
      assert.deepEqual(read(field()), [[]], `${JSON.stringify(attributes)} ${location} value`);
      assert.deepEqual(read(field("term")), [[]], `${JSON.stringify(attributes)} ${location} term`);
    }
  }
});

test("explicit noneditable captured fields and ordinary fallback roles retain exact semantic reads", () => {
  for (const contenteditable of ["false", "FALSE"]) {
    const attributes = { contenteditable, role: "note status" };
    const read = captured([[{ tag: "section", attributes, children: [list({ tag: "div", children: [
      term("Edition", attributes), value("Second", undefined, [{ tag: "span", text: "Second", attributes }])
    ] })] }]]);
    assert.deepEqual(read(field()), [["Second"]]);
    assert.deepEqual(read(field("term")), [["Edition"]]);
  }
});
