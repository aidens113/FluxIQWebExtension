// Which repeated controls the snapshot folds behind one example, measured on
// the store chooser that made a build pick the wrong store twice.
//
// Live run `run-munpjclw-52592f43` (bigbox-retail, "Switch my pickup store to
// Millbrook Crossing Supercenter"). The header's `<vr-fulfillment-picker>`
// opens a flyout inside its open shadow root: a `<ul>` of four store cards,
// each `<li>` a name, an address, the hours and either "Your store" or the
// same `<button>Set as my store</button>`. Nothing on a button says which store
// it sets; only its card does.
//
// Four `<li>`s under one parent are a run (`repeat-exemplars.ts`), so the three
// buttons were one kind: the first card's button was the exemplar and the other
// two were followers, ranked after every distinct element on the page and so
// past the forty the packet describes. The model was shown one "Set as my
// store", pressed it, and set the first store in the list -- twice, because
// after the first switch another store was first.
//
// The DOM is a stub because the extension's unit runner is Node. It answers
// what `repeat-exemplars.ts` and `identity/record.ts` ask: tags, attributes,
// the parent chain, children and siblings, text, and `matches` for the
// selector shapes those two modules pass. The flyout's top element has no
// `parentElement`, as the first element inside a shadow root has none, so the
// record lookup is shown finding the card without leaving the root. What only
// a real page proves is the content harness's (`e2e/content/tests/`).

import assert from "node:assert/strict";
import test from "node:test";
import { recordIdentity } from "../identity";
import { repeatExemplars } from "../repeat-exemplars";

const TEXT_NODE = 3;
const ELEMENT_NODE = 1;

class StubText {
  readonly nodeType = TEXT_NODE;
  readonly childNodes: never[] = [];
  parentElement: StubElement | null = null;
  constructor(readonly nodeValue: string) {}
  get textContent(): string {
    return this.nodeValue;
  }
}

class StubElement {
  readonly nodeType = ELEMENT_NODE;
  readonly childNodes: Array<StubElement | StubText>;
  parentElement: StubElement | null = null;

  constructor(readonly localName: string, private readonly attributes: Record<string, string>, children: Array<StubElement | string>) {
    this.childNodes = children.map((child) => typeof child === "string" ? new StubText(child) : child);
    for (const child of this.childNodes) child.parentElement = this;
  }

  get tagName(): string {
    return this.localName.toUpperCase();
  }

  get children(): StubElement[] {
    return this.childNodes.filter((node): node is StubElement => node instanceof StubElement);
  }

  get previousElementSibling(): StubElement | null {
    const siblings = this.parentElement?.children ?? [];
    return siblings[siblings.indexOf(this) - 1] ?? null;
  }

  get textContent(): string {
    return this.childNodes.map((node) => node.textContent).join("");
  }

  getAttribute(name: string): string | null {
    return this.attributes[name] ?? null;
  }

  hasAttribute(name: string): boolean {
    return name in this.attributes;
  }

  getAttributeNames(): string[] {
    return Object.keys(this.attributes);
  }

  /** A comma list of tag names and `[attr]` / `[attr="value"]` tests: every shape the two modules pass. */
  matches(selector: string): boolean {
    return selector.split(",").some((part) => this.matchesOne(part.trim()));
  }

  private matchesOne(part: string): boolean {
    if (!part.startsWith("[")) return part === this.localName;
    const [name, quoted] = part.slice(1, -1).split("=");
    if (!name || !(name in this.attributes)) return false;
    return quoted === undefined || this.attributes[name] === quoted.replace(/"/gu, "");
  }
}

function el(tag: string, attributes: Record<string, string> = {}, ...children: Array<StubElement | string>): StubElement {
  return new StubElement(tag, attributes, children);
}

/** The picker's four stores, as `bigbox-retail/catalog/stores.ts` lists them. */
const STORES = [
  { name: "Carden Falls Supercenter", address: "1400 Orchard Pkwy, Carden Falls · 2.1 mi", hours: "Open until 11pm" },
  { name: "Carden Falls Neighborhood Market", address: "212 W Mill St, Carden Falls · 3.4 mi", hours: "Open until 10pm" },
  { name: "Millbrook Crossing Supercenter", address: "88 Ferris Rd, Millbrook · 9.8 mi", hours: "Open 24 hours" },
  { name: "Millbrook Crossing Neighborhood Market", address: "17 Canal St, Millbrook · 10.6 mi", hours: "Open until 10pm" }
];

type Flyout = { buttons: Array<{ store: string; button: Element }>; cards: Element[]; included: Element[] };

/**
 * The open flyout, shaped as `bigbox-retail/shell/store-picker.ts` renders it,
 * with the shopper's store first. `included` lists the controls first, then
 * the list items, then the rest -- the order the snapshot gathered elements in
 * before it listed them in document order (t200); the folding rule must not
 * depend on which.
 */
function storeFlyout(current: string): Flyout {
  const buttons: Flyout["buttons"] = [];
  const cards = STORES.map((store) => {
    const action = store.name === current ? el("span", { class: "pc" }, "Your store") : el("button", { type: "button", class: "ps" }, "Set as my store");
    if (action.localName === "button") buttons.push({ store: store.name, button: action as unknown as Element });
    return el("li", { class: "pk" }, el("strong", {}, store.name), el("div", {}, store.address), el("div", {}, store.hours), action);
  });
  const list = el("ul", { class: "pl" }, ...cards);
  // The flyout is the shadow root's child: like any element at the top of a
  // shadow tree, it has no parent element.
  el("div", { class: "pf" }, el("div", { class: "pt" }, el("div", {}, "Pickup"), el("div", {}, "Delivery")), el("p", {}, "Stores near Carden Falls"), list);
  const included = [...buttons.map(({ button }) => button), ...cards as unknown as Element[], ...cards.map((card) => card.children[0] as unknown as Element)];
  return { buttons, cards: cards as unknown as Element[], included };
}

/** A results grid of `count` product cards, each with the same "Add to cart": a template, not a choice list. */
function productGrid(count: number): Element[] {
  const buttons = Array.from({ length: count }, () => el("button", { type: "button" }, "Add to cart"));
  el("ul", {}, ...buttons.map((button, index) => el("li", {}, el("strong", {}, `Product ${index + 1}`), button)));
  return buttons as unknown as Element[];
}

/**
 * `repeat-exemplars.ts` and `sensitive-text.ts` narrow with `instanceof
 * HTMLElement` and `instanceof HTMLInputElement`, which are ReferenceErrors
 * under Node. No stub element is either, so only the lookups have to exist.
 * Installed for one test and put back, because every test bundle runs in one
 * process.
 */
function withDomGlobals(body: () => void): void {
  const globals = globalThis as unknown as Record<string, unknown>;
  const names = ["HTMLElement", "HTMLInputElement"];
  const previous = new Map(names.map((name) => [name, Object.getOwnPropertyDescriptor(globals, name)] as const));
  for (const name of names) globals[name] = class {};
  try {
    body();
  } finally {
    for (const [name, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globals, name, descriptor);
      else delete globals[name];
    }
  }
}

test("the store flyout's every 'Set as my store' is listed, each in its own card's words, and a template-sized run still folds", () => {
  withDomGlobals(() => {
    for (const current of ["Carden Falls Supercenter", "Carden Falls Neighborhood Market"]) {
      const flyout = storeFlyout(current);
      const { counts, followers } = repeatExemplars(flyout.included, new Set());
      assert.equal(flyout.buttons.length, 3);
      for (const { store, button } of flyout.buttons) {
        // A short list of choices is not a template: no button is ranked
        // behind the page, and none stands for the others.
        assert.equal(followers.has(button), false, `the button for ${store} is ranked behind every distinct element (store chosen: ${current})`);
        assert.equal(counts.get(button), undefined, `the button for ${store} is made one example of a run (store chosen: ${current})`);
        // And each says which store it sets, through the card it sits in,
        // found inside the shadow root the card lives in.
        const words = recordIdentity(button)?.text;
        assert.ok(words?.startsWith(store), `the button for ${store} is recorded as in "${words}"`);
      }
      // The cards themselves are still a run: only a short run of controls is listed whole.
      assert.equal(counts.get(flyout.cards[0]!), 4);
    }

    // Past a short list, the page is a template and is folded as before.
    const grid = productGrid(6);
    const folded = repeatExemplars(grid, new Set());
    assert.equal(folded.counts.get(grid[0]!), 6);
    assert.deepEqual(grid.slice(1).map((button) => folded.followers.has(button)), [true, true, true, true, true]);
  });
});
