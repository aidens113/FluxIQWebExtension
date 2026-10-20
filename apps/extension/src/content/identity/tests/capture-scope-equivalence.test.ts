// A capture scope changes what the row walk costs, never what it answers
// (t733). Inside `withSelectorMemo` the climb of `control-row/` reads a
// per-root index of alike controls and derives a fruitless walk's outcome from
// descendant counts; outside one it walks the live page. On each page below,
// every control's ancestors, twin, row, record, subject and row check must be
// the same either way, element for element. The pages are made up; each
// covers one way the climb ends, and says so before comparing.

import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { withSelectorMemo } from "../../selector";
import { el, installStubDocument, stubDocument, type StubElement } from "../../tests/stub-dom";
import { controlRow, soleAncestors } from "../control-row";
import { agreesWithRecordedRecord, recordIdentity, recordSubject, repeatedRowOf } from "../record";

const asElement = (element: StubElement): Element => element as unknown as Element;

/** Installs a page whose body holds `children`, and returns its html element. */
function install(t: TestContext, ...children: StubElement[]): StubElement {
  const document = stubDocument();
  const html = el("html", {}, el("body", {}, ...children));
  document.append(html);
  installStubDocument(t, document);
  return html;
}

/** Every element under `root`, shadow trees included, in document order. */
function everyElement(root: StubElement): StubElement[] {
  const found: StubElement[] = [root];
  for (const child of root.children) found.push(...everyElement(child));
  if (root.shadowRoot) for (const child of root.shadowRoot.children) found.push(...everyElement(child));
  return found;
}

/** Each element's answers, with every element written as its index on the page so two runs compare by identity. */
function answers(elements: readonly StubElement[], page: readonly StubElement[]): unknown[] {
  const index = new Map<Element, number>(page.map((element, position) => [asElement(element), position]));
  const id = (element: Element | undefined): number | undefined => (element === undefined ? undefined : index.get(element) ?? -1);
  return elements.map((stub) => {
    const element = asElement(stub);
    const sole = soleAncestors(element);
    const row = controlRow(element);
    const identity = recordIdentity(element);
    return {
      element: id(element),
      ancestors: sole.ancestors.map(id),
      twin: id(sole.twin),
      row: row && { row: id(row.row), twin: id(row.twin), twinRow: id(row.twinRow) },
      identity,
      subject: recordSubject(element),
      repeatedRow: id(repeatedRowOf(element)),
      agrees: agreesWithRecordedRecord(identity, element)
    };
  });
}

/** Asserts the answers inside one scope -- asked twice, so the second round reads what the first kept -- equal those outside it. */
function assertSameInsideScope(html: StubElement, filter: (element: StubElement) => boolean = (element) => element.localName !== "span"): void {
  const page = everyElement(html);
  const asked = page.filter(filter);
  const outside = answers(asked, page);
  const inside = withSelectorMemo(() => [answers(asked, page), answers(asked, page)]);
  assert.deepEqual(inside[0], outside);
  assert.deepEqual(inside[1], outside);
}

test("twin found, a far twin, a nameless control, a nested alike and a lone control answer alike inside a scope", (t) => {
  const line = (title: StubElement): StubElement =>
    el("div", { class: "line" }, title, el("select", { "aria-label": "Qty" }), el("button", {}), el("button", {}, "Remove"));
  const nestedInner = el("button", { "aria-label": "Open" });
  const nestedOuter = el("div", { role: "button", "aria-label": "Open" }, nestedInner);
  const html = install(
    t,
    el("header", {}, el("button", {}, "Sign in"), nestedOuter),
    el("main", {},
      el("section", { "aria-label": "Detail" }, el("h1", {}, "Pear galette"), el("button", {}, "Add to cart")),
      el("div", { class: "cart" },
        line(el("a", { href: "/soap" }, "Soap")),
        line(el("a", { href: "/towels" }, "Towels")),
        line(el("h3", {}, "Mugs")))),
    el("footer", {}, el("p", {}, "Help"), el("button", {}, "Sign in"))
  );
  const [first, , last] = html.querySelectorAll("select");
  assert.equal(soleAncestors(asElement(first as StubElement)).twin, last, "a twin is found in another line, the last first");
  const signIn = html.querySelector("header > button") as StubElement;
  assert.equal(soleAncestors(asElement(signIn)).twin, html.querySelector("footer > button"), "the header's Sign in finds the footer's");
  assert.equal(soleAncestors(asElement(nestedInner)).twin, undefined, "an alike ancestor is never a twin");
  assert.equal(soleAncestors(asElement(nestedOuter)).twin, undefined, "an alike descendant is never a twin");
  assertSameInsideScope(html);
});

test("no twin within budget: fifty uniquely named links climb to the top inside a scope as outside", (t) => {
  const links = Array.from({ length: 50 }, (_, index) => el("a", { href: `/item/${index}` }, `Item ${index}`));
  const html = install(t, el("div", { class: "list" }, ...links.map((link) => el("div", { class: "cell" }, link))));
  assert.equal(soleAncestors(asElement(links[7] as StubElement)).ancestors.length, 4, "cell, list, body, html");
  assertSameInsideScope(html);
});

test("budget cut short: a twin beyond a sibling of more than 2,000 nodes is no twin, inside a scope as outside", (t) => {
  const near = el("select", { "aria-label": "Qty" });
  const far = el("select", { "aria-label": "Qty" });
  const filler = el("div", { class: "big" }, ...Array.from({ length: 2_100 }, () => el("span", {}, "x")));
  const lone = el("a", { href: "/lone" }, "Lone");
  const html = install(t, el("div", { class: "group" }, el("div", { class: "a" }, near), filler, el("div", { class: "b" }, far)), el("div", {}, lone));
  assert.equal(soleAncestors(asElement(near)).twin, far, "the walk from the first select reaches the second before the filler");
  assert.deepEqual(soleAncestors(asElement(far)), { ancestors: [far.parentElement], twin: undefined }, "the filler spends the budget");
  assert.equal(soleAncestors(asElement(lone)).ancestors.length, 1, "a lone link beside the group runs out of budget above its own wrapper");
  assertSameInsideScope(html);
});

for (const scanned of [2_000, 2_001]) {
  test(`budget boundary: a climb that has scanned ${scanned} nodes ${scanned > 2_000 ? "stops" : "goes on"}, inside a scope as outside`, (t) => {
    const link = el("a", { href: "/edge" }, "Edge");
    // The filler and its spans are `scanned` nodes at the second level; the third level has nothing new, the fourth one node.
    const filler = el("div", { class: "filler" }, ...Array.from({ length: scanned - 1 }, () => el("span", {})));
    const html = install(t, el("div", { class: "r" }, el("div", { class: "q" }, el("div", { class: "p" }, el("div", { class: "cell" }, link), filler)), el("i", {})));
    assert.equal(soleAncestors(asElement(link)).ancestors.length, scanned > 2_000 ? 1 : 3, "cell, then p and q only within the budget");
    assertSameInsideScope(html);
  });
}

test("depth bound: a twin and the top more than twelve levels up are out of reach, inside a scope as outside", (t) => {
  const deep = el("button", {}, "Deep");
  const deepUnique = el("a", { href: "/deep" }, "Deeper");
  let wrapped = el("div", {}, deep, deepUnique);
  for (let level = 0; level < 15; level += 1) wrapped = el("div", { class: `level-${level}` }, wrapped, el("span", {}, "words"));
  const html = install(t, wrapped, el("button", {}, "Deep"));
  assert.equal(soleAncestors(asElement(deep)).ancestors.length, 12);
  assert.equal(soleAncestors(asElement(deep)).twin, undefined);
  assert.equal(soleAncestors(asElement(deepUnique)).ancestors.length, 12);
  assertSameInsideScope(html);
});

test("controls in a shadow root are weighed against their own root, inside a scope as outside", (t) => {
  const host = el("div", { class: "host" });
  const shadow = host.attachShadow();
  const shadowSelects = [0, 1].map(() => el("select", { "aria-label": "Qty" }));
  shadow.append(el("div", { class: "lines" },
    ...shadowSelects.map((select, index) => el("div", { class: "line" }, el("a", { href: `/s/${index}` }, `Shadow ${index}`), select)),
    el("div", {}, el("a", { href: "/only" }, "Only in shadow"))
  ));
  const lightSelect = el("select", { "aria-label": "Qty" });
  const html = install(t, host, el("div", { class: "line" }, el("a", { href: "/light" }, "Light"), lightSelect));
  assert.equal(soleAncestors(asElement(shadowSelects[0] as StubElement)).twin, shadowSelects[1]);
  assert.equal(soleAncestors(asElement(lightSelect)).twin, undefined, "the shadow root's selects are not the light tree's twins");
  assertSameInsideScope(html);
});
