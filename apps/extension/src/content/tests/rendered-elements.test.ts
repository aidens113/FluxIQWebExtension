// The snapshot's element list is every rendered element of the page, in
// composed document order, with no cap, no ranking and no filter beyond "is it
// rendered" (t200). This pins the rule on a hand-built tree: what is pruned
// with its subtree, what is walked through without being listed, and that
// what a person may not be able to use -- `aria-hidden`, transparent, tiny,
// nameless -- is listed all the same.
//
// The runner is Node, so the tree is a fake with only the members
// `rendered-elements.ts` reads, and `getComputedStyle` answers from each fake
// element's own style. What only a real page proves -- that Chromium computes
// the styles and boxes these fakes state -- is the content harness's.

import assert from "node:assert/strict";
import test from "node:test";
import { renderedElements } from "../rendered-elements";

type Style = { display?: string; visibility?: string; opacity?: string };

class FakeRoot {
  readonly children: FakeElement[] = [];
}

class FakeElement {
  readonly children: FakeElement[] = [];
  shadowRoot: FakeRoot | null = null;
  /** `undefined` where no open root's slot could be asked; `null` where one could, and none places it. */
  assignedSlot: FakeElement | null | undefined = undefined;
  hasBox = true;
  constructor(readonly tagName: string, readonly style: Style = {}, private readonly attributes: Record<string, string> = {}) {}
  hasAttribute(name: string): boolean {
    return name in this.attributes;
  }
  getAttribute(name: string): string | null {
    return this.attributes[name] ?? null;
  }
  checkVisibility(): boolean {
    return this.hasBox;
  }
  add(...children: FakeElement[]): this {
    this.children.push(...children);
    return this;
  }
}

function el(tag: string, style: Style = {}, attributes: Record<string, string> = {}): FakeElement {
  return new FakeElement(tag.toUpperCase(), style, attributes);
}

/** A document of `html > head, body`, with `content` in the body. */
function page(...content: FakeElement[]): { document: Document; body: FakeElement; html: FakeElement } {
  const head = el("head", { display: "none" }).add(el("title"), el("style"));
  const body = el("body").add(...content);
  const html = el("html").add(head, body);
  return { document: { documentElement: html, body } as unknown as Document, body, html };
}

/** Runs `body` with `getComputedStyle` answering from the fakes, and puts the global back. */
function withStyles<T>(body: () => T): T {
  const globals = globalThis as unknown as Record<string, unknown>;
  const previous = Object.getOwnPropertyDescriptor(globals, "getComputedStyle");
  globals.getComputedStyle = (element: FakeElement) => ({ display: "block", visibility: "visible", opacity: "1", ...element.style });
  try {
    return body();
  } finally {
    if (previous) Object.defineProperty(globals, "getComputedStyle", previous);
    else delete globals.getComputedStyle;
  }
}

function listed(document: Document): string[] {
  return withStyles(() => renderedElements(document).elements.map((element) => (element as unknown as FakeElement & { id?: string }).tagName.toLowerCase() + tagSuffix(element)));
}

function tagSuffix(element: Element): string {
  const fake = element as unknown as FakeElement;
  return fake.hasAttribute("id") ? `#${(fake as unknown as { attributes: Record<string, string> }).attributes["id"]}` : "";
}

test("elements are listed in composed document order: a host, its open root's content, then the light children its slots place", () => {
  const slot = el("slot", { display: "contents" });
  const host = el("consent-wall", {}, { id: "wall" });
  host.shadowRoot = new FakeRoot();
  host.shadowRoot.children.push(el("section").add(el("button", {}, { id: "accept" })), slot);
  const placed = el("p", {}, { id: "placed" });
  placed.assignedSlot = slot;
  const unplaced = el("span", {}, { id: "unplaced" });
  unplaced.assignedSlot = null;
  host.add(placed, unplaced);
  const { document } = page(el("header").add(el("a", {}, { id: "home" })), host, el("footer"));

  assert.deepEqual(listed(document), ["header", "a#home", "consent-wall#wall", "section", "button#accept", "slot", "p#placed", "footer"]);
});

test("what draws nothing is pruned with everything inside it", () => {
  const inside = () => el("button", {}, { id: "inside" });
  const { document } = page(
    el("script").add(inside()),
    el("style"),
    el("noscript").add(inside()),
    el("template"),
    el("div", {}, { hidden: "" }).add(inside()),
    el("div", { display: "none" }).add(inside()),
    el("div", {}, { "data-fluxiq-picker": "" }).add(inside()),
    el("div", {}, { "data-fluxiq-activity": "" }).add(inside()),
    el("main", {}, { id: "kept" })
  );
  assert.deepEqual(listed(document), ["main#kept"]);
});

test("what a person may not be able to use is listed all the same: aria-hidden, transparent, tiny, nameless", () => {
  const { document } = page(
    el("div", {}, { "aria-hidden": "true", id: "behind-modal" }).add(el("a", {}, { id: "still-painted" })),
    el("input", { opacity: "0" }, { id: "custom-checkbox" }),
    el("input", {}, { id: "one-pixel", style: "width:1px;height:1px" }),
    el("div", {}, { id: "backdrop" })
  );
  assert.deepEqual(listed(document), ["div#behind-modal", "a#still-painted", "input#custom-checkbox", "input#one-pixel", "div#backdrop"]);
});

test("a hidden-visibility element is walked through, not listed, and a child that shows itself again is listed", () => {
  const { document } = page(
    el("div", { visibility: "hidden" }, { id: "hidden-panel" }).add(el("span", { visibility: "hidden" }), el("button", { visibility: "visible" }, { id: "shown" })),
    el("div", { visibility: "collapse" }, { id: "collapsed" })
  );
  assert.deepEqual(listed(document), ["button#shown"]);
});

test("an element the browser gives no box is not listed, except one drawn through its children or pressed without one", () => {
  const closedDetails = el("div", {}, { id: "details-inside" });
  closedDetails.hasBox = false;
  const contents = el("div", { display: "contents" }, { id: "contents" });
  contents.hasBox = false;
  contents.add(el("button", {}, { id: "drawn-child" }));
  const area = el("area", {}, { id: "map-area" });
  area.hasBox = false;
  const { document } = page(closedDetails, contents, area);
  assert.deepEqual(listed(document), ["div#contents", "button#drawn-child", "area#map-area"]);
});

test("html and body are the page, not something on it", () => {
  const { document } = page(el("p", {}, { id: "only" }));
  assert.deepEqual(listed(document), ["p#only"]);
});

test("there is no cap: ten thousand rows are ten thousand listed elements, in order, and the walk counts what it visited", () => {
  const rows = Array.from({ length: 10_000 }, (_unused, index) => el("tr", {}, { id: String(index) }));
  const { document } = page(el("table").add(...rows));
  const found = withStyles(() => renderedElements(document));
  assert.equal(found.elements.length, 10_001);
  assert.equal(tagSuffix(found.elements[10_000]!), "#9999");
  // html, head, body, the table and its rows; the head's children are pruned with it.
  assert.equal(found.walked, 10_004);
});

test("a nesting deeper than a call stack is walked without one", () => {
  let innermost = el("span", {}, { id: "deepest" });
  const deepest = innermost;
  for (let depth = 0; depth < 20_000; depth += 1) innermost = el("div").add(innermost);
  const { document } = page(innermost);
  const found = withStyles(() => renderedElements(document));
  assert.equal(found.elements.length, 20_001);
  assert.equal(found.elements[20_000], deepest as unknown as Element);
});

/** The walk asked `includeHidden`, each element named as `listed` names it, with ` (hidden)` after the hidden ones. */
function listedWithHidden(document: Document): string[] {
  return withStyles(() => {
    const found = renderedElements(document, { includeHidden: true });
    return found.elements.map((element) => (element as unknown as FakeElement).tagName.toLowerCase() + tagSuffix(element) + (found.hidden?.has(element) ? " (hidden)" : ""));
  });
}

/** A page holding every kind of element a default walk skips as not rendered, and a few it never lists at all. */
function pageWithHiddenParts(): Document {
  const noBox = el("div", {}, { id: "closed-details" });
  noBox.hasBox = false;
  return page(
    el("nav").add(
      el("ul", { display: "none" }, { id: "menu" }).add(el("li").add(el("a", {}, { id: "menu-link" }))),
      el("button", {}, { id: "menu-toggle" })
    ),
    el("section", {}, { hidden: "", id: "panel" }).add(el("p", {}, { id: "panel-text" })),
    el("div", { visibility: "hidden" }, { id: "faded" }).add(el("span", { visibility: "visible" }, { id: "shows-again" })),
    noBox,
    el("input", { display: "none" }, { type: "hidden", id: "token" }),
    el("script").add(el("button", {}, { id: "in-script" })),
    el("div", { display: "none" }, { "data-fluxiq-picker": "" }).add(el("button", {}, { id: "in-overlay" })),
    el("main", {}, { id: "kept" })
  ).document;
}

test("includeHidden lists a display:none subtree and a [hidden] one, every element flagged, in composed order", () => {
  assert.deepEqual(listedWithHidden(pageWithHiddenParts()), [
    "nav",
    "ul#menu (hidden)",
    "li (hidden)",
    "a#menu-link (hidden)",
    "button#menu-toggle",
    "section#panel (hidden)",
    "p#panel-text (hidden)",
    "div#faded (hidden)",
    "span#shows-again",
    "div#closed-details (hidden)",
    "main#kept"
  ]);
});

test("includeHidden still never lists script, the extension's overlays, the head, a hidden input, html or body", () => {
  const names = listedWithHidden(pageWithHiddenParts());
  for (const never of ["button#in-script", "button#in-overlay", "input#token", "head", "title", "style", "html", "body"]) {
    assert.ok(!names.some((name) => name.startsWith(never)), `${never} is not listed`);
  }
});

test("without includeHidden the walk is the one it always was: the hidden walk less its hidden elements, the same count walked, and no hidden set", () => {
  const document = pageWithHiddenParts();
  const plain = withStyles(() => renderedElements(document));
  const asked = withStyles(() => renderedElements(document, { includeHidden: false }));
  const withHidden = withStyles(() => renderedElements(document, { includeHidden: true }));
  assert.equal(plain.hidden, undefined);
  assert.deepEqual(Object.keys(plain), ["elements", "walked"], "the default result has exactly the shape it had");
  assert.deepEqual(asked, plain);
  assert.deepEqual(plain.elements, withHidden.elements.filter((element) => !withHidden.hidden?.has(element)));
  assert.equal(withHidden.walked, plain.walked, "a search's evidence totals count what a look counts");
  assert.deepEqual(listed(document), ["nav", "button#menu-toggle", "span#shows-again", "main#kept"]);
});
