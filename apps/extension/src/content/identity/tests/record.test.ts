// The rule that separates one row from the other 239.
//
// The defect these rows pin is not hypothetical and not a near miss. A Flow
// recorded against the member directory's row action was replayed on a page the
// recorded member had left, resolved the *next member's* button through the
// recorded positional selector, clicked it, promoted the wrong person and
// reported success (`reports/w2-wrong-row-acted-on.md`). Every identity signal
// agreed exactly, because the page renders 240 buttons that are identical by
// design: same tag, same role, same generated class, and the design system's
// constant `aria-label="Row actions"` on every one of them.
//
// So the rows below are shaped like that page. What each asserts is not a
// number -- there is no score in this rule -- but which side of a gate a
// candidate falls on, and, for the fail-closed half, that an *unanswerable*
// question is answered "no".
//
// The DOM is a stub because the extension's unit runner is Node. It answers
// exactly what `record.ts` asks: attributes and their names, the parent chain,
// the child nodes, and `matches` for the two selectors the module carries. The
// sensitivity rule reaches `instanceof HTMLInputElement`, so a stand-in class
// stands on the global for the life of the file. The browser side of this
// module is `e2e/content/tests/`.

import assert from "node:assert/strict";
import test from "node:test";
import { agreesWithRecordedRecord, recordIdentity } from "../record";

// `isSensitiveFormControl` narrows with `instanceof HTMLInputElement`, which is
// a ReferenceError under Node. No stub element is one, so the answer is always
// false and only the lookup has to exist.
(globalThis as Record<string, unknown>).HTMLInputElement ??= class {};

const TEXT_NODE = 3;
const ELEMENT_NODE = 1;

type Child = Element | string;

/** A text node, as the walker reads one. */
function textNode(value: string): Node {
  return { nodeType: TEXT_NODE, nodeValue: value, childNodes: [] } as unknown as Node;
}

/**
 * An element that answers what `record.ts` asks of one. `matches` understands
 * the two shapes the module's selectors are written in -- a tag name and an
 * attribute test -- because those are the only shapes it passes.
 */
function el(tag: string, options: { attributes?: Record<string, string>; children?: Child[] } = {}): Element {
  const attributes = options.attributes ?? {};
  const childNodes: Node[] = (options.children ?? []).map((child) =>
    typeof child === "string" ? textNode(child) : child as unknown as Node);
  const element = {
    localName: tag,
    tagName: tag.toUpperCase(),
    nodeType: ELEMENT_NODE,
    parentElement: null as Element | null,
    childNodes,
    children: childNodes.filter((node) => node.nodeType === ELEMENT_NODE),
    getAttribute: (name: string) => attributes[name] ?? null,
    getAttributeNames: () => Object.keys(attributes),
    matches: (selector: string) => selector.split(",").some((part) => matchesOne(part.trim())),
    textContent: ""
  };
  function matchesOne(part: string): boolean {
    if (!part.startsWith("[")) return part === tag;
    const [name, quoted] = part.slice(1, -1).split("=");
    if (!name) return false;
    const value = attributes[name];
    if (value === undefined) return false;
    return quoted === undefined || value === quoted.replace(/"/gu, "");
  }
  for (const child of element.children) (child as unknown as { parentElement: Element }).parentElement = element as unknown as Element;
  return element as unknown as Element;
}

/** One row of the member directory, as the fixture renders it. */
function memberRow(id: string, name: string, email: string): { row: Element; action: Element } {
  const action = el("button", { attributes: { "aria-label": "Row actions", class: "x1f4a" }, children: ["Row actions"] });
  const row = el("tr", {
    attributes: { "data-member-id": id, class: "x9c2b" },
    children: [
      el("td", { children: [el("span", { children: [name] }), el("span", { children: [email] })] }),
      el("td", { children: ["Member"] }),
      el("td", { children: [action] })
    ]
  });
  return { row, action };
}

/** The table the defect was measured on, shrunk to the two rows that matter. */
function directory(): { recorded: Element; other: Element } {
  const first = memberRow("usr_a91", "Priya Iqbal", "priya.iqbal@example.test");
  const second = memberRow("usr_b17", "Priya Krause", "priya.krause@example.test");
  el("tbody", { attributes: { "data-testid": "member-rows" }, children: [first.row, second.row] });
  return { recorded: first.action, other: second.action };
}

test("a row action is identified by the row's own key, not by where the row is", () => {
  const { recorded } = directory();
  assert.deepStrictEqual(recordIdentity(recorded), { keyAttribute: "data-member-id", key: "usr_a91" });
});

test("the identical button in another row is refused, however exactly it matches", () => {
  const { recorded, other } = directory();
  const identity = recordIdentity(recorded);
  // The two buttons are byte-identical: same tag, same class, same accessible
  // name, same text. This is the click that promoted the wrong member.
  assert.equal(agreesWithRecordedRecord(identity, other), false);
  assert.equal(agreesWithRecordedRecord(identity, recorded), true);
});

test("a candidate in no record at all disagrees, because an unanswerable question is not a yes", () => {
  const { recorded } = directory();
  const loose = el("button", { attributes: { "aria-label": "Row actions" } });
  assert.equal(agreesWithRecordedRecord(recordIdentity(recorded), loose), false);
});

test("a record the recorded key attribute is missing from disagrees", () => {
  const { recorded } = directory();
  const restyled = el("tr", { attributes: { "data-row": "3" }, children: [el("td", { children: [el("button")] })] });
  const button = (restyled.children[0] as Element).children[0] as Element;
  assert.equal(agreesWithRecordedRecord(recordIdentity(recorded), button), false);
});

test("a control that sits in no record records nothing, so nothing is checked", () => {
  const save = el("button", { attributes: { id: "save" }, children: ["Save changes"] });
  el("form", { children: [save] });
  assert.equal(recordIdentity(save), undefined);
  assert.equal(agreesWithRecordedRecord(undefined, save), true);
});

test("a test id is not a record key: a template writes the same one on every instance", () => {
  const first = el("div", { attributes: { "data-testid": "card" }, children: [el("button")] });
  const second = el("div", { attributes: { "data-testid": "card" }, children: [el("button")] });
  el("section", { children: [first, second] });
  // Neither the wrapper's tag nor its test id makes it a record, so there is no
  // identity to record and no legitimate replay to refuse.
  assert.equal(recordIdentity(first.children[0] as Element), undefined);
});

test("a keyless record falls back to its own words, and one of several is checked by them", () => {
  const firstLink = el("a", { attributes: { href: "/1" }, children: ["Northwind ledger"] });
  const secondLink = el("a", { attributes: { href: "/2" }, children: ["Contoso ledger"] });
  const first = el("li", { children: [firstLink] });
  const second = el("li", { children: [secondLink] });
  el("ul", { children: [first, second] });
  const identity = recordIdentity(firstLink);
  assert.deepStrictEqual(identity, { text: "Northwind ledger" });
  assert.equal(agreesWithRecordedRecord(identity, secondLink), false);
  assert.equal(agreesWithRecordedRecord(identity, firstLink), true);
});

test("a lone record records nothing: there was never anything to confuse it with", () => {
  const link = el("a", { attributes: { href: "/1" }, children: ["Northwind ledger"] });
  el("ul", { children: [el("li", { children: [link] })] });
  assert.equal(recordIdentity(link), undefined);
});

test("a record's words leave out what its controls say, so step two is not refused by step one", () => {
  const before = el("li", { children: ["Northwind ledger", el("button", { children: ["Follow"] })] });
  const after = el("li", { children: ["Northwind ledger", el("button", { children: ["Following"] })] });
  el("ul", { children: [before, after] });
  // Same record, re-rendered after the action changed its button. The words the
  // row identifies itself by have not moved.
  assert.deepStrictEqual(recordIdentity(before), { text: "Northwind ledger" });
  assert.equal(agreesWithRecordedRecord(recordIdentity(before), after), true);
});

test("a recorded key with no attribute beside it still finds one, which is all an old recording left", () => {
  const { recorded, other } = directory();
  assert.equal(agreesWithRecordedRecord({ key: "usr_a91" }, recorded), true);
  assert.equal(agreesWithRecordedRecord({ key: "usr_a91" }, other), false);
});

// t195: a step inside a For Each carries the pass's row as `values`, which win
// over the recording's key and text -- those name the row the Flow was built on.

/** A result card, keyless, whose button is identical on every card. */
function resultCard(title: string, price: string, href: string): { card: Element; add: Element } {
  const add = el("button", { attributes: { class: "add" }, children: ["Add to cart"] });
  const card = el("li", {
    attributes: { class: "result" },
    children: [
      el("a", { attributes: { href }, children: [el("h3", { children: [`  ${title}\n`] })] }),
      el("span", { attributes: { itemprop: "price", content: price.replace("$", "") }, children: [price] }),
      add
    ]
  });
  return { card, add };
}

function results(): { first: Element; second: Element } {
  const first = resultCard("Blue Kettle", "$24.99", "https://shop.test/p/blue-kettle");
  const second = resultCard("Red Toaster", "$39.99", "https://shop.test/p/red-toaster");
  el("ul", { children: [first.card, second.card] });
  return { first: first.add, second: second.add };
}

test("a row's values accept the control in that row and refuse the identical one in another", () => {
  const { first, second } = results();
  const row = { values: ["Red Toaster", "$39.99"] };
  assert.equal(agreesWithRecordedRecord(row, second), true);
  assert.equal(agreesWithRecordedRecord(row, first), false);
});

test("values win over the recording's key and text, which name the build's row", () => {
  const { first, second } = results();
  const built = { text: "Blue Kettle $24.99", values: ["Red Toaster"] };
  assert.equal(agreesWithRecordedRecord(built, second), true);
  assert.equal(agreesWithRecordedRecord(built, first), false);
  const { recorded, other } = directory();
  const keyed = { keyAttribute: "data-member-id", key: "usr_a91", values: ["Priya Krause"] };
  assert.equal(agreesWithRecordedRecord(keyed, other), true);
  assert.equal(agreesWithRecordedRecord(keyed, recorded), false);
});

test("every value must be in the row, not most of them", () => {
  const { second } = results();
  assert.equal(agreesWithRecordedRecord({ values: ["Red Toaster", "$24.99"] }, second), false);
});

test("a value is found as a link's resolved href, as an attribute value, or in a button's words", () => {
  const { first, second } = results();
  assert.equal(agreesWithRecordedRecord({ values: ["https://shop.test/p/red-toaster"] }, second), true);
  assert.equal(agreesWithRecordedRecord({ values: ["https://shop.test/p/red-toaster"] }, first), false);
  assert.equal(agreesWithRecordedRecord({ values: ["39.99"] }, second), true, "a microdata content attribute, and a part of the text");
  assert.equal(agreesWithRecordedRecord({ values: ["Add to cart", "Red Toaster"] }, second), true, "a button's words count here, unlike in the record's text identity");
});

test("a value is compared whitespace-collapsed, and an empty one is no value at all", () => {
  const { second } = results();
  assert.equal(agreesWithRecordedRecord({ values: ["  Red \n Toaster "] }, second), true);
  assert.equal(agreesWithRecordedRecord({ values: ["", "   "], key: "usr_a91" }, second), false, "empty values fall back to the recorded key, which this row lacks");
  assert.equal(agreesWithRecordedRecord({ values: [] }, second), true, "an empty list asks nothing");
});

test("a candidate in no record disagrees with a row's values: fail closed", () => {
  const loose = el("button", { children: ["Add to cart"] });
  el("div", { children: ["Red Toaster", loose] });
  assert.equal(agreesWithRecordedRecord({ values: ["Red Toaster"] }, loose), false);
});
