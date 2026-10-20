// A page small enough to build by hand, for the trace capture's unit tests.
// The runner is Node, so there is no DOM: these are nodes with only the members
// the serializer, `element-markup-state.ts`, `descriptor-attributes.ts` and the
// shared sensitivity rule (`element-traits.ts`) read -- elements and text, open
// shadow roots, templates, frames with documents of their own, stylesheets as
// the CSSOM presents them, and the live state of form controls.
// `installCaptureStubs` installs the globals those modules name for one test
// and puts them back after it. What only a real page proves is the content
// harness's (`e2e/content/tests/trace-capture/`).

import type { TestContext } from "node:test";

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;
const COMMENT_NODE = 8;
const DOCUMENT_NODE = 9;
const FRAGMENT_NODE = 11;
const HTML_NAMESPACE = "http://www.w3.org/1999/xhtml";
const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

type Child = StubNode | string;

class StubNode {
  parentNode: StubNode | null = null;
  readonly childNodes: StubNode[] = [];
  constructor(readonly nodeType: number, readonly nodeValue: string | null = null) {}
  get parentElement(): StubElement | null {
    return this.parentNode instanceof StubElement ? this.parentNode : null;
  }
  get textContent(): string {
    if (this.nodeType === TEXT_NODE) return this.nodeValue ?? "";
    return this.childNodes.map((node) => node.nodeType === COMMENT_NODE ? "" : node.textContent).join("");
  }
  append(...children: Child[]): this {
    for (const child of children) {
      const node = typeof child === "string" ? new StubNode(TEXT_NODE, child) : child;
      node.parentNode = this;
      this.childNodes.push(node);
    }
    return this;
  }
}

/** A stylesheet as the CSSOM presents one; `unreadable` throws as another origin's does. */
export type StubSheet = { href: string | null; readonly cssRules: Array<{ type: number; cssText: string; href?: string; styleSheet?: StubSheet | null }> };

class StubElement extends StubNode {
  shadowRoot: StubShadowRoot | null = null;
  readonly isContentEditable = false;
  private readonly values: Map<string, string>;
  constructor(readonly localName: string, attributes: Record<string, string>, readonly namespaceURI: string) {
    super(ELEMENT_NODE);
    this.values = new Map(Object.entries(attributes));
  }
  get tagName(): string {
    return this.localName.toUpperCase();
  }
  get attributes(): Array<{ name: string; value: string }> {
    return [...this.values].map(([name, value]) => ({ name, value }));
  }
  getAttribute(name: string): string | null {
    return this.values.get(name) ?? null;
  }
  hasAttribute(name: string): boolean {
    return this.values.has(name);
  }
  get ownerDocument(): StubDocument | null {
    let node: StubNode | null = this;
    while (node && !(node instanceof StubDocument)) node = node instanceof StubShadowRoot ? node.host : node.parentNode;
    return node;
  }
  attachShadow(init: { mode: "open" | "closed"; delegatesFocus?: boolean }): StubShadowRoot {
    const root = new StubShadowRoot(this, init.mode, init.delegatesFocus ?? false);
    if (init.mode === "open") this.shadowRoot = root;
    return root;
  }
}

class StubInput extends StubElement {
  value: string;
  checked = false;
  readonly labels: StubElement[] = [];
  constructor(attributes: Record<string, string>) {
    super("input", attributes, HTML_NAMESPACE);
    this.value = attributes["value"] ?? "";
    this.checked = "checked" in attributes;
  }
  get type(): string {
    return (this.getAttribute("type") ?? "text").toLowerCase();
  }
}

class StubTextArea extends StubElement {
  value = "";
}
class StubSelect extends StubElement {}
class StubOption extends StubElement {
  selected = false;
}
class StubImage extends StubElement {
  currentSrc = "";
  src = "";
}
class StubLink extends StubElement {
  href = "";
  sheet: StubSheet | null = null;
}
class StubStyle extends StubElement {
  sheet: StubSheet | null = null;
}
class StubFrame extends StubElement {
  src = "";
  contentDocument: StubDocument | null = null;
}
class StubTemplate extends StubElement {
  readonly content = new StubNode(FRAGMENT_NODE);
}

class StubShadowRoot extends StubNode {
  clonable = false;
  serializable = false;
  adoptedStyleSheets: StubSheet[] = [];
  constructor(readonly host: StubElement, readonly mode: "open" | "closed", readonly delegatesFocus: boolean) {
    super(FRAGMENT_NODE);
  }
}

class StubDocument extends StubNode {
  doctype: { name: string; publicId: string; systemId: string } | null = { name: "html", publicId: "", systemId: "" };
  adoptedStyleSheets: StubSheet[] = [];
  constructor(public URL: string) {
    super(DOCUMENT_NODE);
  }
  get documentElement(): StubElement | null {
    return this.childNodes.find((node): node is StubElement => node instanceof StubElement) ?? null;
  }
  get head(): StubElement | null {
    return this.documentElement?.childNodes.find((node): node is StubElement => node instanceof StubElement && node.localName === "head") ?? null;
  }
  get body(): StubElement | null {
    return this.documentElement?.childNodes.find((node): node is StubElement => node instanceof StubElement && node.localName === "body") ?? null;
  }
  getElementById(id: string): StubElement | null {
    const walk = (node: StubNode): StubElement | null => {
      if (node instanceof StubElement && node.getAttribute("id") === id) return node;
      for (const child of node.childNodes) {
        const found = walk(child);
        if (found) return found;
      }
      return null;
    };
    return walk(this);
  }
}

export type { StubDocument, StubElement, StubFrame, StubImage, StubInput, StubLink, StubOption, StubShadowRoot, StubStyle, StubTemplate, StubTextArea };

const KINDS: Record<string, new (tag: string, attributes: Record<string, string>, namespace: string) => StubElement> = {
  textarea: StubTextArea,
  select: StubSelect,
  option: StubOption,
  img: StubImage,
  link: StubLink,
  style: StubStyle,
  iframe: StubFrame,
  frame: StubFrame,
  template: StubTemplate
};

/** An HTML element holding `children` in order; a string is a text node. */
export function h(tag: string, attributes: Record<string, string> = {}, ...children: Child[]): StubElement {
  if (tag === "input") return new StubInput(attributes);
  const Kind = KINDS[tag] ?? StubElement;
  return new Kind(tag, attributes, HTML_NAMESPACE).append(...children);
}

/** An SVG element holding `children`. */
export function svg(tag: string, attributes: Record<string, string> = {}, ...children: Child[]): StubElement {
  return new StubElement(tag, attributes, SVG_NAMESPACE).append(...children);
}

/** A comment node, which the capture never writes. */
export function comment(text: string): StubNode {
  return new StubNode(COMMENT_NODE, text);
}

/** A document at `url` whose root is `<html>` holding `head` and `body`. */
export function page(url: string, head: Child[], body: Child[]): StubDocument {
  return new StubDocument(url).append(h("html", { lang: "en" }, h("head", {}, ...head), h("body", {}, ...body)));
}

/** A readable stylesheet holding `rules`, at `href` when it is linked. */
export function sheet(rules: string[], href: string | null = null, imports: StubSheet[] = []): StubSheet {
  const importRules = imports.map((imported) => ({ type: 3, cssText: `@import url("${imported.href}");`, href: imported.href ?? "", styleSheet: imported }));
  return { href, cssRules: [...importRules, ...rules.map((cssText) => ({ type: 1, cssText }))] };
}

/** A stylesheet whose rules throw `name` when read, as another origin's throws `SecurityError`. */
export function unreadableSheet(href: string, name = "SecurityError"): StubSheet {
  return {
    href,
    get cssRules(): never {
      throw new DOMException("The rules of this stylesheet cannot be read.", name);
    }
  };
}

/** Installs the globals the capture's modules read, for this test, and puts them back after it. */
export function installCaptureStubs(t: TestContext): void {
  const globals = globalThis as unknown as Record<string, unknown>;
  const installed: Record<string, unknown> = {
    Node: { ELEMENT_NODE, TEXT_NODE },
    HTMLElement: StubElement,
    HTMLInputElement: StubInput,
    HTMLTextAreaElement: StubTextArea,
    HTMLSelectElement: StubSelect
  };
  const before = new Map(Object.keys(installed).map((name) => [name, Object.getOwnPropertyDescriptor(globals, name)] as const));
  for (const [name, value] of Object.entries(installed)) Object.defineProperty(globals, name, { value, configurable: true, writable: true });
  t.after(() => {
    for (const [name, descriptor] of before) {
      if (descriptor) Object.defineProperty(globals, name, descriptor);
      else delete globals[name];
    }
  });
}

/** The stub document as the DOM type the capture takes. */
export function asDocument(doc: StubDocument): Document {
  return doc as unknown as Document;
}
