// What a step's state diff says of its places (t609): where its control sat
// (`spot`) and the items of the lists both of its pages show (`items`), from
// which FluxIQ Core counts the items a trial's step created (t598). The site
// is a public library's catalogue: cards a reader adds to a reading list, and
// a loans drawer that opens over loans the reader already had.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { sanitizeWebLlmSnapshotWithBindings, webControlSpotToken, webControlStates, webResetResource, type WebLlmSnapshotBinding } from "../../../llm-evidence";
import { webResetCollections } from "../../../llm-evidence/control-spot";
import { createWebStatePlacesMemo, webStateDiffPlaces, webStateSnapshotPlaces } from "..";

type Spec = { tag: string; selector: string; text?: string; cls?: string; record?: JsonObject; dialog?: string; children?: Spec[] };

/** The capture's flat element list for a tree, each element's `parent` its ancestor's index, a record's context on every element in it. */
function capture(url: string, tree: Spec[]): JsonObject {
  const elements: JsonObject[] = [];
  const walk = (spec: Spec, parent: number | undefined, record: JsonObject | undefined, dialog: string | undefined) => {
    const index = elements.length;
    const inRecord = spec.record ?? record, inDialog = spec.dialog ?? dialog;
    elements.push({
      tagName: spec.tag, selector: spec.selector,
      ...(spec.text === undefined ? {} : { text: spec.text, name: spec.text }),
      ...(spec.cls === undefined ? {} : { attributes: { class: spec.cls } }),
      ...(parent === undefined ? {} : { parent }),
      ...(inRecord || inDialog ? { context: { ...(inRecord ? { record: inRecord } : {}), ...(inDialog ? { dialog: inDialog } : {}) } } : {})
    });
    for (const child of spec.children ?? []) walk(child, index, inRecord, inDialog);
  };
  for (const spec of tree) walk(spec, undefined, undefined, undefined);
  return { url, title: "Library", interactiveElements: elements };
}

const card = (n: number, title: string): Spec => ({
  tag: "li", selector: `#catalogue > li:nth-of-type(${n})`, cls: "card", record: { keyAttribute: "data-title-id", key: `title-${n}` },
  children: [{ tag: "h3", selector: `#catalogue > li:nth-of-type(${n}) > h3`, text: title }, { tag: "button", selector: `#catalogue > li:nth-of-type(${n}) > button`, text: "Add to list" }]
});
/** A reading-list line, named by its words as an unkeyed record is. */
const line = (n: number, words: string, cls = "line"): Spec => ({
  tag: "li", selector: `#reading > ul > li:nth-of-type(${n})`, cls, record: { text: words },
  children: [{ tag: "button", selector: `#reading > ul > li:nth-of-type(${n}) > button`, text: "Remove" }]
});
const loan = (n: number, title: string): Spec => ({
  tag: "li", selector: `#loans > ul > li:nth-of-type(${n})`, cls: "loan", record: { keyAttribute: "data-loan-id", key: `loan-${n}` },
  children: [{ tag: "button", selector: `#loans > ul > li:nth-of-type(${n}) > button`, text: `Renew ${title}` }]
});
const CARDS = [card(1, "Dune"), card(2, "Emma"), card(3, "Ivanhoe")];

function libraryPage(lines: Spec[], extra: Spec[] = []): WebLlmSnapshotBinding {
  return sanitizeWebLlmSnapshotWithBindings(capture("https://library.test/catalogue", [{
    tag: "main", selector: "main", children: [
      { tag: "ul", selector: "#catalogue", cls: "catalogue", children: CARDS },
      { tag: "aside", selector: "#reading", cls: "reading-list", children: [{ tag: "h2", selector: "#reading > h2", text: "Reading list" }, { tag: "ul", selector: "#reading > ul", cls: "lines", children: lines }] },
      ...extra
    ]
  }]));
}

/** The token of the item the element `selector` sits in on `page`. */
function tokenAt(page: WebLlmSnapshotBinding, selector: string): string {
  const handle = [...page.selectors].find(([, written]) => written === selector)?.[0];
  const record = handle === undefined ? undefined : page.records.get(handle);
  assert.ok(record, `no record at ${selector}`);
  return webControlSpotToken("item", record);
}

const press = (selector: string) => ({ definitionId: "web.output.dom-click", parameterValues: { selector } });
/** What Core counts created: in `after`, not in `before` (`landed-acts.ts`). */
function created(diff: JsonObject): string[] {
  const items = diff.items as { before: string[]; after: string[] } | undefined;
  if (!items) return [];
  const before = new Set(items.before);
  return items.after.filter((item) => !before.has(item));
}
function step(before: WebLlmSnapshotBinding, after: WebLlmSnapshotBinding, node: ReturnType<typeof press>, documentChanged = false): JsonObject {
  return webStateDiffPlaces(webStateSnapshotPlaces(before), webStateSnapshotPlaces(after), node, documentChanged);
}

const DUNE = "Dune Frank Herbert", EMMA = "Emma Jane Austen", IVANHOE = "Ivanhoe Walter Scott";

test("an add to a list the page shows: the control's card is the spot, and the new line is the one item created", () => {
  const before = libraryPage([line(1, DUNE), line(2, EMMA)]);
  const after = libraryPage([line(1, DUNE), line(2, EMMA), line(3, IVANHOE)]);
  const diff = step(before, after, press("#catalogue > li:nth-of-type(3) > button"));
  assert.deepEqual(diff.spot, { item: tokenAt(before, "#catalogue > li:nth-of-type(3)") });
  assert.deepEqual(created(diff), [tokenAt(after, "#reading > ul > li:nth-of-type(3)")]);
  // Opaque tokens only: no words, no selector.
  assert.doesNotMatch(JSON.stringify(diff), /Ivanhoe|Herbert|catalogue|nth-of-type/u);
});

test("a drawer the step opened lists loans the reader already had: none of them is created", () => {
  const before = libraryPage([line(1, DUNE), line(2, EMMA)]);
  const drawer: Spec = { tag: "aside", selector: "#loans", cls: "loans-drawer", dialog: "Your loans", children: [{ tag: "ul", selector: "#loans > ul", cls: "loans", children: [loan(1, "Dune"), loan(2, "Emma")] }] };
  const after = libraryPage([line(1, DUNE), line(2, EMMA)], [drawer]);
  const diff = step(before, after, press("#open-loans"));
  assert.deepEqual(created(diff), []);
  const listed = diff.items as { before: string[]; after: string[] };
  for (const loanLine of ["#loans > ul > li:nth-of-type(1)", "#loans > ul > li:nth-of-type(2)"]) assert.ok(!listed.after.includes(tokenAt(after, loanLine)));
  // A control in no item has no spot.
  assert.equal(diff.spot, undefined);
});

test("a drawer with one loan, beside a single card the page held before under the same container, is still not a list the page showed", () => {
  const recent: Spec = { tag: "aside", selector: "#recent", cls: "recently-viewed", children: [{ tag: "article", selector: "#recent > article", record: { keyAttribute: "data-title-id", key: "title-9" }, children: [{ tag: "h3", selector: "#recent h3", text: "Middlemarch" }] }] };
  const drawer: Spec = { tag: "aside", selector: "#loans", cls: "loans-drawer", children: [{ tag: "ul", selector: "#loans > ul", cls: "loans", children: [loan(1, "Dune")] }] };
  const before = libraryPage([line(1, DUNE), line(2, EMMA)], [recent]);
  const after = libraryPage([line(1, DUNE), line(2, EMMA)], [recent, drawer]);
  assert.deepEqual(created(step(before, after, press("#open-loans"))), []);
});

test("a step that moved to another document names its spot and vouches for no list", () => {
  const before = libraryPage([line(1, DUNE), line(2, EMMA)]);
  const after = sanitizeWebLlmSnapshotWithBindings(capture("https://library.test/titles/ivanhoe", [{ tag: "main", selector: "main", children: [{ tag: "ul", selector: "#reading > ul", cls: "lines", children: [line(1, DUNE), line(2, EMMA), line(3, IVANHOE)] }] }]));
  const diff = step(before, after, press("#catalogue > li:nth-of-type(3) > h3"), true);
  assert.deepEqual(diff.spot, { item: tokenAt(before, "#catalogue > li:nth-of-type(3)") });
  assert.equal(diff.items, undefined);
});

test("a line added, removed and added again is created both times, by the same token", () => {
  const two = libraryPage([line(1, DUNE), line(2, EMMA)]);
  const three = libraryPage([line(1, DUNE), line(2, EMMA), line(3, IVANHOE)]);
  const add = press("#catalogue > li:nth-of-type(3) > button");
  const first = created(step(two, three, add));
  assert.deepEqual(created(step(three, two, press("#reading > ul > li:nth-of-type(3) > button"))), []);
  const again = created(step(two, three, add));
  assert.equal(first.length, 1);
  assert.deepEqual(again, first);
});

test("a list that lost or changed an item at the same time, or whose one line the page named by nothing, vouches for nothing", () => {
  const before = libraryPage([line(1, DUNE), line(2, `${EMMA} 1 copy`)]);
  // Emma's line changed its words (another copy) while Ivanhoe arrived: which line is new cannot be told.
  const changed = libraryPage([line(1, DUNE), line(2, `${EMMA} 2 copies`), line(3, IVANHOE)]);
  assert.deepEqual(created(step(before, changed, press("#catalogue > li:nth-of-type(3) > button"))), []);
  // One unkeyed line is named by nothing; beside a new one both gain names, and neither is vouched new.
  const single = libraryPage([{ tag: "li", selector: "#reading > ul > li:nth-of-type(1)", cls: "line", children: [{ tag: "button", selector: "#reading > ul > li:nth-of-type(1) > button", text: "Remove" }] }]);
  assert.deepEqual(created(step(single, libraryPage([line(1, DUNE), line(2, IVANHOE)]), press("#catalogue > li:nth-of-type(3) > button"))), []);
  // A line the site marks as just added is still one of the list's.
  assert.equal(created(step(libraryPage([line(1, DUNE), line(2, EMMA)]), libraryPage([line(1, DUNE), line(2, EMMA), line(3, IVANHOE, "line is-new")]), press("#catalogue > li:nth-of-type(3) > button"))).length, 1);
});

test("the memory keeps the latest snapshots' places only", () => {
  const memo = createWebStatePlacesMemo(2);
  const places = webStateSnapshotPlaces(libraryPage([line(1, DUNE), line(2, EMMA)]));
  memo.keep("web.state.1@a:before_action", places);
  memo.keep("web.state.2@a:after_action", places);
  memo.keep("web.state.3@b:after_action", places);
  assert.equal(memo.of("web.state.1@a:before_action"), undefined);
  assert.equal(memo.of("web.state.3@b:after_action"), places);
  assert.equal(memo.of(undefined), undefined);
});

// Core t719: a trial's add pressed on a title's own page sits in no item, and
// the line it makes is on another page; the spot also says what the control and
// its page are about, so a reset's undo on that line can be tied to the step.
test("a step's control in no item still names what it and its page are about, as opaque tokens", () => {
  const titlePage = sanitizeWebLlmSnapshotWithBindings({ url: "https://library.test/titles/ivanhoe", title: "Library", interactiveElements: [
    { tagName: "main", selector: "main" },
    { tagName: "h1", selector: "main > h1", text: "Ivanhoe", name: "Ivanhoe", parent: 0, context: { subject: "Ivanhoe" } },
    { tagName: "button", selector: "main > button", text: "Add to list", name: "Add to list", parent: 0, context: { subject: "Walter Scott" } }
  ] });
  const diff = step(titlePage, titlePage, press("main > button"));
  assert.deepEqual(diff.spot, { subject: webControlSpotToken("subject", "Walter Scott"), page: webControlSpotToken("subject", "Ivanhoe") });
  assert.doesNotMatch(JSON.stringify(diff), /Ivanhoe|Walter/u);
});


test("trial diffs preserve immediate complete resource-bound inventories without publishing raw names", () => {
  const captured = (name: string, quantity: string, source = "tab:1:frame:0") => {
    const binding = sanitizeWebLlmSnapshotWithBindings({ url: "https://library.test/documents", title: "Documents", interactiveElements: [
      { tagName: "div", role: "list", selector: "#documents" },
      { tagName: "div", role: "listitem", selector: "#row", parent: 0, attributes: { "aria-setsize": "1", "aria-posinset": "1" } },
      { tagName: "button", selector: "#move", parent: 1, name: "Move", context: { subject: name } },
      { tagName: "input", selector: "#count", parent: 1, value: quantity, context: { subject: name } }
    ] });
    binding.resetResource = webResetResource("session.one", source)!;
    return binding;
  };
  const before = captured("First document", "2"), after = captured("Other document", "3");
  const diff = webStateDiffPlaces(webStateSnapshotPlaces(before), webStateSnapshotPlaces(after), { definitionId: "web.output.dom-click", parameterValues: { selector: "#move" } }, false);
  assert.deepEqual(diff.collections, { before: webResetCollections(before).collections, after: webResetCollections(after).collections });
  assert.doesNotMatch(JSON.stringify(diff.collections), /First document|Other document|tab:1|session.one/u);
  assert.equal(webStateDiffPlaces(webStateSnapshotPlaces(before), webStateSnapshotPlaces(after), { definitionId: "web.output.dom-click" }, true).collections, undefined);
  const different = captured("Other document", "3", "tab:2:frame:0");
  assert.equal(webStateDiffPlaces(webStateSnapshotPlaces(before), webStateSnapshotPlaces(different), { definitionId: "web.output.dom-click" }, false).collections, undefined);
});

// L1 reset settlement: a step whose control is a stateful one carries that
// control's place and state on its spot, and how many controls at that place
// showed each state before and after it, so Core reads a toggle the trial
// pressed and the press that turns it back.
test("a step pressing a toggle carries its place and state, and the counts at that place before and after", () => {
  const titlePage = (held: boolean, source = "tab:1:frame:0") => {
    const binding = sanitizeWebLlmSnapshotWithBindings({ url: "https://library.test/titles/ivanhoe", title: "Library", interactiveElements: [
      { tagName: "main", selector: "main" },
      { tagName: "div", role: "button", selector: "main > div.hold", name: held ? "Cancel hold" : "Place hold", attributes: { "aria-pressed": String(held) }, parent: 0 },
      { tagName: "div", role: "button", selector: "main > div.share", name: "Share", parent: 0 }
    ] });
    binding.resetResource = webResetResource("session.one", source)!;
    return binding;
  };
  const before = titlePage(false), after = titlePage(true);
  const hold = { definitionId: "web.output.dom-click", parameterValues: { selector: "main > div.hold" } };
  const diff = step(before, after, hold);
  const spot = diff.spot as { place?: string; state?: string; scope?: string };
  assert.ok(spot.place && spot.state, "a toggle in no record, dialog or subject still has a spot");
  const resource = webResetResource("session.one", "tab:1:frame:0");
  const controls = diff.controls as { page: string; location: string; before: Record<string, number>; after: Record<string, number> };
  assert.equal(controls.page, webControlSpotToken("scope", `${resource}\0https://library.test/titles/ivanhoe`), "the page's scope as a start-state read names it");
  assert.equal(controls.page, spot.scope);
  // And the location that scope is built from, as a start-state read carries `location` beside `scope` (L1 d7).
  assert.equal(controls.location, "https://library.test/titles/ivanhoe");
  assert.deepEqual(controls.before, webControlStates(before)[spot.place]);
  assert.deepEqual(controls.after, webControlStates(after)[spot.place]);
  assert.equal(controls.before[spot.state], 1, "the hold showed the state it was pressed in");
  assert.equal(controls.after[spot.state], undefined, "and no longer shows it");
  assert.equal(Object.values(controls.after).reduce((sum, count) => sum + count, 0), 2, "the hold and the share button share the page's place");
  // Only the location names the page in words; nothing else the diff carries does.
  const { location: _location, ...opaque } = controls;
  assert.doesNotMatch(JSON.stringify({ ...diff, controls: opaque }), /hold|Share|ivanhoe/u);
  // A step that moved to another document carries no counts, and a control with no state has no place.
  assert.equal(step(before, after, hold, true).controls, undefined);
  assert.equal(step(before, after, press("main")).controls, undefined);
});
