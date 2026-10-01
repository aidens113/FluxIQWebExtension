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
// the child nodes, an open shadow root's nodes, and `matches` for the two
// selectors the module carries -- plus what the accessible-name rule asks when
// a control in no record is matched against the controls alike to it:
// `closest`, `hasAttribute`, `textContent` and `querySelectorAll("*")`. The
// sensitivity and naming rules reach `instanceof` the HTML element classes, so
// stand-in classes stand on the global for the life of the file. The browser
// side of this module is `e2e/content/tests/`.

import assert from "node:assert/strict";
import test from "node:test";
import { agreesWithRecordedRecord, recordIdentity } from "../record";

// `isSensitiveFormControl` narrows with `instanceof HTMLInputElement`, and the
// accessible-name rule with the other element classes below, each a
// ReferenceError under Node. No stub element is one, so the answer is always
// false and only the lookup has to exist.
for (const name of ["HTMLInputElement", "HTMLSelectElement", "HTMLTextAreaElement", "HTMLElement"]) {
  (globalThis as Record<string, unknown>)[name] ??= class {};
}

const TEXT_NODE = 3;
const ELEMENT_NODE = 1;

type Child = Element | string;

/** A text node, as the walker reads one. */
function textNode(value: string): Node {
  return { nodeType: TEXT_NODE, nodeValue: value, textContent: value, childNodes: [] } as unknown as Node;
}

/** Nodes as the stub holds them: text, or an element. */
function nodesOf(children: readonly Child[] | undefined): Node[] {
  return (children ?? []).map((child) => typeof child === "string" ? textNode(child) : child as unknown as Node);
}

/**
 * An element that answers what `record.ts` asks of one. `matches` understands
 * the two shapes the module's selectors are written in -- a tag name and an
 * attribute test -- because those are the only shapes it passes. `shadow` is
 * an open shadow root's nodes; they have no parent element, as in a browser,
 * and neither `textContent` nor `querySelectorAll` enters them.
 */
function el(tag: string, options: { attributes?: Record<string, string>; children?: Child[]; shadow?: Child[] } = {}): Element {
  const attributes = options.attributes ?? {};
  const childNodes = nodesOf(options.children);
  const shadowNodes = options.shadow ? nodesOf(options.shadow) : undefined;
  const elementsOf = (nodes: Node[]) => nodes.filter((node) => node.nodeType === ELEMENT_NODE) as unknown as Element[];
  const element = {
    localName: tag,
    tagName: tag.toUpperCase(),
    nodeType: ELEMENT_NODE,
    parentElement: null as Element | null,
    childNodes,
    children: elementsOf(childNodes),
    firstChild: childNodes[0] ?? null,
    shadowRoot: shadowNodes ? { childNodes: shadowNodes, children: elementsOf(shadowNodes) } : null,
    getAttribute: (name: string) => attributes[name] ?? null,
    getAttributeNames: () => Object.keys(attributes),
    hasAttribute: (name: string) => name in attributes,
    matches: (selector: string) => selector.split(",").some((part) => matchesOne(part.trim())),
    closest(selector: string): Element | null {
      for (let current: Element | null = element as unknown as Element; current; current = current.parentElement) {
        if (current.matches(selector)) return current;
      }
      return null;
    },
    querySelectorAll(selector: string): Element[] {
      if (selector !== "*") throw new Error(`stub querySelectorAll: ${selector}`);
      return element.children.flatMap((child) => [child, ...child.querySelectorAll("*")]);
    },
    get textContent(): string {
      return childNodes.map((node) => node.textContent ?? "").join("");
    }
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

// t195-w20e: the gate reads the row the way the extraction read it. Guildline
// draws each sent request's age in a `gl-time-ago` whose words exist only in
// its open shadow root, and the loop hands the age to the row's Withdraw as one
// of the pass's values (`t195-w19c-audit-withdraw-stale.md` B1).

/** One sent connection request, as `professional-network/network/rows.ts` `sentRowMarkup` draws it. */
function sentRequest(urn: string, name: string, headline: string, age: Child[] | undefined): { row: Element; withdraw: Element } {
  const withdraw = el("button", { attributes: { class: "textBtn", type: "button" }, children: ["Withdraw"] });
  const attributes = { class: "muted small", datetime: "2026-08-24T09:00:00.000Z", format: "sent" };
  const time = age ? el("gl-time-ago", { attributes, shadow: age }) : el("gl-time-ago", { attributes });
  const profile = el("a", {
    attributes: { href: "https://guildline.test/in/x/" },
    children: [el("span", { attributes: { "aria-hidden": "true" }, children: [name] }), el("span", { children: [`View ${name}'s profile`] })]
  });
  const row = el("li", {
    attributes: { class: "inviteRow", "data-entity-urn": urn },
    children: [
      el("a", { attributes: { href: "https://guildline.test/in/x/", "aria-hidden": "true", tabindex: "-1" }, children: [el("div", { children: ["XX"] })] }),
      el("div", { attributes: { class: "inviteText" }, children: [el("div", { children: [el("strong", { children: [profile] })] }), el("div", { children: [headline] }), time] }),
      el("div", { attributes: { class: "inviteActions" }, children: [withdraw] })
    ]
  });
  return { row, withdraw };
}

/** A component's own stylesheet, the first thing its shadow root holds. */
const AGE_STYLE = ":host{display:inline-block;color:#666} time{font-variant-numeric:tabular-nums}";

function sentInvitations(): { month: Element; weeks: Element } {
  const month = sentRequest("urn:li:invitation:7101", "Marta Okafor", "Talent partner at Quillmark", [el("style", { children: [AGE_STYLE] }), el("time", { children: ["Sent 1 month ago"] })]);
  const weeks = sentRequest("urn:li:invitation:7102", "Devon Reyes", "Engineer at Brightwell", [el("style", { children: [AGE_STYLE] }), el("time", { children: ["Sent 4 weeks ago"] })]);
  el("ul", { children: [month.row, weeks.row] });
  return { month: month.withdraw, weeks: weeks.withdraw };
}

test("a row's values are found in what its shadow roots draw: the age admits its own Withdraw and refuses the neighbour's", () => {
  const { month, weeks } = sentInvitations();
  assert.equal(agreesWithRecordedRecord({ values: ["Marta Okafor", "urn:li:invitation:7101", "Sent 1 month ago"] }, month), true);
  assert.equal(agreesWithRecordedRecord({ values: ["Devon Reyes", "urn:li:invitation:7102", "Sent 4 weeks ago"] }, weeks), true);
  // The neighbour holds this name and urn; only the age it draws says no.
  assert.equal(agreesWithRecordedRecord({ values: ["Devon Reyes", "urn:li:invitation:7102", "Sent 1 month ago"] }, weeks), false);
  assert.equal(agreesWithRecordedRecord({ values: ["Marta Okafor", "urn:li:invitation:7101", "Sent 1 month ago"] }, weeks), false);
});

test("a stylesheet in a shadow root is not what a value matches, and does not spend the row's text bound", () => {
  const { month } = sentInvitations();
  assert.equal(agreesWithRecordedRecord({ values: ["display:inline-block"] }, month), false);
  assert.equal(agreesWithRecordedRecord({ values: ["Marta Okafor", "font-variant-numeric:tabular-nums"] }, month), false);
  // A component stylesheet longer than the whole text bound, drawn before the age.
  const long = sentRequest("urn:li:invitation:7103", "Ana Lima", "Recruiter", [el("style", { children: [".c{color:red}".repeat(700)] }), el("time", { children: ["Sent 1 month ago"] })]);
  el("ul", { children: [long.row] });
  assert.equal(agreesWithRecordedRecord({ values: ["Ana Lima", "Sent 1 month ago"] }, long.withdraw), true);
});

test("a row with no shadow root reads as it did: its light words and attributes, and no age it does not draw", () => {
  const plain = sentRequest("urn:li:invitation:7104", "Ivo Brandt", "Designer", undefined);
  const other = sentRequest("urn:li:invitation:7105", "Lea Varga", "Analyst", undefined);
  el("ul", { children: [plain.row, other.row] });
  assert.equal(agreesWithRecordedRecord({ values: ["Ivo Brandt", "Designer", "urn:li:invitation:7104", "2026-08-24T09:00:00.000Z"] }, plain.withdraw), true);
  assert.equal(agreesWithRecordedRecord({ values: ["Ivo Brandt"] }, other.withdraw), false);
  assert.equal(agreesWithRecordedRecord({ values: ["Ivo Brandt", "Sent 1 month ago"] }, plain.withdraw), false);
});

// t195-w20e: a control in no record is checked against the row its own kind
// marks out. bigbox's cart lines are plain `<div>`s, so a pass over cart lines
// was refused on every row (`t195-w19b-audit-pickup-order.md` #9).

const SOAP = "ValueRidge Ultra Dish Soap, Lemon Scent, 24 fl oz";
const TOWELS = "ValueRidge Essentials Select-A-Size Paper Towels, 6 Double Rolls";

/** One cart line, as `bigbox-retail/pages/cart-page.ts` `lineMarkup` draws it, its hashed classes named plainly. */
function cartLine(title: string, sku: string, each: string): { line: Element; save: Element; remove: Element } {
  const remove = el("button", { attributes: { type: "button", class: "btnLink" }, children: ["Remove"] });
  const save = el("button", { attributes: { type: "button", class: "btnLink" }, children: ["Save for later"] });
  const options = [el("option", { attributes: { value: "1", selected: "" }, children: ["1"] }), el("option", { attributes: { value: "2" }, children: ["2"] })];
  const qty = el("label", { children: ["Qty ", el("select", { attributes: { class: "qtySelect" }, children: options })] });
  const main = el("div", {
    attributes: { class: "cartLineMain" },
    children: [
      el("a", { attributes: { href: `https://bigbox.test/scenarios/bigbox-retail/ip/${sku}` }, children: [title] }),
      el("span", { children: ["Sold and shipped by ValueRidge"] }),
      el("span", { children: [`${each} each`] }),
      el("div", { attributes: { class: "cartLineActions" }, children: [qty, remove, save] })
    ]
  });
  return { line: el("div", { attributes: { class: "cartLine" }, children: [main, el("strong", { children: [each] })] }), save, remove };
}

/** The cart page's main column around the given lines, all in one pickup group, as `renderCartPage` draws the pickup scenario's cart. */
function bigboxCart(lines: { line: Element }[]): void {
  const head = el("div", { attributes: { class: "cartGroupHead" }, children: ["Pickup at Carden Falls Supercenter"] });
  const group = el("section", { attributes: { class: "cartGroup" }, children: [head, ...lines.map((entry) => entry.line)] });
  const summary = el("aside", { attributes: { class: "summaryCard" }, children: [el("span", { children: ["Estimated total"] })] });
  el("main", { children: [el("h1", { children: ["Cart"] }), el("div", { attributes: { class: "cartLayout" }, children: [el("div", { children: [group] }), summary] })] });
}

test("a control in no record is checked against its own line: the soap's values admit the soap's Save for later and refuse the towels'", () => {
  const soap = cartLine(SOAP, "418832007", "$3.47");
  const towels = cartLine(TOWELS, "418830127", "$8.97");
  bigboxCart([soap, towels]);
  assert.equal(agreesWithRecordedRecord({ values: [SOAP] }, soap.save), true);
  assert.equal(agreesWithRecordedRecord({ values: [SOAP] }, towels.save), false);
  assert.equal(agreesWithRecordedRecord({ values: [TOWELS, "$8.97"] }, towels.save), true);
  assert.equal(agreesWithRecordedRecord({ values: [SOAP, "$8.97"] }, soap.save), false, "every value, in the line, not in the cart");
  assert.equal(agreesWithRecordedRecord({ values: [SOAP] }, soap.remove), true, "each kind of control marks out the same line");
});

test("a control alone of its kind marks out no row, so a pass over it still fails closed", () => {
  const soap = cartLine(SOAP, "418832007", "$3.47");
  bigboxCart([soap]);
  // Nothing on the page holds a second Save for later, so there is no line to
  // tell; the region around a lone control may hold any page's words.
  assert.equal(agreesWithRecordedRecord({ values: [SOAP] }, soap.save), false);
});
