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
// The DOM is a stub because the extension's unit runner is Node; the browser
// side of this module is `e2e/content/tests/` (`identity-signals.spec.ts` for
// the landmark's name) and the region half of the landmark rule is
// `content/tests/landmark-role.test.ts`.

import assert from "node:assert/strict";
import test from "node:test";
import { elementContext } from "../context";

type StubOptions = {
  readonly tagName?: string;
  readonly attributes?: Record<string, string>;
  readonly closest?: Record<string, Element | null>;
  readonly querySelector?: Element | null;
  readonly form?: Element | null;
  readonly textContent?: string;
  readonly parentElement?: Element | null;
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
    previousElementSibling: null,
    children: [],
    textContent: options.textContent ?? "",
    form: options.form ?? null,
    isContentEditable: options.contentEditable ?? false,
    ownerDocument: { getElementById: (id: string) => options.byId?.[id] ?? null },
    getAttribute: (name: string) => attributes[name] ?? null,
    hasAttribute: (name: string) => name in attributes,
    closest: (selector: string) => closest[selector] ?? null,
    querySelector: () => options.querySelector ?? null,
    matches: () => false
  } as unknown as Element;
}

test("a form-associated control reports the form that owns it", () => {
  const form = stub({ attributes: { id: "signup", name: "Sign up", action: "/join" } });
  assert.deepStrictEqual(elementContext(stub({ form })), {
    formId: "signup",
    formName: "Sign up",
    formAction: "/join"
  });
});

test("a control inside a form reports it too, found by walking up", () => {
  // No `form` property, so the only way to it is `closest("form")` -- the other
  // half of the rule, and the half a control that opted in through `form="id"`
  // does not exercise.
  const form = stub({ attributes: { name: "search" } });
  assert.deepStrictEqual(elementContext(stub({ closest: { form } })), { formName: "search" });
});

test("a form attribute the page never set leaves its key out, not undefined", () => {
  const form = stub({ attributes: { id: "signup" } });
  const context = elementContext(stub({ form }));
  assert.deepStrictEqual(Object.keys(context ?? {}), ["formId"]);
  assert.equal("formName" in (context ?? {}), false);
});

test("the fieldset legend is reported as bounded text", () => {
  const legend = stub({ textContent: "  Billing   address\n" });
  const fieldset = stub({ querySelector: legend });
  assert.deepStrictEqual(elementContext(stub({ closest: { fieldset } })), { fieldsetLegend: "Billing address" });
});

test("the keys keep the contract's order, with the absent ones simply gone", () => {
  const form = stub({ attributes: { name: "checkout" } });
  const fieldset = stub({ querySelector: stub({ textContent: "Card" }) });
  const context = elementContext(stub({ form, closest: { fieldset } }));
  // formId and formAction sit between these two on the contract and in the
  // literal; neither appears, and `fieldsetLegend` still follows `formName`.
  assert.deepStrictEqual(Object.keys(context ?? {}), ["formName", "fieldsetLegend"]);
});

test("an element with nothing around it has no context at all", () => {
  // Not an object of nine undefined values, and not an empty object: the
  // descriptor omits the field entirely.
  assert.equal(elementContext(stub()), undefined);
});

// --- The landmark around it, and its name (B5) ------------------------------
//
// A role says what kind of landmark an element sits in, and two `region`s on
// one page share it. The name is what tells them apart, read in the order the
// accessible-name calculation reads one for an element never named by content.

test("a control inside a landmark named by aria-label reports the role, then the name", () => {
  const nav = stub({ tagName: "NAV", attributes: { "aria-label": "  Account \n menu " } });
  const context = elementContext(stub({ tagName: "INPUT", parentElement: nav }));
  assert.deepStrictEqual(context, { landmark: "navigation", landmarkName: "Account menu" });
  assert.deepStrictEqual(Object.keys(context ?? {}), ["landmark", "landmarkName"]);
});

test("a region named by reference reports the referenced text, in the order the ids are listed", () => {
  const section = stub({
    tagName: "SECTION",
    attributes: { "aria-labelledby": "billing-title billing-hint", "aria-label": "Not this one" },
    byId: {
      "billing-title": stub({ tagName: "H2", textContent: "Billing" }),
      "billing-hint": stub({ tagName: "P", textContent: " details\n" })
    }
  });
  assert.deepStrictEqual(elementContext(stub({ parentElement: section })), { landmark: "region", landmarkName: "Billing details" });
});

test("a reference that finds nothing falls back to aria-label, and then to title", () => {
  const labelled = stub({ tagName: "SECTION", attributes: { "aria-labelledby": "gone", "aria-label": "Shipping" } });
  assert.equal(elementContext(stub({ parentElement: labelled }))?.landmarkName, "Shipping");
  const titled = stub({ tagName: "FORM", attributes: { title: "Checkout" } });
  assert.deepStrictEqual(elementContext(stub({ parentElement: titled })), { landmark: "form", landmarkName: "Checkout" });
});

test("a reference to a form control or an editable region names nothing, so nothing typed becomes a name", () => {
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
});

test("a landmark the page did not name reports its role and no name key", () => {
  const main = stub({ tagName: "MAIN" });
  const context = elementContext(stub({ parentElement: main }));
  assert.deepStrictEqual(context, { landmark: "main" });
  assert.equal("landmarkName" in (context ?? {}), false);
});
