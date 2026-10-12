// A hand-built document for the content script's unit tests that resolve,
// enumerate or describe elements against a whole page: a tree of element and
// text nodes, open shadow roots, and a selector engine for the selectors the
// resolver, `identity/`, `selector/` and `describe-element.ts` write and ask.
//
// The runner is Node, so these are nodes with only the members those modules
// read. The engine reads tags, `*`, `.class`, `#id`, attributes with or without
// a value (either quote), `:nth-of-type()`, `:disabled`, comma lists, and the
// child and descendant combinators. Anything else throws, so a row cannot pass
// by a query quietly answering nothing.
//
// Two facts only a browser computes are written on the markup instead. A
// `style` attribute's `cursor:` is the element's cursor, inherited by its
// descendants as a computed cursor is (`evidence/press-cursor.ts`). And
// `listenForPress` marks an element the page world says the page listens on,
// which is what the content script's press probe (`page-press.ts`) asks.
//
// `installStubDocument` installs a page and the globals those modules name for
// one test and puts them back after it. Lifted out of the bigbox store chooser
// (`action-runtime/tests/store-chooser-page.ts`, t436) so a second page did not
// need a second engine.

import type { TestContext } from "node:test";
import { PRESS_PROBE_EVENT } from "../../shared/press-probe-event";

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;
const DOCUMENT_NODE = 9;
const DOCUMENT_FRAGMENT_NODE = 11;

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

/** A document. Built by `stubDocument`. */
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

/** A class list as the content script reads one: spread, and asked `contains`. */
type StubClassList = string[] & { contains(name: string): boolean };

/** An element. Built by `el`. */
class StubElement extends StubNode {
  readonly nodeType = ELEMENT_NODE;
  readonly namespaceURI = "http://www.w3.org/1999/xhtml";
  readonly isContentEditable = false;
  shadowRoot: StubShadowRoot | null = null;
  /** The page world says the page listens for presses here (`listenForPress`). */
  listensForPress = false;
  private readonly attributeValues = new Map<string, string>();
  constructor(readonly localName: string, attributes: Record<string, string> = {}) {
    super();
    for (const [name, value] of Object.entries(attributes)) this.attributeValues.set(name, value);
  }
  get tagName(): string {
    return this.localName.toUpperCase();
  }
  get id(): string {
    return this.attributeValues.get("id") ?? "";
  }
  get classList(): StubClassList {
    const names = (this.attributeValues.get("class") ?? "").split(/\s+/u).filter(Boolean);
    return Object.assign(names, { contains: (name: string) => names.includes(name) });
  }
  /** `Element.attributes`: every attribute, in the order the page wrote them. */
  get attributes(): Array<{ name: string; value: string }> {
    return [...this.attributeValues].map(([name, value]) => ({ name, value }));
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
    return this.attributeValues.get(name) ?? null;
  }
  getAttributeNames(): string[] {
    return [...this.attributeValues.keys()];
  }
  hasAttribute(name: string): boolean {
    return this.attributeValues.has(name);
  }
  setAttribute(name: string, value: string): void {
    this.attributeValues.set(name, value);
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
  /** The press probe's answer: cancelled where the page listens, as the page world cancels it. */
  dispatchEvent(event: { type: string }): boolean {
    return !(event.type === PRESS_PROBE_EVENT && this.listensForPress);
  }
  /** Hidden when it or anything it is drawn inside -- across a shadow boundary -- is `hidden`. */
  get drawn(): boolean {
    for (let node: StubNode | null = this; node; node = node instanceof StubShadowRoot ? node.host : node.parentNode) {
      if (node instanceof StubElement && node.hasAttribute("hidden")) return false;
    }
    return true;
  }
  /** The cursor its own `style` sets, or the one it inherits. */
  get cursor(): string {
    const own = /cursor:\s*([a-z-]+)/u.exec(this.getAttribute("style") ?? "")?.[1];
    if (own) return own;
    const parent = this.parentNode instanceof StubShadowRoot ? this.parentNode.host : this.parentElement;
    return parent?.cursor ?? "auto";
  }
  getBoundingClientRect(): { x: number; y: number; width: number; height: number; top: number; bottom: number; left: number; right: number } {
    return this.drawn
      ? { x: 10, y: 10, width: 120, height: 24, top: 10, bottom: 34, left: 10, right: 130 }
      : { x: 0, y: 0, width: 0, height: 0, top: 0, bottom: 0, left: 0, right: 0 };
  }
}

const STUB_VIEW = {
  innerHeight: 800,
  innerWidth: 1280,
  scrollX: 0,
  scrollY: 0,
  getComputedStyle: (element: StubElement) => ({
    display: element.hasAttribute("hidden") ? "none" : "block",
    visibility: "visible",
    cursor: element.cursor
  })
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

type Compound = {
  tag: string | undefined;
  attributes: Array<{ name: string; value: string | undefined }>;
  classes: string[];
  id: string | undefined;
  nthOfType: number | undefined;
  disabled: boolean;
};
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

/** An identifier as `CSS.escape` writes one, read back. */
const IDENTIFIER = String.raw`((?:\\.|[A-Za-z0-9_-])+)`;
const unescape = (identifier: string): string => identifier.replace(/\\(.)/gu, "$1");

function parseCompound(token: string): Compound {
  const compound: Compound = { tag: undefined, attributes: [], classes: [], id: undefined, nthOfType: undefined, disabled: false };
  let rest = token;
  const tag = /^(?:[a-z][a-z0-9-]*|\*)/u.exec(rest);
  if (tag) {
    compound.tag = tag[0] === "*" ? undefined : tag[0];
    rest = rest.slice(tag[0].length);
  }
  while (rest) {
    const attribute = /^\[([a-z-]+)(?:=(?:"([^"]*)"|'([^']*)'))?\]/u.exec(rest);
    const className = new RegExp(`^\\.${IDENTIFIER}`, "u").exec(rest);
    const id = new RegExp(`^#${IDENTIFIER}`, "u").exec(rest);
    const nth = /^:nth-of-type\((\d+)\)/u.exec(rest);
    const disabled = /^:disabled/u.exec(rest);
    if (attribute) compound.attributes.push({ name: attribute[1] ?? "", value: attribute[2] ?? attribute[3] });
    else if (className) compound.classes.push(unescape(className[1] ?? ""));
    else if (id) compound.id = unescape(id[1] ?? "");
    else if (nth) compound.nthOfType = Number(nth[1]);
    else if (disabled) compound.disabled = true;
    else throw new Error(`the stub page cannot read the selector part "${token}"`);
    rest = rest.slice((attribute ?? className ?? id ?? nth ?? disabled)?.[0].length ?? 0);
  }
  return compound;
}

function matchesCompound(element: StubElement, compound: Compound): boolean {
  if (compound.tag !== undefined && element.localName !== compound.tag) return false;
  if (compound.id !== undefined && element.id !== compound.id) return false;
  if (compound.classes.some((name) => !element.classList.contains(name))) return false;
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

// ---- building and installing a page ----

export type { StubElement, StubRoot };

/** An element holding `children` in order; a string is a text node. */
export function el(tag: string, attributes: Record<string, string> = {}, ...children: (StubNode | string)[]): StubElement {
  const element = new StubElement(tag, attributes);
  element.append(...children);
  return element;
}

/** Marks `element` as one the page bound a press listener to in its own world, and returns it. */
export function listenForPress(element: StubElement): StubElement {
  element.listensForPress = true;
  return element;
}

/** An empty document, for `installStubDocument`. */
export function stubDocument(): StubRoot {
  return new StubRoot();
}

/** Installs `document` and the globals the content script reads for this test, and puts them back after it. */
export function installStubDocument(t: TestContext, document: StubRoot): void {
  const globals = globalThis as unknown as Record<string, unknown>;
  const installed: Record<string, unknown> = {
    document,
    window: STUB_VIEW,
    getComputedStyle: STUB_VIEW.getComputedStyle,
    Node: { TEXT_NODE, ELEMENT_NODE },
    Element: StubElement,
    HTMLElement: StubElement,
    HTMLInputElement: class {},
    HTMLSelectElement: class {},
    HTMLTextAreaElement: class {},
    HTMLAnchorElement: class {},
    HTMLTableCellElement: class {},
    HTMLTableRowElement: class {},
    HTMLTableElement: class {},
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
}
