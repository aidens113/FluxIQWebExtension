// The walks across shadow boundaries, on a small hand-built tree: a document
// holding an open widget with a nested open widget inside it, and a closed
// widget whose root nothing outside it can reach.
//
// The content harness proves the same walks against a real page
// (`e2e/content/tests/shadow-roots/tests/shadow-root-controls.spec.ts`); this
// file pins the rules themselves -- a host precedes its content, a closed root
// is described as its host and never throws -- where a failure names the rule.

import assert from "node:assert/strict";
import test from "node:test";
import {
  composedClosest,
  composedContains,
  composedDescendants,
  composedDocumentOrder,
  composedParent,
  composedRoots,
  openRootsWithin,
  queryComposed,
  shadowHostsOf
} from "..";

type FakeParent = FakeElement | FakeRoot | FakeDocument;

class FakeContainer {
  readonly children: FakeElement[] = [];
  querySelectorAll(selector: string): FakeElement[] {
    const found: FakeElement[] = [];
    const walk = (element: FakeElement) => {
      if (selector === "*" || element.matches(selector)) found.push(element);
      element.children.forEach(walk);
    };
    this.children.forEach(walk);
    return found;
  }
}

class FakeDocument extends FakeContainer {
  readonly nodeType = 9;
  readonly parentNode = null;
}

class FakeRoot extends FakeContainer {
  readonly nodeType = 11;
  readonly parentNode = null;
  constructor(readonly host: FakeElement) { super(); }
}

class FakeElement extends FakeContainer {
  readonly nodeType = 1;
  shadowRoot: FakeRoot | null = null;
  constructor(readonly tag: string, readonly parentNode: FakeParent) {
    super();
    parentNode.children.push(this);
  }
  get parentElement(): FakeElement | null {
    return this.parentNode instanceof FakeElement ? this.parentNode : null;
  }
  matches(selector: string): boolean {
    return selector.split(",").map((part) => part.trim()).includes(this.tag);
  }
  getRootNode(): FakeParent {
    let node: FakeParent = this;
    while (node.parentNode) node = node.parentNode;
    return node;
  }
  /** Only ever asked of two elements in one tree, which is the contract `composedDocumentOrder` keeps. */
  compareDocumentPosition(other: FakeElement): number {
    const order = (this.getRootNode() as FakeContainer).querySelectorAll("*");
    return order.indexOf(other) > order.indexOf(this) ? 4 : 2;
  }
  attachShadow(mode: "open" | "closed"): FakeRoot {
    const root = new FakeRoot(this);
    if (mode === "open") this.shadowRoot = root;
    return root;
  }
}

function page() {
  const document = new FakeDocument();
  const header = new FakeElement("header", document);
  const widget = new FakeElement("rf-consent", document);
  const widgetRoot = widget.attachShadow("open");
  const bar = new FakeElement("section", widgetRoot);
  const accept = new FakeElement("button", bar);
  const inner = new FakeElement("rf-inner", bar);
  const innerRoot = inner.attachShadow("open");
  const deep = new FakeElement("button", innerRoot);
  const closed = new FakeElement("rf-closed", document);
  const closedRoot = closed.attachShadow("closed");
  const hidden = new FakeElement("button", closedRoot);
  const footer = new FakeElement("footer", document);
  return { document, header, widget, widgetRoot, bar, accept, inner, innerRoot, deep, closed, hidden, footer };
}

// The fakes stand in for DOM types they only partly implement.
const dom = <T>(value: unknown) => value as T;

test("the roots are the document and every open root beneath it, nested ones included; a closed root is not among them", () => {
  const p = page();
  const roots = composedRoots(dom<Document>(p.document));
  assert.deepEqual(roots, [p.document, p.widgetRoot, p.innerRoot]);
  assert.deepEqual(queryComposed(roots, "button"), [p.accept, p.deep], "the closed widget's button is not reachable");
});

test("a parent crosses from a shadow root's top to its host, and stops at the document", () => {
  const p = page();
  assert.equal(composedParent(dom<Element>(p.bar)), p.widget);
  assert.equal(composedParent(dom<Element>(p.accept)), p.bar);
  assert.equal(composedParent(dom<Element>(p.header)), null);
});

test("closest and contains continue past every shadow boundary", () => {
  const p = page();
  assert.equal(composedClosest(dom<Element>(p.deep), "rf-consent"), p.widget);
  assert.equal(composedClosest(dom<Element>(p.deep), "footer"), null);
  assert.equal(composedContains(dom<Element>(p.widget), dom<Node>(p.deep)), true);
  assert.equal(composedContains(dom<Element>(p.inner), dom<Node>(p.accept)), false);
});

test("the hosts around an element are listed innermost first, and an element of the document has none", () => {
  const p = page();
  assert.deepEqual(shadowHostsOf(dom<Element>(p.deep)), [p.inner, p.widget]);
  assert.deepEqual(shadowHostsOf(dom<Element>(p.footer)), []);
});

test("page order puts a widget's content where its host is: after what precedes the host, before what follows it", () => {
  const p = page();
  const ordered = [p.footer, p.deep, p.widget, p.accept, p.header].map(dom<Element>).sort(composedDocumentOrder);
  assert.deepEqual(ordered, [p.header, p.widget, p.accept, p.deep, p.footer]);
});

test("descendants read a host's own open root first, and a closed root yields nothing and does not throw", () => {
  const p = page();
  assert.deepEqual([...composedDescendants(dom<Element>(p.widget))], [p.bar, p.accept, p.inner, p.deep]);
  assert.deepEqual([...composedDescendants(dom<Element>(p.closed))], []);
  assert.deepEqual(openRootsWithin(dom<Element>(p.widget)), [p.widgetRoot, p.innerRoot]);
  assert.deepEqual(openRootsWithin(dom<Element>(p.closed)), []);
});
