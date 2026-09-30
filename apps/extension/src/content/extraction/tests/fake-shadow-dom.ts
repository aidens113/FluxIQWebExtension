// The least DOM a list field read and field inference touch, for Node, with
// open shadow roots and slots: elements with attributes, text nodes, light
// `textContent` that -- as in a browser -- never enters a shadow root, and a
// `querySelectorAll` that understands the selectors inference writes (`*`,
// `[attr]`, `[attr="v"]`, `tag.class`, `tag:nth-of-type(n)` and `:scope > a > b`
// chains) and, as in a browser, never crosses a shadow boundary.
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
  querySelectorAll(selector: string): FakeElement[] {
    if (selector.startsWith(":scope > ")) {
      let current: FakeElement[] = this.children;
      const steps = selector.slice(":scope > ".length).split(" > ");
      current = current.filter((element) => element.matchesStep(steps[0]!));
      for (const step of steps.slice(1)) current = current.flatMap((element) => element.children.filter((child) => child.matchesStep(step)));
      return current;
    }
    const found: FakeElement[] = [];
    const walk = (element: FakeElement): void => {
      if (selector === "*" || element.matchesStep(selector)) found.push(element);
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

const STEP = /^([a-z][a-z0-9-]*)?((?:\.[\w-]+)*)(?:\[([\w-]+)(?:="([^"]*)")?\])?(?::nth-of-type\((\d+)\))?$/u;

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
  closest(): null {
    return null;
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
    const parsed = STEP.exec(step);
    if (!parsed) throw new SyntaxError(`fake-shadow-dom cannot read the selector ${step}`);
    const [, tag, classes, attribute, value, nth] = parsed;
    if (tag !== undefined && this.tagName !== tag.toUpperCase()) return false;
    if (classes && !classes.slice(1).split(".").every((name) => this.classList.includes(name))) return false;
    if (attribute !== undefined && (!this.attrs.has(attribute) || (value !== undefined && this.attrs.get(attribute) !== value))) return false;
    if (nth !== undefined) {
      const siblings = (this.parentNode?.children ?? []).filter((sibling) => sibling.tagName === this.tagName);
      if (siblings.indexOf(this) + 1 !== Number(nth)) return false;
    }
    return true;
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
