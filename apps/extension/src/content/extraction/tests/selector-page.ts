// A page small enough to write in a test, with a real selector matcher, for
// the tests of what pagination detection and run naming propose
// (`detect-pagination.test.ts`, `item-selector.test.ts`) and of the skeletons
// a detection waits for (`../placeholder-run/tests/`). Node has no document,
// and what those modules propose is only right if `querySelectorAll` answers
// it with exactly the elements meant, so the matcher is the part that has to
// be true: type, `*`,
// `#id`, `.class`, `[name]`, `[name="value"]`, `[name^="value"]`,
// `:nth-of-type(n)` and `:root` compounds, joined by the descendant and child
// combinators, in comma lists -- everything `selectorFor`, the item selector's
// candidates and the pager lookup write. Anything else throws, so a test
// cannot pass on a selector this page only pretended to read.
//
// `page(body)` stands the tree up as the document until `restore`, with the
// three browser names the label reader and `selectorFor` ask about.

const HTML_NAMESPACE = "http://www.w3.org/1999/xhtml";

/** An element, as much of one as detection, `selectorFor` and the label reader ask for. */
export class PageElement {
  readonly nodeType = 1;
  readonly namespaceURI = HTML_NAMESPACE;
  readonly tagName: string;
  parentElement: PageElement | null = null;
  readonly children: PageElement[] = [];
  private readonly attributes: Map<string, string>;
  private readonly ownText: string;

  constructor(tag: string, attributes: Record<string, string> = {}, content: string | PageElement[] = []) {
    this.tagName = tag.toUpperCase();
    this.attributes = new Map(Object.entries(attributes));
    this.ownText = typeof content === "string" ? content : "";
    for (const child of typeof content === "string" ? [] : content) {
      child.parentElement = this;
      this.children.push(child);
    }
  }

  get localName(): string {
    return this.tagName.toLowerCase();
  }

  /**
   * The parent whose children `selectorFor` counts for `:nth-of-type`
   * (`selector/sibling-position.ts` takes them from the parent node, so the top
   * of a shadow tree counts the shadow root's). Here every parent is an element;
   * the root's is `null`, which the position reads as standing alone, as `html` does.
   */
  get parentNode(): PageElement | null {
    return this.parentElement;
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  get classList(): string[] {
    return (this.getAttribute("class") ?? "").split(/\s+/u).filter(Boolean);
  }

  get textContent(): string {
    return this.ownText + this.children.map((child) => child.textContent).join("");
  }

  get firstChild(): unknown {
    return this.children[0] ?? (this.ownText === "" ? null : {});
  }

  get isConnected(): boolean {
    return current !== undefined && this.top() === current.root;
  }

  getRootNode(): unknown {
    return this.isConnected ? current!.document : this.top();
  }

  get previousElementSibling(): PageElement | null {
    const siblings = this.parentElement?.children ?? [];
    return siblings[siblings.indexOf(this) - 1] ?? null;
  }

  get nextElementSibling(): PageElement | null {
    const siblings = this.parentElement?.children ?? [];
    return siblings[siblings.indexOf(this) + 1] ?? null;
  }

  contains(other: PageElement | null): boolean {
    for (let node = other; node; node = node.parentElement) if (node === this) return true;
    return false;
  }

  matches(selector: string): boolean {
    return parseList(selector).some((complex) => matchesComplex(this, complex, complex.length - 1));
  }

  closest(selector: string): PageElement | null {
    for (let node: PageElement | null = this; node; node = node.parentElement) if (node.matches(selector)) return node;
    return null;
  }

  querySelectorAll(selector: string): PageElement[] {
    const list = parseList(selector);
    return descendants(this).filter((element) => list.some((complex) => matchesComplex(element, complex, complex.length - 1)));
  }

  querySelector(selector: string): PageElement | null {
    return this.querySelectorAll(selector)[0] ?? null;
  }

  private top(): PageElement {
    let node: PageElement = this;
    while (node.parentElement) node = node.parentElement;
    return node;
  }
}

/** Builds an element: `el("a", { class: "page" }, "2")`, or with children in place of the text. */
export const el = (tag: string, attributes: Record<string, string> = {}, content: string | PageElement[] = []): PageElement => new PageElement(tag, attributes, content);

/** The tree as a list of elements, typed as the modules under test take them. */
export const asElements = (elements: readonly PageElement[]): Element[] => elements as unknown as Element[];

type Stood = { root: PageElement; document: Record<string, unknown> };
let current: Stood | undefined;

/** Stands `body` up, inside an `html` root, as the document until `restore`. */
export function page(body: PageElement): { document: Record<string, unknown>; restore(): void } {
  const root = el("html", {}, [body]);
  const names = ["document", "CSS", "HTMLInputElement", "HTMLElement"] as const;
  const global = globalThis as Record<string, unknown>;
  const saved = names.map((name) => global[name]);
  const document: Record<string, unknown> = {
    nodeType: 9,
    documentElement: root,
    body,
    URL: "http://page.test/results",
    querySelectorAll: (selector: string) => [...(root.matches(selector) ? [root] : []), ...root.querySelectorAll(selector)],
    querySelector: (selector: string) => (root.matches(selector) ? root : root.querySelector(selector))
  };
  current = { root, document };
  global.document = document;
  global.CSS = { escape: (value: string) => value };
  global.HTMLInputElement = class {};
  global.HTMLElement = PageElement;
  return {
    document,
    restore: () => {
      current = undefined;
      names.forEach((name, index) => { global[name] = saved[index]; });
    }
  };
}

function descendants(root: PageElement): PageElement[] {
  return root.children.flatMap((child) => [child, ...descendants(child)]);
}

// ## The matcher

type Compound = { tag?: string; id?: string; classes: string[]; attributes: Array<{ name: string; operator: "" | "^" | "has"; value: string }>; nth?: number; root: boolean };
/** A complex selector, left to right: each compound with the combinator that joins it to the one before (`" "` or `">"`; the first's is ignored). */
type Complex = Array<{ compound: Compound; combinator: " " | ">" }>;

function parseList(selector: string): Complex[] {
  return splitTopLevel(selector, ",").map((part) => parseComplex(part.trim()));
}

function splitTopLevel(text: string, separator: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quoted = false;
  let start = 0;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === "\"" && text[index - 1] !== "\\") quoted = !quoted;
    else if (!quoted && (character === "[" || character === "(")) depth += 1;
    else if (!quoted && (character === "]" || character === ")")) depth -= 1;
    else if (!quoted && depth === 0 && character === separator) {
      parts.push(text.slice(start, index));
      start = index + 1;
    }
  }
  parts.push(text.slice(start));
  return parts;
}

function parseComplex(selector: string): Complex {
  const complex: Complex = [];
  let rest = selector;
  let combinator: " " | ">" = " ";
  while (rest.length > 0) {
    const [compound, remaining] = parseCompound(rest, selector);
    complex.push({ compound, combinator });
    const joint = /^\s*(>)?\s*/u.exec(remaining)!;
    combinator = joint[1] === ">" ? ">" : " ";
    rest = remaining.slice(joint[0].length);
    if (joint[0].length === 0 && rest.length > 0) throw new Error(`The test page does not read the selector ${JSON.stringify(selector)}.`);
  }
  if (complex.length === 0) throw new Error(`The test page does not read the empty selector ${JSON.stringify(selector)}.`);
  return complex;
}

function parseCompound(text: string, whole: string): [Compound, string] {
  const compound: Compound = { classes: [], attributes: [], root: false };
  let rest = text;
  const tag = /^(\*|[a-zA-Z][\w-]*)/u.exec(rest);
  if (tag) {
    if (tag[1] !== "*") compound.tag = tag[1]!.toUpperCase();
    rest = rest.slice(tag[0].length);
  }
  for (let parsed = true; parsed;) {
    parsed = false;
    const simple = /^#([\w-]+)|^\.([\w-]+)|^\[([\w-]+)(?:(\^?)="((?:[^"\\]|\\.)*)")?\]|^:nth-of-type\((\d+)\)|^:root/u.exec(rest);
    if (!simple) break;
    parsed = true;
    const [all, id, className, attribute, operator, value, nth] = simple;
    if (id !== undefined) compound.id = id;
    else if (className !== undefined) compound.classes.push(className);
    else if (attribute !== undefined) compound.attributes.push({ name: attribute, operator: value === undefined ? "has" : operator === "^" ? "^" : "", value: (value ?? "").replace(/\\(.)/gu, "$1") });
    else if (nth !== undefined) compound.nth = Number(nth);
    else compound.root = true;
    rest = rest.slice(all.length);
  }
  if (rest === text) throw new Error(`The test page does not read the selector ${JSON.stringify(whole)}.`);
  return [compound, rest];
}

function matchesCompound(element: PageElement, compound: Compound): boolean {
  if (compound.tag !== undefined && element.tagName !== compound.tag) return false;
  if (compound.id !== undefined && element.getAttribute("id") !== compound.id) return false;
  if (!compound.classes.every((name) => element.classList.includes(name))) return false;
  for (const { name, operator, value } of compound.attributes) {
    const actual = element.getAttribute(name);
    if (actual === null) return false;
    if (operator === "" && actual !== value) return false;
    if (operator === "^" && !actual.startsWith(value)) return false;
  }
  if (compound.root && element !== current?.root) return false;
  if (compound.nth !== undefined) {
    const sameTag = (element.parentElement?.children ?? [element]).filter((sibling) => sibling.tagName === element.tagName);
    if (sameTag.indexOf(element) !== compound.nth - 1) return false;
  }
  return true;
}

/** Whether `element` matches the complex selector's compounds up to `index`, right to left. */
function matchesComplex(element: PageElement, complex: Complex, index: number): boolean {
  const step = complex[index]!;
  if (!matchesCompound(element, step.compound)) return false;
  if (index === 0) return true;
  if (step.combinator === ">") return element.parentElement !== null && matchesComplex(element.parentElement, complex, index - 1);
  for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) {
    if (matchesComplex(ancestor, complex, index - 1)) return true;
  }
  return false;
}
