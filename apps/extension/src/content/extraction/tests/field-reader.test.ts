// How one extract_list field is normalized (`../field-spec.ts`) and then read
// off an item (`../field-reader.ts`). The normalizing half was
// `field-spec.test.ts` until t800, which folded it in here to keep this
// directory within its file budget; its tests are unchanged.
//
// ## Reading a normalized field
//
// T1 coverage of a text field over words the page draws in an open shadow
// root, on the shape the professional network's sent invitations use: a row
// whose age is a childless `gl-time-ago` element with "Sent 1 month ago" in its
// shadow root and nowhere in the light DOM. Until 2026-09-30 a text field read
// `""` there, and a text field on the row read the row without its age.

import assert from "node:assert/strict";
import test from "node:test";
import type { WebAutomationExtractListRequest } from "../../types";
import { readField } from "../field-reader";
import { normalizeExtractField } from "../field-spec";
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

// ## Normalizing a field
//
// T1 coverage of how an extract_list field becomes what the page reads: the
// string grammar, each structured spec kind, `required`, and the handling that
// is decided before the page is touched -- `exclude` dropping the field (D12)
// and `encrypt` refused as NOT_IMPLEMENTED.
//
// **`required` is the row that changed on 2026-09-26, and the reason is a live
// measurement.** Every form defaulted to required, so the ordinary thing a model
// writes -- four bare selectors -- failed the whole read on a page where three
// cards of forty-three carried no rating, and forty good rows were stored as
// nothing. A default that turns a wide answer into an empty one is the shape this
// product does not take: nothing is required unless the author wrote
// `required: true`, and the read states the gap instead of failing on it
// (`../field-spec.ts`, `content/actions/extract-list.ts`).
//
// Normalizing needs no DOM, so it runs here. Reading the fields from a live
// page is proven against real fixtures by `e2e/content/tests/extract-list.spec.ts`.

type ExtractField = WebAutomationExtractListRequest["fields"][string];

/** Stands in for where a field reads; a refusal names the field key, never this. */
const SELECTOR_SENTINEL = '[data-testid="SYNTHETIC_SELECTOR_SENTINEL"]';

test("tracking-free identity is explicit on a link read, and absent on an ordinary link", () => {
  assert.deepEqual(normalizeExtractField("identity", { kind: "link", selector: "a", identity: "tracking-free" }), { kind: "link", selector: "a", required: false, identity: "tracking-free" });
  assert.deepEqual(normalizeExtractField("url", { kind: "link", selector: "a" }), { kind: "link", selector: "a", required: false });
});

test("a plain selector reads the element's text, and the string form requires nothing: it has no way to say so", () => {
  assert.deepEqual(normalizeExtractField("name", '[data-testid="product-name"]'), { kind: "text", selector: '[data-testid="product-name"]', required: false });
});

test("an empty selector reads the item itself", () => {
  assert.deepEqual(normalizeExtractField("name", ""), { kind: "text", required: false });
});

test("a trailing @attribute reads that attribute instead of the text", () => {
  assert.deepEqual(normalizeExtractField("url", '[data-testid="product-link"]@href'), {
    kind: "attribute",
    selector: '[data-testid="product-link"]',
    attribute: "href",
    required: false
  });
});

test("the item's own attribute needs no selector", () => {
  assert.deepEqual(normalizeExtractField("id", "@data-product-id"), { kind: "attribute", attribute: "data-product-id", required: false });
});

test("an @ that is not an attribute name stays part of the selector", () => {
  assert.deepEqual(normalizeExtractField("owner", '[data-owner="a@b c"]'), { kind: "text", selector: '[data-owner="a@b c"]', required: false });
});

test("column: names the header whose cell the field reads", () => {
  assert.deepEqual(normalizeExtractField("price", "column:Price"), { kind: "column", header: "Price", required: false });
  assert.deepEqual(normalizeExtractField("price", "column:  Unit  price "), { kind: "column", header: "Unit price", required: false });
});

test("a column field with no header is rejected rather than matching every column", () => {
  assert.throws(() => normalizeExtractField("price", "column:   "), /names no column header/u);
});

test("each spec kind normalizes, its selector trimmed and a blank one reading the item", () => {
  const rows: Array<readonly [spec: ExtractField, expected: unknown]> = [
    [{ kind: "text", selector: " .name " }, { kind: "text", selector: ".name", required: false }],
    [{ kind: "attribute", selector: "a", attribute: " href " }, { kind: "attribute", selector: "a", attribute: "href", required: false }],
    [{ kind: "link", selector: "a" }, { kind: "link", selector: "a", required: false }],
    [{ kind: "value", selector: "input" }, { kind: "value", selector: "input", required: false }],
    [{ kind: "column", header: "  Unit  price " }, { kind: "column", header: "Unit price", required: false }],
    [{ kind: "text", selector: "   " }, { kind: "text", required: false }],
    [{ kind: "value", handling: "include" }, { kind: "value", required: false }]
  ];
  for (const [spec, expected] of rows) assert.deepEqual(normalizeExtractField("field", spec), expected, JSON.stringify(spec));
});

test("only an explicit true requires a field, and it still means exactly what it says", () => {
  // The capability is untouched; the default is what moved. A spec written
  // without `required` now means what the same field written as a bare selector
  // means, which is what keeps the two forms from reading differently.
  assert.equal(normalizeExtractField("field", { kind: "text", selector: ".a" })?.required, false);
  assert.equal(normalizeExtractField("field", { kind: "text", selector: ".a", required: true })?.required, true);
  assert.equal(normalizeExtractField("field", { kind: "text", selector: ".a", required: false })?.required, false);
  assert.equal(normalizeExtractField("field", { kind: "column", header: "Price", required: true })?.required, true);
  assert.equal(normalizeExtractField("field", { kind: "column", header: "Price", required: false })?.required, false);
});

test("an excluded field is dropped before anything could read it, whatever it names", () => {
  const excluded: ExtractField[] = [
    { kind: "text", selector: ".notes", handling: "exclude" },
    { kind: "value", selector: 'input[type="password"]', handling: "exclude", required: false },
    { kind: "column", header: "Card", handling: "exclude" },
    // Even a spec the page could not read is simply not read.
    { kind: "attribute", handling: "exclude" }
  ];
  for (const spec of excluded) assert.equal(normalizeExtractField("secret", spec), undefined, JSON.stringify(spec));
});

test("an encrypt field is refused as not implemented, naming the field and no selector", () => {
  let thrown: unknown;
  try {
    normalizeExtractField("card", { kind: "value", selector: SELECTOR_SENTINEL, handling: "encrypt" });
  } catch (error) {
    thrown = error;
  }
  const failure = (thrown as { failure?: Record<string, unknown> } | undefined)?.failure;
  assert.ok(thrown instanceof Error && failure !== undefined, `expected a refusal carrying a failure record, got ${String(thrown)}`);
  assert.equal(failure.code, "web.action.not_implemented");
  assert.equal(failure.category, "blocked_by_capability_or_policy");
  assert.equal(failure.expected, "the Encrypt column to be implemented");
  assert.match(String(failure.actual), /^field card asks for handling "encrypt"/u);
  assert.equal(`${thrown.message} ${JSON.stringify(failure)}`.includes("SYNTHETIC_SELECTOR_SENTINEL"), false);
});

test("a spec the page cannot honour throws, naming the field and never its selector", () => {
  const rows: Array<readonly [why: string, spec: unknown, message: RegExp]> = [
    ["an attribute field naming no attribute", { kind: "attribute", selector: SELECTOR_SENTINEL }, /reads an attribute but names none/u],
    ["an attribute field naming a blank attribute", { kind: "attribute", selector: SELECTOR_SENTINEL, attribute: "  " }, /reads an attribute but names none/u],
    ["a column field naming no header", { kind: "column", selector: SELECTOR_SENTINEL }, /reads a column but names no header/u],
    ["a kind the page does not know", { kind: "html", selector: SELECTOR_SENTINEL }, /kind of read the page does not know/u],
    ["a handling the page does not know", { kind: "text", selector: SELECTOR_SENTINEL, handling: "mask" }, /handling the page does not know/u],
    ["neither a string nor a spec", null, /neither a selector nor a field spec/u]
  ];
  for (const [why, spec, message] of rows) {
    assert.throws(() => normalizeExtractField("price", spec as ExtractField), (error: unknown) => {
      assert.ok(error instanceof Error, why);
      assert.match(error.message, message, why);
      assert.match(error.message, /"price"/u, why);
      assert.equal(error.message.includes("SYNTHETIC_SELECTOR_SENTINEL"), false, `${why}: the refusal quotes a selector`);
      return true;
    }, why);
  }
});
