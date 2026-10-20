// A loop pass's spot is its own row's (job rerun round 4). The node a pass runs
// keeps the selector recorded on the build's row; the pass's row arrives as
// `item`, and the diff places the control in the record holding the row's
// values, as the page did when it pressed it. The site is a public library's
// catalogue: each book's card has a wordless "reserve" icon.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject, JsonValue } from "fluxiq/core";
import { sanitizeWebLlmSnapshotWithBindings, webControlSpotToken, webControlStates, webResetResource, type WebLlmSnapshotBinding } from "../../../llm-evidence";
import { webStateDiffPlaces, webStateSnapshotPlaces } from "..";

type Book = { title: string; author: string; reserved?: boolean };

/** The catalogue with one card per book, each card a keyed record, its icon about the book. */
function catalogue(books: Book[]): WebLlmSnapshotBinding {
  const elements: JsonObject[] = [{ tagName: "main", selector: "main" }, { tagName: "ul", selector: "#catalogue", parent: 0, attributes: { class: "catalogue" } }];
  books.forEach((book, index) => {
    const card = `#catalogue > li:nth-of-type(${index + 1})`;
    const record = { keyAttribute: "data-book-id", key: `book-${index + 1}` };
    const at = elements.length;
    elements.push({ tagName: "li", selector: card, parent: 1, attributes: { class: "card" }, context: { record } });
    elements.push({ tagName: "h3", selector: `${card} > h3`, text: book.title, name: book.title, parent: at, context: { record } });
    elements.push({ tagName: "p", selector: `${card} > p`, text: book.author, parent: at, context: { record } });
    elements.push({
      tagName: "button", selector: `${card} > button`, parent: at,
      attributes: { class: "reserve-icon", ...(book.reserved === undefined ? {} : { "aria-pressed": String(book.reserved) }) },
      context: { record, subject: book.title }
    });
  });
  const binding = sanitizeWebLlmSnapshotWithBindings({ url: "https://library.test/catalogue", title: "Library", interactiveElements: elements });
  binding.resetResource = webResetResource("session.one", "tab:1:frame:0")!;
  return binding;
}

const BOOKS: Book[] = [{ title: "Dune", author: "Frank Herbert" }, { title: "Emma", author: "Jane Austen" }];
const ICON = (row: number) => `#catalogue > li:nth-of-type(${row}) > button`;

/** The reserve press as the build recorded it: row 1's icon, its record named by row 1's key. */
const reserve = {
  definitionId: "web.output.dom-click",
  parameterValues: { selector: ICON(1), element: { selector: ICON(1), context: { record: { keyAttribute: "data-book-id", key: "book-1" } } } }
};

function spot(before: WebLlmSnapshotBinding, node: { definitionId: string; parameterValues?: JsonObject }, item?: JsonValue): JsonObject | undefined {
  const page = webStateSnapshotPlaces(before);
  return webStateDiffPlaces(page, page, node, false, item).spot as JsonObject | undefined;
}

/** The token of the item the element `selector` sits in on `page`. */
function itemAt(page: WebLlmSnapshotBinding, selector: string): string {
  const handle = [...page.selectors].find(([, written]) => written === selector)?.[0];
  const record = handle === undefined ? undefined : page.records.get(handle);
  assert.ok(record, `no record at ${selector}`);
  return webControlSpotToken("item", record);
}

test("a pass on row 2 of a press recorded on row 1 has row 2's spot: its item and what its icon is about", () => {
  const page = catalogue(BOOKS);
  const pass = spot(page, reserve, { title: "Emma", author: "Jane Austen" });
  assert.equal(pass?.item, itemAt(page, "#catalogue > li:nth-of-type(2)"));
  assert.equal(pass?.subject, webControlSpotToken("subject", "Emma"));
  // Exactly the spot row 2's own icon has.
  assert.deepEqual(pass, spot(page, { definitionId: "web.output.dom-click", parameterValues: { selector: ICON(2) } }));
  // Opaque tokens only: no words, no selector.
  assert.doesNotMatch(JSON.stringify(pass), /Emma|Austen|catalogue|nth-of-type/u);
});

test("a recorded action Core runs as a policy action is placed in its pass's row too", () => {
  const page = catalogue(BOOKS);
  const recorded = { definitionId: "builtin.policy.action", parameterValues: { outputId: "web.dom.click", parameters: reserve.parameterValues } };
  assert.equal(spot(page, recorded, { title: "Emma", author: "Jane Austen" })?.item, itemAt(page, "#catalogue > li:nth-of-type(2)"));
});

test("without a pass row, and for a pass on the build's own row, the spot is the recorded control's, as before", () => {
  const page = catalogue(BOOKS);
  const recorded = spot(page, reserve);
  assert.equal(recorded?.item, itemAt(page, "#catalogue > li:nth-of-type(1)"));
  assert.equal(recorded?.subject, webControlSpotToken("subject", "Dune"));
  assert.deepEqual(spot(page, reserve, { title: "Dune", author: "Frank Herbert" }), recorded);
});

test("a pass whose row no record on the page before holds has no spot, never the build's row's", () => {
  const page = catalogue(BOOKS);
  assert.equal(spot(page, reserve, { title: "Ivanhoe", author: "Walter Scott" }), undefined);
  // A row only partly held -- the title on one card, the author on none -- is no row either.
  assert.equal(spot(page, reserve, { title: "Emma", author: "Walter Scott" }), undefined);
});

test("a pass pressing a toggle on its own row carries that icon's state, and the counts at its place", () => {
  const before = catalogue([{ ...BOOKS[0]!, reserved: true }, { ...BOOKS[1]!, reserved: false }]);
  const after = catalogue([{ ...BOOKS[0]!, reserved: true }, { ...BOOKS[1]!, reserved: true }]);
  const diff = webStateDiffPlaces(webStateSnapshotPlaces(before), webStateSnapshotPlaces(after), reserve, false, { title: "Emma", author: "Jane Austen" });
  const pass = diff.spot as { place?: string; state?: string };
  const own = spot(before, { definitionId: "web.output.dom-click", parameterValues: { selector: ICON(2) } }) as { place?: string; state?: string };
  assert.ok(pass.place && pass.state, "the pass's icon is a stateful control");
  assert.equal(pass.state, own.state, "row 2's icon was not reserved, unlike row 1's");
  assert.notEqual(pass.state, (spot(before, reserve) as { state?: string }).state);
  const controls = diff.controls as { before: Record<string, number>; after: Record<string, number> };
  assert.deepEqual(controls.before, webControlStates(before)[pass.place]);
  assert.deepEqual(controls.after, webControlStates(after)[pass.place]);
});
