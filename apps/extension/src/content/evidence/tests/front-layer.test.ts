// Which elements sit on a layer the page paints over itself
// (`../front-layer.ts`): the element, one of its seven nearest ancestors, or an
// open shadow host above it is `position: fixed` or `sticky`.
//
// The runner is Node, so the tree is a fake with only the members the rule
// reads -- a parent, an owner document, a root node -- and `getComputedStyle`
// answers from each fake's own position. What only a real page proves, that
// Chromium computes the positions these fakes state, is the content harness's.

import assert from "node:assert/strict";
import test from "node:test";
import { frontLayerTest } from "../front-layer";

const DOCUMENT_FRAGMENT_NODE = 11;

class FakeDocument {
  body: FakeElement | null = null;
  documentElement: FakeElement | null = null;
}

class FakeShadowRoot {
  readonly nodeType = DOCUMENT_FRAGMENT_NODE;
  constructor(readonly host: FakeElement) {}
}

class FakeElement {
  parentElement: FakeElement | null = null;
  /** The shadow root this element's tree hangs from, when it is inside one. */
  shadowRootAbove: FakeShadowRoot | null = null;
  constructor(readonly name: string, readonly position = "static", readonly ownerDocument: FakeDocument) {}
  getRootNode(): unknown {
    let top: FakeElement = this;
    while (top.parentElement) top = top.parentElement;
    return top.shadowRootAbove ?? top.ownerDocument;
  }
}

/** A page of `html > body`, and a way to hang elements under any parent. */
function page() {
  const document = new FakeDocument();
  const html = new FakeElement("html", "static", document);
  const body = new FakeElement("body", "static", document);
  body.parentElement = html;
  document.documentElement = html;
  document.body = body;
  const add = (parent: FakeElement | null, name: string, position = "static"): FakeElement => {
    const child = new FakeElement(name, position, document);
    child.parentElement = parent;
    return child;
  };
  return { document, html, body, add };
}

/** Runs `body` with `getComputedStyle` answering from the fakes, counting the calls, and puts the global back. */
function withPositions<T>(body: (calls: () => number) => T): T {
  const globals = globalThis as unknown as Record<string, unknown>;
  const previous = Object.getOwnPropertyDescriptor(globals, "getComputedStyle");
  let calls = 0;
  globals.getComputedStyle = (element: FakeElement) => {
    calls += 1;
    return { position: element.position };
  };
  try {
    return body(() => calls);
  } finally {
    if (previous) Object.defineProperty(globals, "getComputedStyle", previous);
    else delete globals.getComputedStyle;
  }
}

const asElement = (fake: FakeElement): Element => fake as unknown as Element;

test("a control inside a fixed banner, and the banner itself, are on the front layer; the page's own content is not", () => {
  const { body, add } = page();
  const main = add(body, "main");
  const paragraph = add(main, "p");
  const banner = add(body, "div.consent", "fixed");
  const actions = add(banner, "div.actions");
  const accept = add(actions, "button");
  withPositions(() => {
    const inFrontLayer = frontLayerTest();
    assert.equal(inFrontLayer(asElement(accept)), true, "Accept, two levels inside the fixed banner");
    assert.equal(inFrontLayer(asElement(banner)), true, "the banner itself");
    assert.equal(inFrontLayer(asElement(paragraph)), false, "the page behind it");
    assert.equal(inFrontLayer(asElement(main)), false);
  });
});

test("sticky counts as a front layer, and relative or absolute does not", () => {
  const { body, add } = page();
  const bar = add(body, "div.buy-box", "sticky");
  const buy = add(bar, "button");
  const card = add(body, "div.card", "relative");
  const badge = add(card, "span.badge", "absolute");
  withPositions(() => {
    const inFrontLayer = frontLayerTest();
    assert.equal(inFrontLayer(asElement(buy)), true);
    assert.equal(inFrontLayer(asElement(badge)), false);
  });
});

test("a control inside an open shadow root is asked through its host: the fixed layer is the custom element", () => {
  const { body, add } = page();
  const host = add(body, "rf-consent", "fixed");
  const section = add(null, "section");
  section.shadowRootAbove = new FakeShadowRoot(host);
  const accept = add(section, "button");
  const plainHost = add(body, "rf-card");
  const inner = add(null, "div");
  inner.shadowRootAbove = new FakeShadowRoot(plainHost);
  const link = add(inner, "a");
  withPositions(() => {
    const inFrontLayer = frontLayerTest();
    assert.equal(inFrontLayer(asElement(accept)), true, "the button's own ancestors are static; its host is fixed");
    assert.equal(inFrontLayer(asElement(link)), false, "a static host is no layer");
  });
});

test("the walk stops at body and html, and asks the element and its seven nearest ancestors, no more", () => {
  const { html, body, add } = page();
  // A page that fixes its whole shell: a scroll container, not a banner.
  const shell = add(body, "div.shell", "fixed");
  let deepest = shell;
  for (let level = 0; level < 8; level += 1) deepest = add(deepest, `div.level-${level}`);
  const near = add(shell, "div.near");
  withPositions(() => {
    const inFrontLayer = frontLayerTest();
    assert.equal(inFrontLayer(asElement(near)), true, "one level under the fixed shell");
    assert.equal(inFrontLayer(asElement(deepest)), false, "eight levels under it: the shell is its eighth ancestor");
    assert.equal(inFrontLayer(asElement(body)), false);
    assert.equal(inFrontLayer(asElement(html)), false);
  });
});

test("one capture reads each element's position once, however many descendants ask", () => {
  const { body, add } = page();
  const list = add(body, "ul");
  const rows = Array.from({ length: 50 }, (_, index) => add(add(list, `li.${index}`), "span"));
  withPositions((calls) => {
    const inFrontLayer = frontLayerTest();
    for (const row of rows) assert.equal(inFrontLayer(asElement(row)), false);
    // Each span, each li, and the shared ul once: 101 elements, 101 reads.
    assert.equal(calls(), 101);
  });
});
