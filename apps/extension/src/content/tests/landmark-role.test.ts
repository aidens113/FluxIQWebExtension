// One landmark rule, read from both ends.
//
// `identity/context.ts` asks "which landmark is this element inside?" for every
// described element, and `evidence/regions.ts` asks "which landmarks does this
// page have?". Until Phase 1.4 each answered with its own byte-identical copy
// of the rule, which is the shape of duplication that already leaked a billing
// card number elsewhere in this plan. Here the consequence would be quieter --
// an element's `context.landmark` naming a region the region list does not
// contain -- but the fix is the same, and this is the test that keeps it fixed:
// the same elements are put to both call sites and the answers must match.
//
// The two subjects live in sibling directories, so the test sits in the tests/
// folder of the nearest directory holding both. The DOM is a stub rather than a
// browser because the runner is Node; the browser-side coverage of the region
// list is `e2e/content/tests/evidence.spec.ts`.

import assert from "node:assert/strict";
import { test } from "node:test";
import { regionEvidence } from "../evidence";
import { elementContext, landmarkRole } from "../identity";

type Fixture = { readonly what: string; readonly role: string | undefined; readonly element: Element };

class StubElement {
  readonly parentElement: Element | null = null;
  readonly previousElementSibling: Element | null = null;
  readonly children: readonly Element[] = [];
  readonly textContent = "";
  readonly labels: undefined;
  private readonly attributes: Map<string, string>;

  constructor(readonly tagName: string, readonly id: string, attributes: Record<string, string>) {
    this.attributes = new Map(Object.entries(attributes));
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  hasAttribute(name: string): boolean {
    return this.attributes.has(name);
  }

  closest(): Element | null {
    return null;
  }

  getBoundingClientRect(): { left: number; top: number; right: number; bottom: number; width: number; height: number } {
    return { left: 0, top: 0, right: 40, bottom: 40, width: 40, height: 40 };
  }
}

function stub(tagName: string, id: string, attributes: Record<string, string> = {}): Element {
  return new StubElement(tagName, id, attributes) as unknown as Element;
}

// Every row a landmark decision turns on: the implied roles, the two tags that
// need an authored name, and an explicit role replacing the tag's own whether
// or not it is a landmark.
const fixtures: readonly Fixture[] = [
  { what: "a <main>", role: "main", element: stub("MAIN", "page") },
  { what: "a <nav>", role: "navigation", element: stub("NAV", "primary-nav") },
  { what: "a <header>", role: "banner", element: stub("HEADER", "masthead") },
  { what: "a <footer>", role: "contentinfo", element: stub("FOOTER", "colophon") },
  { what: "an <aside>", role: "complementary", element: stub("ASIDE", "sidebar") },
  { what: "a <search>", role: "search", element: stub("SEARCH", "finder") },
  { what: "an unnamed <section>", role: undefined, element: stub("SECTION", "unnamed-section") },
  { what: "a named <section>", role: "region", element: stub("SECTION", "filters", { "aria-label": "Filters" }) },
  { what: "a <section> named by reference", role: "region", element: stub("SECTION", "results", { "aria-labelledby": "results-heading" }) },
  { what: "an unnamed <form>", role: undefined, element: stub("FORM", "unnamed-form") },
  { what: "a titled <form>", role: "form", element: stub("FORM", "checkout", { title: "Checkout" }) },
  { what: "a <div> given a landmark role", role: "navigation", element: stub("DIV", "pager", { role: "navigation" }) },
  { what: "a <nav> given a different landmark role", role: "region", element: stub("NAV", "toc", { role: "region" }) },
  { what: "a <section> given a non-landmark role", role: undefined, element: stub("SECTION", "decor", { role: "presentation" }) }
];

installStubDom();

test("the shared rule decides a landmark by tag, by explicit role, and by whether the page named it", () => {
  for (const fixture of fixtures) {
    assert.equal(landmarkRole(fixture.element), fixture.role, fixture.what);
  }
});

test("the context call site reports the same role the rule gives", () => {
  for (const fixture of fixtures) {
    assert.equal(elementContext(fixture.element)?.landmark, fixture.role, fixture.what);
  }
});

test("the region call site reports the same role the rule gives, for the same elements", () => {
  const landmarks = fixtures.filter((fixture) => fixture.role !== undefined);
  const regions = regionEvidence();
  assert.deepEqual(regions?.map((region) => region.role), landmarks.map((fixture) => fixture.role));
  assert.deepEqual(regions?.map((region) => region.selector), landmarks.map((fixture) => `#${fixture.element.id}`));
});

test("neither call site is answering from a rule of its own", () => {
  for (const fixture of fixtures) {
    const region = regionEvidence()?.find((candidate) => candidate.selector === `#${fixture.element.id}`);
    assert.equal(region?.role, elementContext(fixture.element)?.landmark, fixture.what);
  }
});

/**
 * The least DOM the two call sites read. `regionEvidence` sweeps the document
 * for landmark candidates and describes each one; `elementContext` walks up
 * from an element. Everything either one asks for that a stub element cannot
 * answer is answered here, and nothing more, so a rule that started reading
 * something new would fail loudly rather than quietly.
 */
function installStubDom(): void {
  const globals = globalThis as unknown as Record<string, unknown>;
  globals["document"] = {
    documentElement: {},
    getElementById: () => null,
    // The sweep asks for the landmark candidates; `associatedLabel` asks for a
    // `<label for>` of a control, which none of these are.
    querySelectorAll: (selector: string) => (selector.startsWith("label[") ? [] : fixtures.map((fixture) => fixture.element))
  };
  globals["window"] = { innerWidth: 1280, innerHeight: 800, scrollX: 0, scrollY: 0 };
  globals["CSS"] = { escape: (value: string) => value };
  for (const name of ["HTMLElement", "HTMLInputElement", "HTMLSelectElement", "HTMLTextAreaElement", "HTMLTableCellElement"]) {
    globals[name] = class {};
  }
}
