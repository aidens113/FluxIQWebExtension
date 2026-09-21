// What `elementContext` puts on the wire, now that it is written through
// `present<DomElementContext>` rather than assembled by spreads.
//
// The half that matters most is not checkable at run time and is not here: a
// renamed or deleted field is a compile error, proven by the mutation in
// `x-context-producer`'s report and pinned for the general case by
// `shared/tests/present.test.ts`. What *is* checkable here is the half a
// compile-time guarantee cannot state -- that the conversion did not change a
// single byte of the value. `present` and the `compactObject` it replaced
// differ in what they check, not in what they build, so the same page must
// still produce the same object: the same keys, in the same order, with the
// absent ones absent rather than present and `undefined`.
//
// That last point is the one to defend. Every key of `DomElementContext` is
// optional, so a regression that started emitting `{ formName: undefined }`
// would satisfy the type, satisfy `check`, and put a null-valued field on the
// wire. `deepStrictEqual` compares key sets, so the rows below fail if it ever
// does.
//
// The rows at the foot are decision D2 of the data-extraction plan: `context`
// rides on every descriptor, a sensitive control's included, so each string it
// reads from the page -- the legend, the heading, the column header, the text
// of a landmark's reference -- leaves out what a sensitive control holds.
//
// The DOM is a stub because the extension's unit runner is Node. The text
// readers ask the shared sensitivity rule of each element, and that rule names
// `HTMLInputElement`, so every row runs under the globals of
// `content/tests/stub-page.ts`, whose hand-built elements are also the
// text-bearing pieces of the rows at the foot. The browser side of this module
// is `e2e/content/tests/` (`identity-signals.spec.ts` for the landmark's name,
// `evidence.spec.ts` for sensitive contents) and the region half of the landmark
// rule is `content/tests/landmark-role.test.ts`.

import assert from "node:assert/strict";
import test from "node:test";
import { element, withStubPage } from "../../tests/stub-page";

type ContextModule = typeof import("../context");

const load = (): Promise<ContextModule> => import("../context");

/** Runs `body` against `elementContext` with the stub page's globals installed, and put back afterwards. */
function withContext(body: (elementContext: ContextModule["elementContext"]) => void): Promise<void> {
  return withStubPage(load, ({ elementContext }) => body(elementContext));
}

type StubOptions = {
  readonly tagName?: string;
  readonly attributes?: Record<string, string>;
  readonly closest?: Record<string, Element | null>;
  readonly querySelector?: Element | null;
  /** What `querySelectorAll` answers, whatever the selector: the headings inside a preceding sibling. */
  readonly querySelectorAll?: readonly Element[];
  readonly form?: Element | null;
  readonly textContent?: string;
  readonly parentElement?: Element | null;
  readonly previousElementSibling?: Element | null;
  readonly firstElementChild?: Element | null;
  readonly contentEditable?: boolean;
  /** What the element's own document answers to `getElementById`. */
  readonly byId?: Record<string, Element>;
};

/** An element that answers only the lookups `context.ts` performs, and `null` to the rest. */
function stub(options: StubOptions = {}): Element {
  const attributes = options.attributes ?? {};
  const closest = options.closest ?? {};
  return {
    // Uppercase as a real element reports it: `landmarkRole` lowercases it, and
    // a stub that handed it an already-lowercase string would not prove that.
    tagName: options.tagName ?? "DIV",
    parentElement: options.parentElement ?? null,
    previousElementSibling: options.previousElementSibling ?? null,
    firstElementChild: options.firstElementChild ?? null,
    children: [],
    childNodes: [],
    textContent: options.textContent ?? "",
    form: options.form ?? null,
    isContentEditable: options.contentEditable ?? false,
    ownerDocument: { getElementById: (id: string) => options.byId?.[id] ?? null },
    getAttribute: (name: string) => attributes[name] ?? null,
    hasAttribute: (name: string) => name in attributes,
    closest: (selector: string) => closest[selector] ?? null,
    querySelector: () => options.querySelector ?? null,
    querySelectorAll: () => options.querySelectorAll ?? [],
    matches: () => false,
    // An element in an ordinary document, so the shadow host chain is empty.
    getRootNode: () => ({ nodeType: 9 })
  } as unknown as Element;
}

test("a form-associated control reports the form that owns it", () => withContext((elementContext) => {
  const form = stub({ attributes: { id: "signup", name: "Sign up", action: "/join" } });
  assert.deepStrictEqual(elementContext(stub({ form })), {
    formId: "signup",
    formName: "Sign up",
    formAction: "/join"
  });
}));

test("a control inside a form reports it too, found by walking up", () => withContext((elementContext) => {
  // No `form` property, so the only way to it is `closest("form")` -- the other
  // half of the rule, and the half a control that opted in through `form="id"`
  // does not exercise.
  const form = stub({ attributes: { name: "search" } });
  assert.deepStrictEqual(elementContext(stub({ closest: { form } })), { formName: "search" });
}));

test("a form attribute the page never set leaves its key out, not undefined", () => withContext((elementContext) => {
  const form = stub({ attributes: { id: "signup" } });
  const context = elementContext(stub({ form }));
  assert.deepStrictEqual(Object.keys(context ?? {}), ["formId"]);
  assert.equal("formName" in (context ?? {}), false);
}));

test("the fieldset legend is reported as bounded text", () => withContext((elementContext) => {
  const legend = stub({ textContent: "  Billing   address\n" });
  const fieldset = stub({ querySelector: legend });
  assert.deepStrictEqual(elementContext(stub({ closest: { fieldset } })), { fieldsetLegend: "Billing address" });
}));

test("the keys keep the contract's order, with the absent ones simply gone", () => withContext((elementContext) => {
  const form = stub({ attributes: { name: "checkout" } });
  const fieldset = stub({ querySelector: stub({ textContent: "Card" }) });
  const context = elementContext(stub({ form, closest: { fieldset } }));
  // formId and formAction sit between these two on the contract and in the
  // literal; neither appears, and `fieldsetLegend` still follows `formName`.
  assert.deepStrictEqual(Object.keys(context ?? {}), ["formName", "fieldsetLegend"]);
}));

test("an element with nothing around it has no context at all", () => withContext((elementContext) => {
  // Not an object of nine undefined values, and not an empty object: the
  // descriptor omits the field entirely.
  assert.equal(elementContext(stub()), undefined);
}));

// --- The landmark around it, and its name (B5) ------------------------------
//
// A role says what kind of landmark an element sits in, and two `region`s on
// one page share it. The name is what tells them apart, read in the order the
// accessible-name calculation reads one for an element never named by content.

test("a control inside a landmark named by aria-label reports the role, then the name", () => withContext((elementContext) => {
  const nav = stub({ tagName: "NAV", attributes: { "aria-label": "  Account \n menu " } });
  const context = elementContext(stub({ tagName: "INPUT", parentElement: nav }));
  assert.deepStrictEqual(context, { landmark: "navigation", landmarkName: "Account menu" });
  assert.deepStrictEqual(Object.keys(context ?? {}), ["landmark", "landmarkName"]);
}));

test("a region named by reference reports the referenced text, in the order the ids are listed", () => withContext((elementContext) => {
  const section = stub({
    tagName: "SECTION",
    attributes: { "aria-labelledby": "billing-title billing-hint", "aria-label": "Not this one" },
    byId: {
      "billing-title": stub({ tagName: "H2", textContent: "Billing" }),
      "billing-hint": stub({ tagName: "P", textContent: " details\n" })
    }
  });
  assert.deepStrictEqual(elementContext(stub({ parentElement: section })), { landmark: "region", landmarkName: "Billing details" });
}));

test("a reference that finds nothing falls back to aria-label, and then to title", () => withContext((elementContext) => {
  const labelled = stub({ tagName: "SECTION", attributes: { "aria-labelledby": "gone", "aria-label": "Shipping" } });
  assert.equal(elementContext(stub({ parentElement: labelled }))?.landmarkName, "Shipping");
  const titled = stub({ tagName: "FORM", attributes: { title: "Checkout" } });
  assert.deepStrictEqual(elementContext(stub({ parentElement: titled })), { landmark: "form", landmarkName: "Checkout" });
}));

test("a reference to a form control or an editable region names nothing, so nothing typed becomes a name", () => withContext((elementContext) => {
  // `context` rides on every control, a password field included, so this is the
  // one path by which what a person typed could reach the wire through it.
  const typed = "hunter2-typed-into-the-page";
  const section = stub({
    tagName: "SECTION",
    attributes: { "aria-labelledby": "note draft code" },
    byId: {
      note: stub({ tagName: "TEXTAREA", textContent: typed }),
      draft: stub({ tagName: "DIV", textContent: typed, contentEditable: true }),
      code: stub({ tagName: "INPUT", textContent: typed })
    }
  });
  const context = elementContext(stub({ parentElement: section }));
  assert.deepStrictEqual(context, { landmark: "region" });
  assert.equal(JSON.stringify(context).includes(typed), false);
}));

test("a landmark the page did not name reports its role and no name key", () => withContext((elementContext) => {
  const main = stub({ tagName: "MAIN" });
  const context = elementContext(stub({ parentElement: main }));
  assert.deepStrictEqual(context, { landmark: "main" });
  assert.equal("landmarkName" in (context ?? {}), false);
}));

// --- A sensitive control's contents (D2) ------------------------------------
//
// Each page string `context` carries is read less what a sensitive control
// holds: a reference, legend, heading or header cell holding a marked element
// keeps its other words, and one that sits inside a sensitive control gives
// nothing.

/** A marked span, whose words are what the element the shared rule marks holds. */
const marked = (words: string) => element("span", { "data-sensitive": "true" }, words);

/** `target`, answering `matches` with `result` whatever the selector. */
function matching(target: Element, result: boolean): Element {
  Object.defineProperty(target, "matches", { value: () => result });
  return target;
}

test("the fieldset legend leaves out what a sensitive control inside it holds", () => withContext((elementContext) => {
  const legend = element("legend", {}, "Delivery ", marked("SYNTHETIC_LEGEND_WORDS"), " address");
  const fieldset = stub({ querySelector: legend });
  assert.deepStrictEqual(elementContext(stub({ closest: { fieldset } })), { fieldsetLegend: "Delivery address" });
}));

test("the heading before a control leaves out what a sensitive control inside it holds, whichever way it is found", () => withContext((elementContext) => {
  const heading = () => matching(element("h2", {}, "Account ", marked("SYNTHETIC_HEADING_WORDS")), true);
  // The preceding sibling is the heading.
  assert.deepStrictEqual(elementContext(stub({ previousElementSibling: heading() })), { heading: "Account" });
  // The heading is the last one inside a preceding sibling.
  const section = stub({ firstElementChild: stub(), querySelectorAll: [heading()] });
  assert.deepStrictEqual(elementContext(stub({ previousElementSibling: section })), { heading: "Account" });
}));

test("a landmark's reference leaves out what a sensitive control inside it holds, and one inside a sensitive control names nothing", () => withContext((elementContext) => {
  const section = stub({
    tagName: "SECTION",
    attributes: { "aria-labelledby": "notes-name" },
    byId: { "notes-name": element("span", {}, "Saved notes ", marked("SYNTHETIC_REGION_WORDS")) }
  });
  assert.deepStrictEqual(elementContext(stub({ parentElement: section })), { landmark: "region", landmarkName: "Saved notes" });
  // The reference sits inside a marked region, so its words are that region's contents and the name falls through.
  const inside = element("span", {}, "SYNTHETIC_REGION_WORDS");
  element("div", { "data-sensitive": "true" }, inside);
  const fallback = stub({ tagName: "SECTION", attributes: { "aria-labelledby": "inside", "aria-label": "Drafts" }, byId: { inside } });
  assert.deepStrictEqual(elementContext(stub({ parentElement: fallback })), { landmark: "region", landmarkName: "Drafts" });
}));

/** Marks a table part so `instanceof` against the globals `withTableGlobals` installs recognises it. */
const TABLE_PART = Symbol("table part");

/** A cell, row or table that answers `closest` from `closest` and carries `fields`. */
function tablePart(kind: string, fields: Record<string, unknown>, closest: Record<string, Element> = {}): Element {
  return { [TABLE_PART]: kind, ...fields, closest: (selector: string) => closest[selector] ?? null } as unknown as Element;
}

/** Runs `body` with `HTMLTableCellElement`, `HTMLTableRowElement` and `HTMLTableElement` recognising `tablePart`s. */
async function withTableGlobals(body: () => Promise<void>): Promise<void> {
  const kindOf = (kind: string) => ({ [Symbol.hasInstance]: (value: unknown) => (value as Record<symbol, unknown> | null)?.[TABLE_PART] === kind });
  const globals = globalThis as unknown as Record<string, unknown>;
  const installed: Record<string, unknown> = { HTMLTableCellElement: kindOf("cell"), HTMLTableRowElement: kindOf("row"), HTMLTableElement: kindOf("table") };
  const previous = new Map(Object.keys(installed).map((name) => [name, Object.getOwnPropertyDescriptor(globals, name)] as const));
  Object.assign(globals, installed);
  try {
    await body();
  } finally {
    for (const [name, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globals, name, descriptor);
      else delete globals[name];
    }
  }
}

test("the column header leaves out what a sensitive control inside it holds", () => withTableGlobals(() => withContext((elementContext) => {
  const header = element("th", {}, "Card ", marked("SYNTHETIC_COLUMN_WORDS"));
  const table = tablePart("table", { tHead: { rows: [{ cells: [header] }] }, rows: [] });
  const row = tablePart("row", { rowIndex: 1 }, { table });
  const cell = tablePart("cell", { cellIndex: 0 }, { tr: row });
  assert.deepStrictEqual(elementContext(stub({ closest: { "td,th": cell } })), { tablePosition: { row: 2, column: 1, columnHeader: "Card" } });
})));
