// Invariant I7, "anything shown can be read" (result-evidence design, (b) 3):
// every state or attribute token the page-view element printer can emit for an
// element must have a read field a list read can return as a column.
//
// The token set is the printer's own. `state-tokens.ts` is read as text and each
// of its `tokens.push(` sites must be claimed by a row of the table below, so a
// new token is a new push site with no row and fails here; each row's probe is
// then driven through `webLlmStateTokens` and must print the row's token, so a
// row cannot claim a token the printer no longer prints. Each row names the
// element source the token is printed from and the read field that fills from
// that same source, and the real request reader (`webAutomationExtractListRequestRead`)
// must accept that field and keep it as written.
//
// A source no field kind reads is a row with `read: undefined`, and fails. A
// captured property or a computed style is read by a `value` field's `shown`
// (`item-mark/shown-value.ts` in the extension). Such a row is a gap to fix by adding a read
// field, never a row to exempt. Only a token about the view rather than the
// element is excluded, in `VIEW_TOKENS`, with its reason.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { webAutomationExtractListRequestRead } from "../../../../actions/extraction";
import type { WebLlmEvidenceElement } from "../../elements";
import { webLlmStateTokens } from "../element";

const el = (fields: Partial<WebLlmEvidenceElement>): WebLlmEvidenceElement => ({ target: "t1", tag: "div", ...fields });
const withAttribute = (name: string, value: string, fields: Partial<WebLlmEvidenceElement> = {}): WebLlmEvidenceElement => el({ ...fields, attributes: [[name, value]] });

type ReadField = { kind: "text" | "attribute" | "link" | "value" | "column"; attribute?: string; header?: string; mark?: "badge" | "flag" | "state"; shown?: "label" | "options" | "checked" | "disabled" | "marked" };

type Row = {
  /** A fragment of the `tokens.push(` line this row covers; every push line must contain one. */
  site: string;
  /** What the token says, for the failure message. */
  token: string;
  /** The line kind the printer is asked for. */
  kind: string | undefined;
  /** A probe that sets only this source on the element. */
  probe: WebLlmEvidenceElement;
  /** The link target the caller passes beside the element. */
  linkTarget?: string;
  /** The printed token the probe must produce. */
  prints: string;
  /** The element source the token is printed from. */
  source: string;
  /** The read field that fills from that source; `undefined` where no field kind can. */
  read: ReadField | undefined;
};

const ROWS: Row[] = [
  { site: "`placeholder ${", token: "placeholder", kind: "field", probe: withAttribute("placeholder", "Search", { tag: "input" }), prints: 'placeholder "Search"', source: "attribute placeholder", read: { kind: "attribute", attribute: "placeholder" } },
  { site: "`=${quotedWords(value)}`", token: '="value"', kind: "field", probe: el({ tag: "input", value: "abc", hasValue: true }), prints: '="abc"', source: "a control's live value", read: { kind: "value" } },
  { site: 'tokens.push("=\\"\\"")', token: '=""', kind: "field", probe: el({ tag: "input", hasValue: false }), prints: '=""', source: "a control's live value", read: { kind: "value" } },
  { site: "tokens.push(`=${quotedWords(selected.label)}`)", token: 'select label (="label")', kind: "select", probe: el({ tag: "select", selectedValue: "m", options: [{ value: "m", label: "Medium" }] }), prints: '="Medium"', source: "the selected option's label (a value read returns the option's value, not its label)", read: { kind: "value", shown: "label" } },
  { site: "tokens.push(`[${options.map", token: "select options ([a|b])", kind: "select", probe: el({ tag: "select", options: [{ value: "m", label: "Medium" }, { value: "l", label: "Large" }] }), prints: "[Medium|Large]", source: "the select's option list", read: { kind: "value", shown: "options" } },
  { site: 'checked ? "checked"', token: "checked/unchecked (aria-checked)", kind: "button", probe: withAttribute("aria-checked", "true", { role: "switch" }), prints: "checked", source: "attribute aria-checked", read: { kind: "attribute", attribute: "aria-checked" } },
  { site: 'checked ? "checked"', token: "checked/unchecked (native checkbox or radio)", kind: "button", probe: el({ tag: "input", checked: true }), prints: "checked", source: "the checkbox's live checked property (no attribute carries it)", read: { kind: "value", shown: "checked" } },
  { site: 'element.expanded ? "open"', token: "open/closed", kind: "button", probe: el({ tag: "button", expanded: true }), prints: "open", source: "attribute aria-expanded (elements.ts semanticExpandedState)", read: { kind: "attribute", attribute: "aria-expanded" } },
  { site: 'tokens.push("selected")', token: "selected", kind: "button", probe: withAttribute("aria-selected", "true", { role: "tab" }), prints: "selected", source: "attribute aria-selected", read: { kind: "attribute", attribute: "aria-selected" } },
  { site: 'tokens.push("pressed")', token: "pressed", kind: "button", probe: withAttribute("aria-pressed", "true", { tag: "button" }), prints: "pressed", source: "attribute aria-pressed", read: { kind: "attribute", attribute: "aria-pressed" } },
  { site: 'tokens.push("current")', token: "current", kind: "link", probe: withAttribute("aria-current", "page", { tag: "a" }), prints: "current", source: "attribute aria-current", read: { kind: "attribute", attribute: "aria-current" } },
  { site: 'tokens.push("marked")', token: "marked", kind: "button", probe: el({ tag: "button", marked: true }), prints: "marked", source: "a computed style the capture measured (setApart)", read: { kind: "value", shown: "marked" } },
  { site: 'tokens.push("disabled")', token: "disabled (disabled attribute)", kind: "button", probe: withAttribute("disabled", "", { tag: "button" }), prints: "disabled", source: "attribute disabled", read: { kind: "attribute", attribute: "disabled", mark: "flag" } },
  { site: 'tokens.push("disabled")', token: "disabled (aria-disabled)", kind: "button", probe: withAttribute("aria-disabled", "true", { tag: "button" }), prints: "disabled", source: "attribute aria-disabled", read: { kind: "attribute", attribute: "aria-disabled" } },
  { site: 'tokens.push("disabled")', token: "disabled (cursor not-allowed)", kind: "button", probe: el({ tag: "div", cursor: "not-allowed" }), prints: "disabled", source: "a computed cursor style the capture measured", read: { kind: "value", shown: "disabled" } },
  { site: "tokens.push(columnToken(element.cell))", token: "@column", kind: "text", probe: el({ tag: "td", cell: { row: 1, column: 2, header: "Price" } }), prints: "@Price", source: "the table cell under a header", read: { kind: "column", header: "Price" } },
  { site: "tokens.push(linkTarget)", token: "link target", kind: "link", probe: el({ tag: "a" }), linkTarget: "/item/7", prints: "/item/7", source: "the link's href", read: { kind: "link" } }
];

// Tokens that describe the view of the page, not the element. A person asking
// for a column of a list's rows has no use for any of these: they say where the
// element sits in the layers over the page at the moment of the look.
const VIEW_TOKENS: Array<{ site: string; token: string; probe: WebLlmEvidenceElement; prints: string; reason: string }> = [
  { site: "`covered-by ${", token: "covered-by", probe: el({ tag: "button", coveredBy: ["t9"] }), prints: "covered-by t9", reason: "says which layer lies over the element in this look; it is the page's paint state, not a property of the row" },
  { site: 'tokens.push("focused")', token: "focused", probe: el({ tag: "input", focused: true }), prints: "focused", reason: "the document's focus at the moment of the look; it moves with the model's own actions and is not stored data" },
  { site: 'tokens.push("modal")', token: "modal", probe: el({ tag: "div", isDialog: { modal: true } }), prints: "modal", reason: "a layer's kind in this look; a layer is a view over the page, not a record" },
  { site: "tokens.push(layerKind)", token: "layer kind", probe: el({ tag: "div", isDialog: { modal: false, kind: "promotion" } }), prints: "promotion", reason: "a layer's kind in this look; a layer is a view over the page, not a record" },
  { site: "`covers ${covers}`", token: "covers <n>", probe: el({ tag: "div", coversCount: 3 }), prints: "covers 3", reason: "how many controls a layer hides in this look; a view fact, not a record" }
];

const printed = (element: WebLlmEvidenceElement, kind: string | undefined, linkTarget?: string): string[] => webLlmStateTokens(element, kind, linkTarget);

// The one line that only delegates to `selectTokens` is left out: the pushes inside it are the sites.
function pushSites(): string[] {
  const source = readFileSync(path.resolve(process.cwd(), "src/runtime/llm-evidence/page-view/element/state-tokens.ts"), "utf8");
  return source.split("\n").filter((line) => line.includes("tokens.push(") && !line.includes("tokens.push(...selectTokens(")).map((line) => line.trim());
}

test("every token the element printer can emit is claimed by a row of this table or a named view token", () => {
  const sites = pushSites();
  assert.ok(sites.length >= 15, `the printer's push sites were found (${sites.length})`);
  const claimed = [...ROWS.map((row) => row.site), ...VIEW_TOKENS.map((row) => row.site)];
  const unclaimed = sites.filter((line) => !claimed.some((site) => line.includes(site)));
  assert.deepEqual(unclaimed, [], "a token was added to state-tokens.ts with no read field row (and no view-token reason) in read-vocabulary.test.ts");
  const stale = claimed.filter((site) => !sites.some((line) => line.includes(site)));
  assert.deepEqual(stale, [], "a row names a push line the printer no longer has");
});

test("each row's probe prints its token, and each view token prints too", () => {
  for (const row of ROWS) assert.ok(printed(row.probe, row.kind, row.linkTarget).includes(row.prints), `${row.token} prints ${row.prints}: ${printed(row.probe, row.kind, row.linkTarget).join(" | ")}`);
  for (const row of VIEW_TOKENS) assert.ok(printed(row.probe, "button").includes(row.prints), `${row.token} prints ${row.prints}: ${printed(row.probe, "button").join(" | ")}`);
});

test("view tokens are excluded only with a reason", () => {
  for (const row of VIEW_TOKENS) assert.ok(row.reason.length > 20, `${row.token} states why no column could want it`);
});

test("every row that has a read field is one the list read accepts as written", () => {
  for (const row of ROWS) {
    if (row.read === undefined) continue;
    const read = webAutomationExtractListRequestRead({ item: ".row", fields: { f: row.read } });
    const kept = read.request?.fields.f;
    assert.ok(kept !== undefined && typeof kept === "object", `${row.token}: the read accepted its field (${JSON.stringify(row.read)})`);
    assert.equal(kept.kind, row.read.kind, `${row.token}: kind kept`);
    if (row.read.attribute !== undefined) assert.equal(kept.attribute, row.read.attribute, `${row.token}: attribute kept`);
    if (row.read.header !== undefined) assert.equal(kept.header, row.read.header, `${row.token}: header kept`);
    if (row.read.mark !== undefined) assert.equal(kept.mark, row.read.mark, `${row.token}: mark kept`);
    if (row.read.shown !== undefined) assert.equal(kept.shown, row.read.shown, `${row.token}: shown kept`);
  }
});

test("every printed element token maps to a read field (I7)", () => {
  const gaps = ROWS.filter((row) => row.read === undefined).map((row) => `${row.token}: printed from ${row.source}; no read field kind fills from it`);
  assert.deepEqual(gaps, [], "tokens a person can see and cannot read as a column");
});
