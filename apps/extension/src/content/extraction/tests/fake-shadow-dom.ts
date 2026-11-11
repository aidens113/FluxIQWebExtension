// The least DOM a list field read and field inference touch, for Node, with
// open shadow roots and slots: elements with attributes, text nodes, light
// `textContent` that -- as in a browser -- never enters a shadow root, and a
// `querySelectorAll` that understands the selectors inference writes (`*`,
// `tag.class`, any number of `[attr]`, `[attr="v"]`, `[attr^="v"]` and
// `:not([attr])` tests, the disabled condition `:is([aria-disabled="true"],
// :disabled)`, `tag:nth-of-type(n)`, `:scope > a > b` chains, a `:scope a`
// descendant step, and `:scope` with a condition, which names no descendant)
// and, as in a browser, never crosses a shadow boundary. `matches` reads one
// compound and `closest` a chain joined by `>`. Anything else throws, so a
// test cannot pass on a selector this fake only pretended to read.
//
// Elements can be redrawn (`replaceChildren`, `setAttribute`), which is what a
// test that presses a disclosure control stands in for.
//
// `fakeShadowDom()` installs the globals the readers ask (`Node` and the form
// control classes they test `instanceof` against) and returns the builders.

type FakeChild = FakeElement | FakeText;
type FakeParent = FakeElement | FakeShadowRoot;

class FakeText {
  readonly nodeType = 3;
  parentNode: FakeParent | null = null;
  constructor(public nodeValue: string) {}
  get textContent(): string {
    return this.nodeValue;
  }
}

class FakeParentNode {
  readonly childNodes: FakeChild[] = [];
  get children(): FakeElement[] {
    return this.childNodes.filter((node): node is FakeElement => node instanceof FakeElement);
  }
  get firstChild(): FakeChild | null {
    return this.childNodes[0] ?? null;
  }
  append(...nodes: Array<FakeChild | string>): void {
    for (const node of nodes) {
      const child = typeof node === "string" ? new FakeText(node) : node;
      child.parentNode = this as unknown as FakeParent;
      this.childNodes.push(child);
    }
  }
  /** Replaces every child, detaching the old ones, as a page that redraws an element's content does. */
  replaceChildren(...nodes: Array<FakeChild | string>): void {
    for (const child of this.childNodes) child.parentNode = null;
    this.childNodes.length = 0;
    this.append(...nodes);
  }
  querySelectorAll(selector: string): FakeElement[] {
    // `:scope` with a condition names the element searched from, which is never one of its descendants.
    if (/^:scope[[.:#]/u.test(selector)) return [];
    if (selector.startsWith(":scope > ")) {
      let current: FakeElement[] = this.children;
      const steps = selector.slice(":scope > ".length).split(" > ");
      current = current.filter((element) => element.matchesStep(steps[0]!));
      for (const step of steps.slice(1)) current = current.flatMap((element) => element.children.filter((child) => child.matchesStep(step)));
      return current;
    }
    if (selector.startsWith(":scope ")) return this.querySelectorAll(selector.slice(":scope ".length));
    // A list of compounds names any of them, in document order.
    const alternatives = topLevelAlternatives(selector);
    const found: FakeElement[] = [];
    const walk = (element: FakeElement): void => {
      if (selector === "*" || alternatives.some((alternative) => element.matchesStep(alternative))) found.push(element);
      element.children.forEach(walk);
    };
    this.children.forEach(walk);
    return found;
  }
  querySelector(selector: string): FakeElement | null {
    return this.querySelectorAll(selector)[0] ?? null;
  }
}

class FakeShadowRoot extends FakeParentNode {
  readonly nodeType = 11;
  constructor(readonly host: FakeElement) {
    super();
  }
}

const STEP_TAG = /^[a-z][a-z0-9-]*/u;

/** A selector list split at its commas, leaving a comma inside brackets, parentheses or quotes in its compound. */
function topLevelAlternatives(selector: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quoted = false;
  let start = 0;
  for (let index = 0; index < selector.length; index += 1) {
    const character = selector[index];
    if (character === "\"" && selector[index - 1] !== "\\") quoted = !quoted;
    else if (!quoted && (character === "[" || character === "(")) depth += 1;
    else if (!quoted && (character === "]" || character === ")")) depth -= 1;
    else if (!quoted && depth === 0 && character === ",") {
      parts.push(selector.slice(start, index).trim());
      start = index + 1;
    }
  }
  parts.push(selector.slice(start).trim());
  return parts;
}

/** One test of a compound after its tag: a class, an attribute test, a position, an absent attribute, or the disabled condition. */
const STEP_PART = /^(?:\.([\w-]+)|\[([\w-]+)(?:(\^?)="((?:[^"\\]|\\.)*)")?\]|:nth-of-type\((\d+)\)|:not\(\[([\w-]+)\]\)|(:is\(\[aria-disabled="true"\], :disabled\)))/u;

class FakeElement extends FakeParentNode {
  readonly nodeType = 1;
  readonly tagName: string;
  parentNode: FakeParent | null = null;
  shadowRoot: FakeShadowRoot | null = null;
  private readonly attrs = new Map<string, string>();
  assigned: FakeChild[] | undefined;
  constructor(tag: string, attributes: Record<string, string>) {
    super();
    this.tagName = tag.toUpperCase();
    for (const [name, value] of Object.entries(attributes)) this.attrs.set(name, value);
  }
  get parentElement(): FakeElement | null {
    return this.parentNode instanceof FakeElement ? this.parentNode : null;
  }
  get textContent(): string {
    return this.childNodes.map((node) => node.textContent).join("");
  }
  get attributes(): Array<{ name: string; value: string }> {
    return [...this.attrs].map(([name, value]) => ({ name, value }));
  }
  get classList(): string[] {
    return (this.attrs.get("class") ?? "").split(/\s+/u).filter(Boolean);
  }
  getAttribute(name: string): string | null {
    return this.attrs.get(name) ?? null;
  }
  hasAttribute(name: string): boolean {
    return this.attrs.has(name);
  }
  setAttribute(name: string, value: string): void {
    this.attrs.set(name, value);
  }
  /** The nearest of this element and its ancestors that a compound, or a chain of compounds joined by `>`, names; a list separated by commas names any of them. */
  closest(selector: string): FakeElement | null {
    const chains = topLevelAlternatives(selector).map((alternative) => alternative.split(/\s*>\s*/u));
    for (let current: FakeElement | null = this; current; current = current.parentElement) {
      const at: FakeElement = current;
      if (chains.some((chain) => at.matchesChain(chain))) return current;
    }
    return null;
  }
  /** Whether one compound names this element. */
  matches(selector: string): boolean {
    return this.matchesStep(selector);
  }
  private matchesChain(steps: readonly string[]): boolean {
    const last = steps.at(-1);
    if (last === undefined || !this.matchesStep(last)) return false;
    return steps.length === 1 || (this.parentElement?.matchesChain(steps.slice(0, -1)) ?? false);
  }
  /** Light-tree containment, as `Node.contains`: it never crosses a shadow boundary. */
  contains(other: FakeElement | null): boolean {
    for (let current: FakeElement | null = other; current; current = current.parentElement) {
      if (current === this) return true;
    }
    return false;
  }
  attachShadow(): FakeShadowRoot {
    this.shadowRoot = new FakeShadowRoot(this);
    return this.shadowRoot;
  }
  assignedNodes(): FakeChild[] {
    return this.assigned ?? [];
  }
  matchesStep(step: string): boolean {
    const tag = STEP_TAG.exec(step)?.[0];
    let matches = tag === undefined || this.tagName === tag.toUpperCase();
    for (let rest = step.slice(tag?.length ?? 0); rest !== "";) {
      const part = STEP_PART.exec(rest);
      if (!part) throw new SyntaxError(`fake-shadow-dom cannot read the selector ${step}`);
      rest = rest.slice(part[0].length);
      matches &&= this.matchesPart(part);
    }
    return matches;
  }
  private matchesPart([, className, attribute, prefix, value, nth, absent, disabled]: RegExpExecArray): boolean {
    if (disabled !== undefined) return this.attrs.get("aria-disabled") === "true" || this.attrs.has("disabled");
    if (className !== undefined) return this.classList.includes(className);
    if (absent !== undefined) return !this.attrs.has(absent);
    if (nth !== undefined) {
      const siblings = (this.parentNode?.children ?? []).filter((sibling) => sibling.tagName === this.tagName);
      return siblings.indexOf(this) + 1 === Number(nth);
    }
    const actual = attribute === undefined ? undefined : this.attrs.get(attribute);
    if (actual === undefined) return false;
    if (value === undefined) return true;
    const wanted = value.replace(/\\(.)/gu, "$1");
    return prefix === "^" ? actual.startsWith(wanted) : actual === wanted;
  }
}

/** Installs the globals the readers need and returns the builders: an element, a shadow root attached to a host, and a slot's assignment. */
export function fakeShadowDom() {
  const globals = globalThis as Record<string, unknown>;
  globals.Node ??= { ELEMENT_NODE: 1, TEXT_NODE: 3, DOCUMENT_FRAGMENT_NODE: 11 };
  for (const name of ["HTMLInputElement", "HTMLTextAreaElement", "HTMLSelectElement"]) globals[name] ??= class {};
  return {
    /** An element with attributes and children; a string child is a text node. */
    el(tag: string, attributes: Record<string, string> = {}, ...children: Array<Element | string>): Element {
      const element = new FakeElement(tag, attributes);
      element.append(...(children as unknown as Array<FakeChild | string>));
      return element as unknown as Element;
    },
    /** Attaches an open shadow root to `host` holding `children`, and returns the host. */
    shadow(host: Element, ...children: Array<Element | string>): Element {
      (host as unknown as FakeElement).attachShadow().append(...(children as unknown as Array<FakeChild | string>));
      return host;
    },
    /** Assigns light nodes to a slot, as a browser does for a host's slotted children. */
    assign(slot: Element, ...nodes: Element[]): void {
      (slot as unknown as FakeElement).assigned = nodes as unknown as FakeChild[];
    }
  };
}
