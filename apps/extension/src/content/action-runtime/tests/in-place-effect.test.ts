// T1 coverage of the in-place effect watch (`in-place-effect.ts`, with
// `composed-rendered-text.ts`) across open shadow roots: that a link click
// whose page answers it inside a web component's root is seen as answered, and
// that the rules keeping a dead link failing still hold there.
//
// The unit tests run in Node, so the page is hand-built: elements that know
// their light children, their open root, whether they are rendered and what
// text they draw, and a `MutationObserver` stand-in that -- like the real one --
// delivers a record only to an observer of a node whose own tree holds the
// target, never across a shadow boundary. That boundary is the defect: on
// bigbox (`run-mum0ke7z-940cbd27`) the "Change store" flyout opens inside
// `vr-fulfillment-picker`'s root and a watch of the document alone saw nothing.
// The first row is that page; restore a document-only observer, or the body-only
// text reading, and it goes red.
//
// Whether a real browser delivers the same records is the content harness's.

import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { watchInPlaceEffect } from "../in-place-effect";

class FakeRoot {
  readonly nodeType = 11;
  readonly childNodes: FakeElement[] = [];
  constructor(readonly host: FakeElement) {}
  get parentNode(): null {
    return null;
  }
  get children(): FakeElement[] {
    return this.childNodes;
  }
  querySelectorAll(): FakeElement[] {
    return this.childNodes.flatMap((child) => [child, ...child.querySelectorAll()]);
  }
  append(...elements: FakeElement[]): void {
    for (const element of elements) {
      element.parentNode = this;
      this.childNodes.push(element);
    }
  }
}

class FakeElement {
  readonly nodeType = 1;
  parentNode: FakeElement | FakeRoot | null = null;
  readonly childNodes: FakeElement[] = [];
  readonly attributes: Array<{ name: string; value: string }> = [];
  shadowRoot: FakeRoot | null = null;
  /** Its own box: false for `display: none` or `hidden`. */
  rendered = true;
  display = "block";
  constructor(public ownText = "") {}
  get children(): FakeElement[] {
    return this.childNodes;
  }
  /** The light tree only, as `innerText` is read here; a hidden element falls back to its text content, as the spec says. */
  get innerText(): string {
    if (!this.rendered) return this.textContent;
    return [this.ownText, ...this.childNodes.filter((child) => child.rendered).map((child) => child.innerText)].filter(Boolean).join("\n");
  }
  get textContent(): string {
    return [this.ownText, ...this.childNodes.map((child) => child.textContent)].join("");
  }
  getClientRects(): unknown[] {
    return this.rendered && this.display !== "contents" && this.parentRendered() ? [{}] : [];
  }
  querySelectorAll(): FakeElement[] {
    return this.childNodes.flatMap((child) => [child, ...child.querySelectorAll()]);
  }
  append(...elements: FakeElement[]): void {
    for (const element of elements) {
      element.parentNode = this;
      this.childNodes.push(element);
    }
  }
  attachShadow(): FakeRoot {
    this.shadowRoot = new FakeRoot(this);
    return this.shadowRoot;
  }
  private parentRendered(): boolean {
    const parent = this.parentNode;
    if (!parent) return true;
    if (parent instanceof FakeRoot) return parent.host.rendered && parent.host.parentRendered();
    return (parent.rendered || parent.display === "contents") && parent.parentRendered();
  }
}

/** Every live fake observer, so a mutation can be delivered the way a browser would. */
const observers: FakeObserver[] = [];

class FakeObserver {
  readonly targets: Array<FakeElement | FakeRoot> = [];
  queued: object[] = [];
  constructor(readonly callback: (records: object[]) => void) {
    observers.push(this);
  }
  observe(target: FakeElement | FakeRoot): void {
    this.targets.push(target);
  }
  disconnect(): void {
    this.targets.length = 0;
  }
  takeRecords(): object[] {
    const taken = this.queued;
    this.queued = [];
    return taken;
  }
}

/** Whether `ancestor`'s own tree holds `node`: parent by parent, stopping at a shadow root, as `subtree` does. */
function inTree(ancestor: FakeElement | FakeRoot, node: FakeElement | FakeRoot): boolean {
  for (let current: FakeElement | FakeRoot | null = node; current; current = current.parentNode) {
    if (current === ancestor) return true;
  }
  return false;
}

function deliver(record: { type: string; target: FakeElement | FakeRoot; addedNodes?: FakeElement[] }): void {
  const full = { addedNodes: [], removedNodes: [], ...record };
  for (const observer of observers) {
    if (observer.targets.some((target) => inTree(target, record.target))) observer.queued.push(full);
  }
}

/** Shows or hides an element by its `hidden` attribute, and records it. */
function setHidden(element: FakeElement, hidden: boolean): void {
  element.rendered = !hidden;
  deliver({ type: "attributes", target: element });
}

function add(parent: FakeElement | FakeRoot, child: FakeElement): void {
  parent.append(child);
  deliver({ type: "childList", target: parent, addedNodes: [child] });
}

/** A page: `<html><body><main>` holding a cancelling link, as the click verb's watch sees it. */
function page() {
  const html = new FakeElement();
  const body = new FakeElement();
  const main = new FakeElement("Product page");
  const link = new FakeElement("Change store");
  link.attributes.push({ name: "href", value: "/stores" });
  html.append(body);
  body.append(main);
  main.append(link);
  const document = {
    nodeType: 9,
    location: { href: "http://127.0.0.1:4000/scenarios/bigbox-retail/product/" },
    documentElement: html,
    body,
    defaultView: { getComputedStyle: (element: FakeElement) => ({ display: element.rendered ? element.display : "none" }) },
    querySelectorAll: () => [html, ...html.querySelectorAll()]
  };
  (link as unknown as { ownerDocument: unknown }).ownerDocument = document;
  return { document, main, link, watch: () => watchInPlaceEffect(link as unknown as Element) };
}

/** A component in `main` with an open root holding a hidden flyout: the store picker. */
function storePicker(main: FakeElement) {
  const host = new FakeElement();
  main.append(host);
  const root = host.attachShadow();
  const heading = new FakeElement("Pickup at Riverside");
  const flyout = new FakeElement("Choose a store: Riverside, Northgate, Harbor");
  flyout.rendered = false;
  root.append(heading, flyout);
  return { host, root, flyout };
}

let saved: unknown;
beforeEach(() => {
  observers.length = 0;
  saved = (globalThis as { MutationObserver?: unknown }).MutationObserver;
  (globalThis as { MutationObserver?: unknown }).MutationObserver = FakeObserver;
});
afterEach(() => {
  (globalThis as { MutationObserver?: unknown }).MutationObserver = saved;
});

test("a flyout un-hidden inside an open shadow root answers the click, as bigbox's Change store does", async () => {
  const { main, watch } = page();
  const { flyout } = storePicker(main);
  const watching = watch();
  setHidden(flyout, false);
  assert.equal((await watching.settle(0))?.kind, "content");
});

test("the hidden flyout's text is not in the baseline, so a press that changes nothing inside the root still fails", async () => {
  const { main, watch } = page();
  const { root } = storePicker(main);
  const watching = watch();
  // Structure moves inside the root, but nothing a reader sees does.
  const marker = new FakeElement();
  marker.rendered = false;
  add(root, marker);
  assert.equal(await watching.settle(0), undefined);
});

test("text a clock rewrites inside a shadow root, with no structure moving, does not answer the click", async () => {
  const { main, watch } = page();
  const { root } = storePicker(main);
  const clock = new FakeElement("00:00:00");
  root.append(clock);
  const watching = watch();
  clock.ownText = "00:00:01";
  deliver({ type: "characterData", target: clock });
  assert.equal(await watching.settle(0), undefined);
});

test("a component added since the press, carrying an open root whose panel draws text, answers the click", async () => {
  const { main, watch } = page();
  const watching = watch();
  const host = new FakeElement();
  host.attachShadow().append(new FakeElement("Store list"));
  add(main, host);
  assert.equal((await watching.settle(0))?.kind, "content");
});

test("a root nested in a component added since the press is observed, and a panel opened inside it answers", async () => {
  const { main, watch } = page();
  const watching = watch();
  const outer = new FakeElement();
  const inner = new FakeElement();
  const panel = new FakeElement("Northgate: open until 9 pm");
  panel.rendered = false;
  inner.attachShadow().append(panel);
  outer.attachShadow().append(inner);
  // Added with nothing to read yet, so only the later change can answer.
  add(main, outer);
  assert.equal(await watching.settle(0), undefined, "the premise: the insertion alone showed nothing");
  const again = watch();
  setHidden(panel, false);
  assert.equal((await again.settle(0))?.kind, "content");
});

test("a root attached without any mutation to an element already in place is found by the walk, and its text answers", async () => {
  const { main, watch } = page();
  const host = new FakeElement();
  main.append(host);
  const watching = watch();
  host.attachShadow().append(new FakeElement("Your store: Harbor"));
  assert.equal((await watching.settle(0))?.kind, "content");
});

test("a change inside a closed shadow root is not seen, and the click still fails", async () => {
  const { main, watch } = page();
  const host = new FakeElement();
  main.append(host);
  // Closed: the host's `shadowRoot` is null, so the root is never reached.
  const closed = new FakeRoot(host);
  const panel = new FakeElement("Closed panel");
  panel.rendered = false;
  closed.append(panel);
  const watching = watch();
  setHidden(panel, false);
  assert.equal(await watching.settle(0), undefined);
});

test("a ripple drawn inside the link's own shadow root is inside the link, and a dead link still fails", async () => {
  const { link, watch } = page();
  const root = link.attachShadow();
  const watching = watch();
  add(root, new FakeElement("ripple"));
  assert.equal(await watching.settle(0), undefined);
});

test("a panel in the light document still answers the click, as before", async () => {
  const { main, watch } = page();
  const panel = new FakeElement("Shipping rates");
  panel.rendered = false;
  main.append(panel);
  const watching = watch();
  setHidden(panel, false);
  assert.equal((await watching.settle(0))?.kind, "content");
});

test("a panel inside a display: contents wrapper at the top of a root is read through the wrapper", async () => {
  const { main, watch } = page();
  const host = new FakeElement();
  main.append(host);
  const wrapper = new FakeElement();
  wrapper.display = "contents";
  const panel = new FakeElement("Stores near you");
  panel.rendered = false;
  wrapper.append(panel);
  host.attachShadow().append(wrapper);
  const watching = watch();
  setHidden(panel, false);
  assert.equal((await watching.settle(0))?.kind, "content");
});
