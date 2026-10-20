// What describing a page's controls costs inside one capture scope (t733).
//
// A snapshot of a page with 6,000 uniquely named links took 372 s, where it
// had taken 4: for every link, the row walk of `control-row/` climbed through
// up to 2,000 nodes, naming every link it passed, looking for a twin no link
// had, and `recordSubject` climbed again. Inside a scope one index per root
// names each element once, and a climb that can find no twin is not walked.
//
// Cost is counted, never timed: every read of an element's children (one per
// node a walk visits, and what enumerating a root costs) and every attribute
// read (what naming an element and telling its kind cost). The page is made
// up: a list of 3,000 links, each alone in its cell, each named differently.

import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { withSelectorMemo } from "../../selector";
import { el, installStubDocument, stubDocument } from "../../tests/stub-dom";
import { recordIdentity, recordSubject } from "../record";

const LINKS = 3_000;
/** What one root's index may cost, per element on the page: enumerating it, telling each kind, naming each link. */
const ROOT_ALLOWANCE_PER_ELEMENT = { children: 2, attributes: 16 };
/** What describing one link may cost once the index exists. Measured at t733: about 4 children reads and 96 attribute reads. */
const PER_LINK = { children: 8, attributes: 150 };

type Counts = { children: number; attributes: number };

/** Counts reads of `children` and calls of `getAttribute` on every stub node, until the test ends. */
function countReads(t: TestContext): Counts {
  const elementPrototype = Object.getPrototypeOf(el("div")) as object;
  const nodePrototype = Object.getPrototypeOf(elementPrototype) as object;
  const children = Object.getOwnPropertyDescriptor(nodePrototype, "children");
  const getAttribute = Object.getOwnPropertyDescriptor(elementPrototype, "getAttribute");
  const readChildren = children?.get;
  const callGetAttribute = getAttribute?.value as ((this: unknown, name: string) => string | null) | undefined;
  if (!children || !getAttribute || !readChildren || !callGetAttribute) throw new Error("the stub page no longer reads children or attributes where this test counts them");
  const counts: Counts = { children: 0, attributes: 0 };
  Object.defineProperty(nodePrototype, "children", {
    configurable: true,
    get(this: unknown) {
      counts.children += 1;
      return readChildren.call(this);
    }
  });
  Object.defineProperty(elementPrototype, "getAttribute", {
    configurable: true,
    writable: true,
    value(this: unknown, name: string) {
      counts.attributes += 1;
      return callGetAttribute.call(this, name);
    }
  });
  t.after(() => {
    Object.defineProperty(nodePrototype, "children", children);
    Object.defineProperty(elementPrototype, "getAttribute", getAttribute);
  });
  return counts;
}

test("describing 3,000 uniquely named links in one scope costs a constant per link, not a walk of the page", (t) => {
  const links = Array.from({ length: LINKS }, (_, index) => el("a", { href: `/item/${index}` }, `Item ${index}`));
  const document = stubDocument();
  document.append(el("html", {}, el("body", {}, el("div", { class: "list" }, ...links.map((link) => el("div", { class: "cell" }, link))))));
  installStubDocument(t, document);
  const pageElements = 3 + 2 * LINKS;
  const counts = countReads(t);
  withSelectorMemo(() => {
    links.forEach((link, index) => {
      const element = link as unknown as Element;
      recordIdentity(element);
      recordSubject(element);
      const described = index + 1;
      // Checked after every link, so today's walk fails within a few links instead of after minutes.
      for (const kind of ["children", "attributes"] as const) {
        const allowed = ROOT_ALLOWANCE_PER_ELEMENT[kind] * pageElements + PER_LINK[kind] * described;
        assert.ok(counts[kind] <= allowed, `${counts[kind]} ${kind} reads after ${described} links; at most ${allowed} allowed`);
      }
    });
  });
});

test("the same links described outside a scope still answer, measured against the live page", (t) => {
  // Outside a scope nothing is kept: a second description after the page changed sees the change.
  const near = el("select", { "aria-label": "Qty" });
  const line = el("div", { class: "line" }, el("a", { href: "/soap" }, "Soap"), near);
  const list = el("div", { class: "cart" }, line);
  const document = stubDocument();
  document.append(el("html", {}, el("body", {}, list)));
  installStubDocument(t, document);
  assert.equal(recordIdentity(near as unknown as Element), undefined, "one line marks out no row");
  list.append(el("div", { class: "line" }, el("a", { href: "/towels" }, "Towels"), el("select", { "aria-label": "Qty" })));
  assert.deepEqual(recordIdentity(near as unknown as Element), { text: "Soap" }, "a second line, added since, is seen");
});
