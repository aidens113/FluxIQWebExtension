// T1 coverage of a text field over words the page draws in an open shadow
// root, on the shape the professional network's sent invitations use: a row
// whose age is a childless `gl-time-ago` element with "Sent 1 month ago" in its
// shadow root and nowhere in the light DOM. Until 2026-09-30 a text field read
// `""` there, and a text field on the row read the row without its age.

import assert from "node:assert/strict";
import test from "node:test";
import { readField } from "../field-reader";
import { fakeShadowDom } from "./fake-shadow-dom";

const dom = fakeShadowDom();
const TEXT = { kind: "text", required: true } as const;

test("a selected text field with a disclosure refuses partial text, while a sibling control does not", () => {
  const partial = dom.el("p", {}, "Partial text… ", dom.el("button", {}, "Read more"));
  assert.equal(readField(partial, "description", TEXT), "Partial text… Read more");
  assert.throws(() => readField(partial, "description", TEXT, "complete"), /incomplete_text/u);
  const complete = dom.el("p", {}, "Whole text");
  dom.el("article", {}, complete, dom.el("button", {}, "Read more"));
  assert.equal(readField(complete, "description", TEXT), "Whole text");
});

test("link identity changes only an explicitly requested helper; ordinary links and href attributes stay raw", () => {
  const raw = "https://records.example/entry?id=7&__cft__[0]=showing&__tn__=tracking#part";
  const anchor = dom.el("a", { href: raw }, "Record");
  assert.equal(readField(anchor, "url", { kind: "link", required: true }), new URL(raw).href);
  assert.equal(readField(anchor, "href", { kind: "attribute", attribute: "href", required: true }), raw);
  assert.equal(readField(anchor, "identity", { kind: "link", identity: "tracking-free", required: true }), "https://records.example/entry?id=7#part");
});

/** A sent connection request as the page draws it: the name, the headline, the age in a shadow root, and Withdraw. */
function sentRow(name: string, age: string): Element {
  const time = dom.shadow(dom.el("gl-time-ago", { datetime: "2026-08-19T08:00:00.000Z", format: "sent" }), dom.el("span", {}, age));
  return dom.el("li", { "data-entity-urn": "urn:gl:invitation:1" },
    dom.el("div", {}, dom.el("div", {}, dom.el("strong", {}, name)), " ", dom.el("div", {}, "Data engineer"), " ", time),
    " ",
    dom.el("div", {}, dom.el("button", { type: "button" }, "Withdraw")));
}

test("a text field on an element whose words are only in its open shadow root reads those words", () => {
  const row = sentRow("Aoife Brennan", "Sent 1 month ago");
  assert.equal(readField(row, "age", { ...TEXT, selector: "gl-time-ago" }), "Sent 1 month ago");
});

test("a text field on the row reads the shadow root's words where the page draws them, in document order", () => {
  const row = sentRow("Rosa Meijer", "Sent 4 weeks ago");
  assert.equal(readField(row, "row", TEXT), "Rosa Meijer Data engineer Sent 4 weeks ago Withdraw");
});

test("a sensitive control inside a shadow root is left out, as it is in the light DOM", () => {
  const host = dom.shadow(dom.el("x-note"), dom.el("span", {}, "Note: "), dom.el("textarea", { "data-sensitive": "true" }, "hunter2"));
  const row = dom.el("li", {}, host);
  assert.equal(readField(row, "note", TEXT), "Note:");
});

test("a component's stylesheet in its shadow root is not read as its text", () => {
  const host = dom.shadow(dom.el("x-badge"), dom.el("style", {}, ":host { color: red }"), dom.el("span", {}, "Sponsored"));
  assert.equal(readField(dom.el("li", {}, host), "badge", { ...TEXT, selector: "x-badge" }), "Sponsored");
});

test("a slot reads the light nodes assigned to it where it sits, and its fallback when none are", () => {
  const named = dom.el("b", {}, "Grace");
  const slot = dom.el("slot");
  const host = dom.el("x-greeting", {}, named);
  dom.shadow(host, "Hello, ", slot, "!");
  dom.assign(slot, named);
  assert.equal(readField(dom.el("li", {}, host), "greeting", TEXT), "Hello, Grace!");
  const empty = dom.shadow(dom.el("x-greeting"), "Hello, ", dom.el("slot", {}, "stranger"), "!");
  assert.equal(readField(dom.el("li", {}, empty), "greeting", TEXT), "Hello, stranger!");
});

test("an element with no shadow root anywhere in it reads exactly as it did", () => {
  const row = dom.el("li", {}, dom.el("span", {}, "  Kees   Bakker "), dom.el("script", {}, "x"));
  assert.equal(readField(row, "row", TEXT), "Kees Bakker x");
});

test("a read across a shadow root is bounded, so a huge component cannot make one field unbounded", () => {
  const words = Array.from({ length: 20_000 }, () => "w ");
  const host = dom.shadow(dom.el("x-huge"), ...words);
  const value = readField(dom.el("li", {}, host), "huge", TEXT) ?? "";
  assert.ok(value.length > 0 && value.length < words.join("").length, String(value.length));
});

// T1 coverage of a `column` field's header lookup (`field-reader.ts`,
// `readColumn`): the cell is found by the header's position in the table's own
// header row, so the same table drawn in another column order reads the same
// values, and a header the table lacks reads nothing rather than another column.
//
// This was the data-table fixture's column-reorder variant in
// `e2e/content/tests/extraction/tests/extract-list-table.spec.ts`. Browser specs
// open only the ten realistic scenarios, and none of them draws one table in two
// column orders; the lookup itself needs no browser, so it is proven here. The
// header-row read on a real table is that spec's company-website rows.
//
// The rows are built with `fake-shadow-dom.ts`, which gives elements text and
// attributes; the table-row surface `readColumn` asks of a row (`tagName`,
// `closest("table")`, `cells`) and of a table (`tHead.rows`, `rows`) is added
// here, since that fake has no tables.

/** One price-list row as two tables draw it: the same three values under headers in different orders. */
const HEADERS = ["Service", "What is included", "Price"] as const;
const VALUES: Record<(typeof HEADERS)[number], string> = {
  Service: "Annual boiler service (combi)",
  "What is included": "Full service, flue gas analysis and a written report.",
  Price: "£95.00"
};

/** A table whose header row lists `order`, and its one body row with each value under its own header. */
function tableRow(order: ReadonlyArray<(typeof HEADERS)[number]>): Element {
  const headerCells = order.map((header) => dom.el("th", {}, header));
  const bodyCells = order.map((header) => dom.el(header === "Service" ? "th" : "td", {}, VALUES[header]));
  const headerRow = Object.assign(dom.el("tr", {}, ...headerCells), { cells: headerCells });
  const row = Object.assign(dom.el("tr", {}, ...bodyCells), { cells: bodyCells });
  const table = { tHead: { rows: [headerRow] }, rows: [headerRow, row] };
  return Object.assign(row, { closest: (selector: string) => (selector === "table" ? table : null) });
}

const column = (header: string) => ({ kind: "column", header, required: false }) as const;

test("a column field reads the cell under its header in either column order", () => {
  const authored = tableRow(HEADERS);
  const reordered = tableRow(["Price", "Service", "What is included"]);
  for (const header of HEADERS) {
    assert.equal(readField(authored, header, column(header)), VALUES[header]);
    // By position this would read the service's name as its price.
    assert.equal(readField(reordered, header, column(header)), VALUES[header], `${header} after the reorder`);
  }
});

test("a header the table does not have reads null, never a neighbouring column", () => {
  assert.equal(readField(tableRow(HEADERS), "duration", column("Duration")), null);
  assert.equal(readField(tableRow(["Price", "Service", "What is included"]), "duration", column("Duration")), null);
});
