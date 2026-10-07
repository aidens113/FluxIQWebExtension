// Where an element stands among its same-type siblings (`../sibling-position.ts`),
// which an xpath step and a CSS `:nth-of-type` both write.
//
// The table a capture builds must answer exactly what the walk it replaced
// answered: a snapshot's selectors and xpaths are addresses that recordings
// store and replays act on, so a changed number is a changed address (t289).
// Each row below therefore checks every child of a parent three ways -- the
// algorithm each path used before the table, the walk outside a scope, and the
// table inside one -- on a wide flat list, a nested tree, the top of a shadow
// tree and siblings in a foreign namespace. The last rows pin why the table
// exists: a parent's children are read once per capture, and never across two.
//
// The runner is Node, so the elements are stand-ins holding only what the
// module and the two old algorithms read.

import assert from "node:assert/strict";
import test from "node:test";
import { siblingPosition, type SiblingGrouping } from "../sibling-position";
import { withSelectorMemo } from "../selector-memo";

const HTML = "http://www.w3.org/1999/xhtml";
const SVG = "http://www.w3.org/2000/svg";

/** A parent: an element, or a shadow root, which has children but is no element's `parentElement`. */
class FakeParent {
  readonly kids: FakeElement[] = [];
  childReads = 0;
  get children(): FakeElement[] {
    this.childReads += 1;
    return this.kids;
  }
  append(...elements: FakeElement[]): this {
    for (const element of elements) {
      element.parentNode = this;
      element.parentElement = this instanceof FakeElement ? this : null;
      this.kids.push(element);
    }
    return this;
  }
}

class FakeElement extends FakeParent {
  parentNode: FakeParent | null = null;
  parentElement: FakeElement | null = null;
  readonly tagName: string;
  constructor(readonly localName: string, readonly namespaceURI: string | null = HTML) {
    super();
    this.tagName = namespaceURI === HTML ? localName.toUpperCase() : localName;
  }
  get previousElementSibling(): FakeElement | null {
    const siblings = this.parentNode?.kids ?? [];
    return siblings[siblings.indexOf(this) - 1] ?? null;
  }
  get nextElementSibling(): FakeElement | null {
    const siblings = this.parentNode?.kids ?? [];
    const at = siblings.indexOf(this);
    return at < 0 ? null : siblings[at + 1] ?? null;
  }
}

const asElement = (element: FakeElement): Element => element as unknown as Element;
const asParent = (parent: FakeParent | null): ParentNode | null => parent as unknown as ParentNode | null;

/** `xpathFor`'s index before t289: the element's place in its parent element's same-`tagName` children. */
function oldXpathIndex(element: FakeElement): number {
  const siblings = element.parentElement ? [...element.parentElement.kids].filter((sibling) => sibling.tagName === element.tagName) : [];
  return Math.max(1, siblings.indexOf(element) + 1);
}

/** `unique-selector.ts`'s `position` before t289, as the `:nth-of-type` suffix it wrote. */
function oldNthOfType(element: FakeElement): string {
  const sameType = (left: FakeElement, right: FakeElement) => left.localName === right.localName && left.namespaceURI === right.namespaceURI;
  let index = 1;
  for (let sibling = element.previousElementSibling; sibling; sibling = sibling.previousElementSibling) {
    if (sameType(sibling, element)) index += 1;
  }
  let shared = index > 1;
  for (let sibling = element.nextElementSibling; sibling && !shared; sibling = sibling.nextElementSibling) {
    if (sameType(sibling, element)) shared = true;
  }
  return shared ? `:nth-of-type(${index})` : "";
}

function nthOfType(element: FakeElement): string {
  const { index, shared } = siblingPosition(asElement(element), asParent(element.parentNode), "local-name");
  return shared ? `:nth-of-type(${index})` : "";
}

function xpathIndex(element: FakeElement): number {
  return siblingPosition(asElement(element), asParent(element.parentElement), "tag-name").index;
}

/** Every element under `parent`, depth first. */
function everyElement(parent: FakeParent): FakeElement[] {
  return parent.kids.flatMap((child) => [child, ...everyElement(child)]);
}

/** Checks every element under `root` against both old algorithms, outside a scope and inside one. */
function assertMatchesOldAnswers(root: FakeParent): void {
  const elements = everyElement(root);
  const expected = elements.map((element) => [oldXpathIndex(element), oldNthOfType(element)] as const);
  const walked = elements.map((element) => [xpathIndex(element), nthOfType(element)] as const);
  const tabled = withSelectorMemo(() => elements.map((element) => [xpathIndex(element), nthOfType(element)] as const));
  assert.deepEqual(walked, expected, "the walk outside a capture");
  assert.deepEqual(tabled, expected, "the table inside a capture");
}

const TAGS = ["a", "span", "a", "div", "a", "span", "p"];

test("a wide flat list: every child's xpath index and nth-of-type are what they were", () => {
  const nav = new FakeElement("nav");
  for (let index = 0; index < 3_000; index += 1) nav.append(new FakeElement(TAGS[index % TAGS.length]!));
  // One child alone of its type: no `:nth-of-type`, xpath index 1.
  nav.append(new FakeElement("button"));
  new FakeElement("body").append(new FakeElement("header"), nav);
  assertMatchesOldAnswers(nav.parentElement!);
});

test("a nested tree: rows of mixed cells under a list, each counted among its own siblings only", () => {
  const list = new FakeElement("ul");
  for (let row = 0; row < 40; row += 1) {
    const item = new FakeElement("li");
    for (let cell = 0; cell < 6; cell += 1) item.append(new FakeElement(cell % 2 ? "span" : "button"));
    item.append(new FakeElement("em"));
    list.append(item);
  }
  const body = new FakeElement("body").append(new FakeElement("ul"), list, new FakeElement("ul"));
  assertMatchesOldAnswers(new FakeElement("html").append(body));
});

test("the top of a shadow tree: nth-of-type counts the shadow root's children, the xpath index has no parent element and is 1", () => {
  const shadowRoot = new FakeParent();
  for (let index = 0; index < 300; index += 1) shadowRoot.append(new FakeElement(index % 2 ? "button" : "span"));
  shadowRoot.append(new FakeElement("div").append(new FakeElement("p"), new FakeElement("p"), new FakeElement("span")));
  assertMatchesOldAnswers(shadowRoot);
  const first = shadowRoot.kids[1]!;
  assert.equal(nthOfType(first), ":nth-of-type(1)");
  assert.equal(xpathIndex(first), 1);
});

test("siblings in another namespace: an svg `a` is not an HTML `a`'s type, and a case-preserved tag name keeps the xpath groups apart", () => {
  const parent = new FakeElement("div").append(
    new FakeElement("a"), new FakeElement("a", SVG), new FakeElement("a"), new FakeElement("foreignObject", SVG),
    new FakeElement("A", SVG), new FakeElement("a", SVG), new FakeElement("foreignObject", SVG)
  );
  assertMatchesOldAnswers(new FakeElement("body").append(parent));
});

test("an element with no parent is first and alone", () => {
  const lone = new FakeElement("div");
  for (const grouping of ["tag-name", "local-name"] satisfies SiblingGrouping[]) {
    assert.deepEqual(siblingPosition(asElement(lone), null, grouping), { index: 1, shared: false });
    assert.deepEqual(withSelectorMemo(() => siblingPosition(asElement(lone), null, grouping)), { index: 1, shared: false });
  }
});

test("inside a capture a parent's children are read once per grouping, however many of them ask", () => {
  const nav = new FakeElement("nav");
  for (let index = 0; index < 2_000; index += 1) nav.append(new FakeElement("a"));
  withSelectorMemo(() => {
    for (const link of nav.kids) {
      xpathIndex(link);
      nthOfType(link);
    }
  });
  assert.equal(nav.childReads, 2, "one pass for the xpath grouping and one for nth-of-type");
});

test("nothing is kept past the capture: the next one sees the page as it then is", () => {
  const parent = new FakeElement("div").append(new FakeElement("p"), new FakeElement("p"));
  const second = parent.kids[1]!;
  assert.equal(withSelectorMemo(() => nthOfType(second)), ":nth-of-type(2)");
  // The page changes between two captures: the first paragraph goes away.
  parent.kids.splice(0, 1);
  assert.equal(withSelectorMemo(() => nthOfType(second)), "");
  assert.equal(nthOfType(second), "");
});
