// A page small enough to build by hand, for the unit tests of the content
// script's readers. The runner is Node, so there is no DOM: these are element
// and text nodes with only the members `describe-element.ts`,
// `sensitive-text.ts` and `element-traits.ts` read, and the globals those
// modules name, installed for one test and put back afterwards because every
// test bundle runs in one process. What only a real page proves is the
// content harness's.

const TEXT_NODE = 3;
const ELEMENT_NODE = 1;

class StubNode {
  parentElement: StubElement | null = null;
  constructor(readonly nodeType: number) {}
  get textContent(): string {
    return "";
  }
}

class StubText extends StubNode {
  constructor(readonly nodeValue: string) {
    super(TEXT_NODE);
  }
  override get textContent(): string {
    return this.nodeValue;
  }
}

class StubElement extends StubNode {
  readonly childNodes: StubNode[] = [];
  readonly isContentEditable = false;
  readonly tagName: string;
  private readonly attributeValues: Map<string, string>;

  constructor(tagName: string, attributes: Record<string, string>, children: readonly (Element | string)[]) {
    super(ELEMENT_NODE);
    this.tagName = tagName.toUpperCase();
    this.attributeValues = new Map(Object.entries(attributes));
    for (const child of children) {
      const node = typeof child === "string" ? new StubText(child) : child as unknown as StubNode;
      node.parentElement = this;
      this.childNodes.push(node);
    }
  }

  get firstChild(): StubNode | null {
    return this.childNodes[0] ?? null;
  }

  /** The DOM's own reflection: the empty string when the attribute is absent, never null. */
  get id(): string {
    return this.attributeValues.get("id") ?? "";
  }

  /** Element children only, as `Element.children` gives them -- what `xpathFor` counts siblings in. */
  get children(): StubElement[] {
    return this.childNodes.filter((node): node is StubElement => node instanceof StubElement);
  }

  override get textContent(): string {
    return this.childNodes.map((node) => node.textContent).join("");
  }

  getAttribute(name: string): string | null {
    return this.attributeValues.get(name) ?? null;
  }

  querySelectorAll(selector: string): StubElement[] {
    if (selector !== "*") throw new Error(`the stub page answers only "*", not ${selector}`);
    return this.childNodes.flatMap((node) => node instanceof StubElement ? [node, ...node.querySelectorAll("*")] : []);
  }
}

class StubInput extends StubElement {
  constructor(public type: string, public value: string) {
    super("input", {}, []);
  }
}

class StubTextArea extends StubElement {}
class StubSelect extends StubElement {}

const STUB_GLOBALS: Record<string, unknown> = {
  Node: { TEXT_NODE, ELEMENT_NODE },
  HTMLElement: StubElement,
  HTMLInputElement: StubInput,
  HTMLTextAreaElement: StubTextArea,
  HTMLSelectElement: StubSelect
};

/** An element holding `children` in order; a string is a text node. Use `input` for an `<input>`. */
export function element(tagName: string, attributes: Record<string, string> = {}, ...children: (Element | string)[]): Element {
  if (tagName === "input") throw new Error("an <input> holds a live value, not children: build it with input()");
  const Kind = tagName === "textarea" ? StubTextArea : tagName === "select" ? StubSelect : StubElement;
  return new Kind(tagName, attributes, children) as unknown as Element;
}

/** An `<input>` of `type` holding the live `value`. */
export function input(type: string, value: string): Element {
  return new StubInput(type, value) as unknown as Element;
}

/** Loads the module under test with the stub globals installed, runs `body`, and puts every global back. */
export async function withStubPage<Module>(load: () => Promise<Module>, body: (loaded: Module) => void): Promise<void> {
  const globals = globalThis as unknown as Record<string, unknown>;
  const previous = new Map(Object.keys(STUB_GLOBALS).map((name) => [name, Object.getOwnPropertyDescriptor(globals, name)] as const));
  Object.assign(globals, STUB_GLOBALS);
  try {
    body(await load());
  } finally {
    for (const [name, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globals, name, descriptor);
      else delete globals[name];
    }
  }
}
