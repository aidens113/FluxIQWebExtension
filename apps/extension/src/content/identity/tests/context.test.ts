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
// side of this module is `e2e/content/tests/` and the region half of the
// landmark rule is `content/tests/landmark-role.test.ts`.

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
};

/** An element that answers only the lookups `context.ts` performs, and `null` to the rest. */
function stub(options: StubOptions = {}): Element {
  const attributes = options.attributes ?? {};
  const closest = options.closest ?? {};
  return {
    // Uppercase as a real element reports it: `landmarkRole` lowercases it, and
    // a stub that handed it an already-lowercase string would not prove that.
    tagName: options.tagName ?? "DIV",
    parentElement: null,
    previousElementSibling: null,
    children: [],
    textContent: options.textContent ?? "",
    form: options.form ?? null,
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
  // Not an object of eight undefined values, and not an empty object: the
  // descriptor omits the field entirely.
  assert.equal(elementContext(stub()), undefined);
});
