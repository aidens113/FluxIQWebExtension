// The bigbox store chooser, built by hand for Node, so a resolution can be run
// against the page a dry run and a playback actually meet.
//
// The markup is `apps/scenario-lab/src/scenarios/bigbox-retail/shell/store-picker.ts`
// with its hashed classes left off -- nothing on the created node's path reads
// a class: the header's `vr-fulfillment-picker` holds an open shadow root with
// the chip (a button of two spans, the label and the chosen store's name) and
// the flyout, whose cards each hold the store's name, address and hours and an
// identical "Set as my store" button -- except the chosen store's card, which
// holds "Your store" and no button. A hidden flyout is `hidden`, so its buttons
// have no box.
//
// The runner is Node, so these are nodes with only the members the resolver,
// `identity/` and `selector/` read, and a selector engine for the selectors
// they write and ask: tags, `*`, attributes with or without a value,
// `:nth-of-type()`, `:disabled`, comma lists, and the child and descendant
// combinators. Anything else throws, so a row cannot pass by a query quietly
// answering nothing. `installStoreChooser` installs the page and the globals
// those modules name for one test and puts them back after it.

import type { TestContext } from "node:test";

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;
const DOCUMENT_NODE = 9;
const DOCUMENT_FRAGMENT_NODE = 11;

/** The chooser's four stores, in the order the fixture lists them. */
export const STORE_CARDS = [
  { id: "2291", name: "Carden Falls Supercenter", address: "1400 Orchard Pkwy, Carden Falls", distance: "2.1 mi", hours: "Open until 11pm" },
  { id: "5510", name: "Carden Falls Neighborhood Market", address: "212 W Mill St, Carden Falls", distance: "3.4 mi", hours: "Open until 10pm" },
  { id: "1187", name: "Millbrook Crossing Supercenter", address: "88 Ferris Rd, Millbrook", distance: "9.8 mi", hours: "Open 24 hours" },
  { id: "4419", name: "Millbrook Crossing Neighborhood Market", address: "17 Canal St, Millbrook", distance: "10.6 mi", hours: "Open until 10pm" }
] as const;

export type StoreCard = (typeof STORE_CARDS)[number];

abstract class StubNode {
  parentNode: StubNode | null = null;
  readonly childNodes: StubNode[] = [];
  abstract readonly nodeType: number;
  get nodeValue(): string | null {
    return null;
  }
  get textContent(): string {
    return this.childNodes.map((node) => node.textContent).join("");
  }
  get parentElement(): StubElement | null {
    return this.parentNode instanceof StubElement ? this.parentNode : null;
  }
  get firstChild(): StubNode | null {
    return this.childNodes[0] ?? null;
  }
  getRootNode(): StubNode {
    let node: StubNode = this;
    while (node.parentNode) node = node.parentNode;
    return node;
  }
  append(...children: (StubNode | string)[]): void {
    for (const child of children) {
      const node = typeof child === "string" ? new StubText(child) : child;
      node.parentNode = this;
      this.childNodes.push(node);
    }
  }
  get children(): StubElement[] {
    return this.childNodes.filter((node): node is StubElement => node instanceof StubElement);
  }
  get childElementCount(): number {
    return this.children.length;
  }
  /** Every element below, in document order, not crossing into shadow roots. */
  descendants(): StubElement[] {
    return this.children.flatMap((child) => [child, ...child.descendants()]);
  }
  querySelectorAll(selector: string): StubElement[] {
    const alternatives = parseSelectorList(selector);
    return this.descendants().filter((element) => alternatives.some((complex) => matchesComplex(element, complex)));
  }
  querySelector(selector: string): StubElement | null {
    return this.querySelectorAll(selector)[0] ?? null;
  }
}

class StubText extends StubNode {
  readonly nodeType = TEXT_NODE;
  constructor(private readonly value: string) {
    super();
  }
  override get nodeValue(): string {
    return this.value;
  }
  override get textContent(): string {
    return this.value;
  }
}

class StubRoot extends StubNode {
  readonly nodeType: number = DOCUMENT_NODE;
  readonly activeElement = null;
  readonly defaultView = STUB_VIEW;
  get documentElement(): StubElement | undefined {
    return this.children[0];
  }
  getElementById(id: string): StubElement | null {
    return this.descendants().find((element) => element.id === id) ?? null;
  }
  addEventListener(): void {}
  removeEventListener(): void {}
}

/** An open shadow root: a root with a host, which is how the content script tells one from a document. */
class StubShadowRoot extends StubRoot {
  override readonly nodeType = DOCUMENT_FRAGMENT_NODE;
  constructor(readonly host: StubElement) {
    super();
  }
}

class StubElement extends StubNode {
  readonly nodeType = ELEMENT_NODE;
  readonly namespaceURI = "http://www.w3.org/1999/xhtml";
  readonly isContentEditable = false;
  shadowRoot: StubShadowRoot | null = null;
  private readonly attributes = new Map<string, string>();
  constructor(readonly localName: string, attributes: Record<string, string> = {}) {
    super();
    for (const [name, value] of Object.entries(attributes)) this.attributes.set(name, value);
  }
  get tagName(): string {
    return this.localName.toUpperCase();
  }
  get id(): string {
    return this.attributes.get("id") ?? "";
  }
  get classList(): string[] {
    return (this.attributes.get("class") ?? "").split(/\s+/u).filter(Boolean);
  }
  get ownerDocument(): { defaultView: typeof STUB_VIEW } {
    return { defaultView: STUB_VIEW };
  }
  get previousElementSibling(): StubElement | null {
    const siblings = this.parentNode?.children ?? [];
    return siblings[siblings.indexOf(this) - 1] ?? null;
  }
  get nextElementSibling(): StubElement | null {
    const siblings = this.parentNode?.children ?? [];
    return siblings[siblings.indexOf(this) + 1] ?? null;
  }
  get isConnected(): boolean {
    const root = this.getRootNode();
    if (!(root instanceof StubRoot)) return false;
    return root instanceof StubShadowRoot ? root.host.isConnected : root === currentDocument;
  }
  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }
  getAttributeNames(): string[] {
    return [...this.attributes.keys()];
  }
  hasAttribute(name: string): boolean {
    return this.attributes.has(name);
  }
  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }
  matches(selector: string): boolean {
    return parseSelectorList(selector).some((complex) => matchesComplex(this, complex));
  }
  closest(selector: string): StubElement | null {
    for (let current: StubElement | null = this; current; current = current.parentElement) {
      if (current.matches(selector)) return current;
    }
    return null;
  }
  attachShadow(): StubShadowRoot {
    this.shadowRoot = new StubShadowRoot(this);
    return this.shadowRoot;
  }
  /** Hidden when it or anything it is drawn inside -- across a shadow boundary -- is `hidden`. */
  get drawn(): boolean {
    for (let node: StubNode | null = this; node; node = node instanceof StubShadowRoot ? node.host : node.parentNode) {
      if (node instanceof StubElement && node.hasAttribute("hidden")) return false;
    }
    return true;
  }
  getBoundingClientRect(): { x: number; y: number; width: number; height: number; top: number; bottom: number; left: number; right: number } {
    return this.drawn
      ? { x: 10, y: 10, width: 120, height: 24, top: 10, bottom: 34, left: 10, right: 130 }
      : { x: 0, y: 0, width: 0, height: 0, top: 0, bottom: 0, left: 0, right: 0 };
  }
}

const STUB_VIEW = {
  innerHeight: 800,
  scrollX: 0,
  scrollY: 0,
  getComputedStyle: (element: StubElement) => ({ display: element.hasAttribute("hidden") ? "none" : "block", visibility: "visible" })
};

let currentDocument: StubRoot | undefined;
/** The globals a stub page displaced, while one is installed. */
let displaced: Map<string, PropertyDescriptor | undefined> | undefined;

function restoreGlobals(before: Map<string, PropertyDescriptor | undefined>): void {
  const globals = globalThis as unknown as Record<string, unknown>;
  for (const [name, descriptor] of before) {
    if (descriptor) Object.defineProperty(globals, name, descriptor);
    else delete globals[name];
  }
  displaced = undefined;
  currentDocument = undefined;
}

// ---- the selector engine ----

type Compound = { tag: string | undefined; attributes: Array<{ name: string; value: string | undefined }>; nthOfType: number | undefined; disabled: boolean };
type Complex = Array<{ combinator: " " | ">" | undefined; compound: Compound }>;

function parseSelectorList(selector: string): Complex[] {
  return selector.split(",").map((part) => parseComplex(part.trim()));
}

function parseComplex(selector: string): Complex {
  const tokens = selector.replace(/\s*>\s*/gu, " > ").split(/\s+/u).filter(Boolean);
  const complex: Complex = [];
  let combinator: " " | ">" | undefined;
  for (const token of tokens) {
    if (token === ">") {
      combinator = ">";
      continue;
    }
    complex.push({ combinator: complex.length ? combinator ?? " " : undefined, compound: parseCompound(token) });
    combinator = undefined;
  }
  if (!complex.length) throw new Error(`the stub page cannot read the selector "${selector}"`);
  return complex;
}

function parseCompound(token: string): Compound {
  const compound: Compound = { tag: undefined, attributes: [], nthOfType: undefined, disabled: false };
  let rest = token;
  const tag = /^(?:[a-z][a-z0-9-]*|\*)/u.exec(rest);
  if (tag) {
    compound.tag = tag[0] === "*" ? undefined : tag[0];
    rest = rest.slice(tag[0].length);
  }
  while (rest) {
    const attribute = /^\[([a-z-]+)(?:="([^"]*)")?\]/u.exec(rest);
    const nth = /^:nth-of-type\((\d+)\)/u.exec(rest);
    if (attribute) compound.attributes.push({ name: attribute[1] ?? "", value: attribute[2] });
    else if (nth) compound.nthOfType = Number(nth[1]);
    else if (rest.startsWith(":disabled")) compound.disabled = true;
    else throw new Error(`the stub page cannot read the selector part "${token}"`);
    rest = rest.slice((attribute ?? nth)?.[0].length ?? ":disabled".length);
  }
  return compound;
}

function matchesCompound(element: StubElement, compound: Compound): boolean {
  if (compound.tag !== undefined && element.localName !== compound.tag) return false;
  for (const { name, value } of compound.attributes) {
    const actual = element.getAttribute(name);
    if (actual === null || (value !== undefined && actual !== value)) return false;
  }
  if (compound.nthOfType !== undefined) {
    const sameType = (element.parentNode?.children ?? []).filter((sibling) => sibling.localName === element.localName);
    if (sameType.indexOf(element) + 1 !== compound.nthOfType) return false;
  }
  if (compound.disabled && !(element.localName === "button" && element.hasAttribute("disabled"))) return false;
  return true;
}

function matchesComplex(element: StubElement, complex: Complex, end = complex.length - 1): boolean {
  const part = complex[end];
  if (!part || !matchesCompound(element, part.compound)) return false;
  if (end === 0) return true;
  if (part.combinator === ">") {
    const parent = element.parentElement;
    return parent !== null && matchesComplex(parent, complex, end - 1);
  }
  for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) {
    if (matchesComplex(ancestor, complex, end - 1)) return true;
  }
  return false;
}

// ---- the page ----

function el(tag: string, attributes: Record<string, string> = {}, ...children: (StubNode | string)[]): StubElement {
  const element = new StubElement(tag, attributes);
  element.append(...children);
  return element;
}

export type StoreChooser = {
  host: Element;
  chip: Element;
  /** Each store's "Set as my store", by store id; the chosen store has none. */
  setButtons: Map<string, Element>;
};

export type StoreChooserState = {
  /** The chosen store's id. */
  chosen: string;
  /** Whether the flyout is open. */
  open: boolean;
  /** The cards, in the order the page lists them. The fixture's own order when absent. */
  order?: readonly StoreCard[];
  /** Replaces the chip with another control, to show what the stable-name reading refuses. */
  chip?: () => StubElement;
  /** Extra controls at the root's top level, beside the chip. */
  beside?: () => StubElement[];
};

/** The chip as the fixture renders it: the label, then the chosen store's name, one span each. */
export function chipButton(label: string, state: string): StubElement {
  return el("button", { type: "button" }, el("span", {}, label), el("span", {}, state));
}

/** A button whose name is one run of text. */
export function plainButton(text: string): StubElement {
  return el("button", { type: "button" }, text);
}

/** Builds the page for `state`, installs it and the globals the resolver reads, and restores both after the test. */
export function installStoreChooser(t: TestContext, state: StoreChooserState): StoreChooser {
  const document = new StubRoot();
  const host = el("vr-fulfillment-picker");
  document.append(el("html", {}, el("body", {}, el("header", {}, el("div", {}, host)))));
  const root = host.attachShadow();
  const chosen = STORE_CARDS.find((card) => card.id === state.chosen);
  if (!chosen) throw new Error(`no store ${state.chosen}`);
  const chip = state.chip?.() ?? chipButton("Pickup or delivery?", chosen.name);
  const setButtons = new Map<string, Element>();
  const cards = (state.order ?? STORE_CARDS).map((card) => {
    const control = card.id === chosen.id ? el("span", {}, "Your store") : el("button", { type: "button" }, "Set as my store");
    if (control.localName === "button") setButtons.set(card.id, control as unknown as Element);
    return el("li", {}, el("strong", {}, card.name), el("div", {}, `${card.address} · ${card.distance}`), el("div", {}, card.hours), control);
  });
  const flyout = el("div", state.open ? {} : { hidden: "" },
    el("div", {}, "×"),
    el("div", {}, el("div", {}, "Pickup"), el("div", {}, "Delivery")),
    el("p", {}, `Stores near ${chosen.address.split(", ").at(-1) ?? ""}`),
    el("ul", {}, ...cards));
  root.append(el("style", {}, ":host{display:block}"), chip, ...(state.beside?.() ?? []), flyout);

  const globals = globalThis as unknown as Record<string, unknown>;
  const installed: Record<string, unknown> = {
    document,
    window: STUB_VIEW,
    Node: { TEXT_NODE, ELEMENT_NODE },
    Element: StubElement,
    HTMLElement: StubElement,
    HTMLInputElement: class {},
    HTMLSelectElement: class {},
    HTMLTextAreaElement: class {},
    CSS: { escape: (value: string) => value.replace(/([^a-zA-Z0-9_-])/gu, "\\$1") }
  };
  // The globals as they were before the first page of this test, captured once:
  // a test that installs a second page replaces the first, and putting back
  // "what was there before the second" would leave the first page installed
  // for every test file after this one.
  if (!displaced) {
    const before = new Map(Object.keys(installed).map((name) => [name, Object.getOwnPropertyDescriptor(globals, name)] as const));
    displaced = before;
    t.after(() => restoreGlobals(before));
  }
  for (const [name, value] of Object.entries(installed)) Object.defineProperty(globals, name, { value, configurable: true, writable: true });
  currentDocument = document;
  return { host: host as unknown as Element, chip: chip as unknown as Element, setButtons };
}
