// The least DOM the interference clearing reads, for Node: elements with a tag,
// attributes, parents, children and text, `closest`/`matches`/`querySelectorAll`
// over simple selectors, painted boxes, and presses that record themselves.
//
// Selectors are matched only in the forms the clearing's own constants use --
// a tag, attribute tests (`[a]`, `[a="v"]`), the two together, and comma lists.
// Anything else (descendant combinators, pseudo-classes) matches nothing, as a
// selector the page no longer satisfies would: that is the case the step-target
// rows need, and it keeps the challenge classifier's selectors inert here.

export type FakeElement = Element & {
  /** Every event type dispatched on this element, in order. */
  readonly events: string[];
  /** Whether a `click` reached it. */
  readonly pressed: boolean;
};

type Child = FakeElement | string;

const TEXT_NODE = 3;
const PAGE_HREF = "http://127.0.0.1:4000/scenarios/social-network-feed/friends/requests/";

class Fake {
  parent: Fake | undefined;
  readonly nodes: Array<Fake | { nodeType: 3; textContent: string }> = [];
  readonly events: string[] = [];
  onClick: (() => void) | undefined;
  readonly nodeType = 1;
  readonly shadowRoot = null;
  readonly isConnected = true;
  readonly ownerDocument = { location: { href: PAGE_HREF }, defaultView: {} };

  constructor(readonly tag: string, readonly attrs: Record<string, string>) {}

  get tagName(): string {
    return this.tag.toUpperCase();
  }
  get localName(): string {
    return this.tag;
  }
  get parentElement(): Fake | null {
    return this.parent ?? null;
  }
  get parentNode(): Fake | null {
    return this.parent ?? null;
  }
  get children(): Fake[] {
    return this.nodes.filter((node): node is Fake => node instanceof Fake);
  }
  get childNodes(): Array<Fake | { nodeType: 3; textContent: string }> {
    return this.nodes;
  }
  get childElementCount(): number {
    return this.children.length;
  }
  get textContent(): string {
    return this.nodes.map((node) => node.textContent).join("");
  }
  get value(): string | undefined {
    return this.attrs.value;
  }
  get pressed(): boolean {
    return this.events.includes("click");
  }
  getAttribute(name: string): string | null {
    return this.attrs[name] ?? null;
  }
  hasAttribute(name: string): boolean {
    return name in this.attrs;
  }
  descendants(): Fake[] {
    return this.children.flatMap((child) => [child, ...child.descendants()]);
  }
  querySelectorAll(selector: string): Fake[] {
    return this.descendants().filter((element) => element.matches(selector));
  }
  querySelector(selector: string): Fake | null {
    return this.querySelectorAll(selector)[0] ?? null;
  }
  matches(selector: string): boolean {
    return selector === "*" || selector.split(",").some((part) => matchesCompound(this, part.trim()));
  }
  closest(selector: string): Fake | null {
    for (let current: Fake | undefined = this; current; current = current.parent) {
      if (current.matches(selector)) return current;
    }
    return null;
  }
  getClientRects(): Array<{ width: number; height: number }> {
    return "hidden" in this.attrs ? [] : [{ width: 10, height: 10 }];
  }
  getBoundingClientRect(): { x: number; y: number; width: number; height: number } {
    return "hidden" in this.attrs ? { x: 0, y: 0, width: 0, height: 0 } : { x: 0, y: 0, width: 10, height: 10 };
  }
  focus(): void {}
  dispatchEvent(event: Event): boolean {
    this.events.push(event.type);
    if (event.type === "click") this.onClick?.();
    return true;
  }
}

const COMPOUND = /^([a-z][a-z0-9-]*)?((?:\[[^\]]+\])*)$/iu;
const ATTRIBUTE = /\[([a-z-]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\]]*)))?\]/giu;

function matchesCompound(element: Fake, compound: string): boolean {
  const parsed = COMPOUND.exec(compound);
  if (!parsed || compound.length === 0) return false;
  if (parsed[1] && parsed[1].toLowerCase() !== element.tag) return false;
  const tests = [...(parsed[2] ?? "").matchAll(ATTRIBUTE)];
  // An attribute test in any other form (`*=`, a flag) is not understood here, so it matches nothing.
  if (tests.map((test) => test[0]).join("") !== (parsed[2] ?? "")) return false;
  for (const test of tests) {
    const name = test[1]!;
    if (!(name in element.attrs)) return false;
    const wanted = test[2] ?? test[3] ?? test[4];
    if (wanted !== undefined && element.attrs[name] !== wanted) return false;
  }
  return true;
}

/** One element: its tag, attributes, and children -- elements, or strings for text. */
export function h(tag: string, attrs: Record<string, string> = {}, children: Child[] | string = []): FakeElement {
  const element = new Fake(tag, attrs);
  for (const child of typeof children === "string" ? [children] : children) {
    if (typeof child === "string") element.nodes.push({ nodeType: TEXT_NODE, textContent: child });
    else {
      (child as unknown as Fake).parent = element;
      element.nodes.push(child as unknown as Fake);
    }
  }
  return element as unknown as FakeElement;
}

/** Wires a press on `control` to remove `layer` from its parent, as a page's own handler would. */
export function closesOnPress(control: FakeElement, layer: FakeElement): void {
  (control as unknown as Fake).onClick = () => {
    const fake = layer as unknown as Fake;
    const parent = fake.parent;
    if (!parent) return;
    parent.nodes.splice(parent.nodes.indexOf(fake), 1);
    fake.parent = undefined;
  };
}

/**
 * Installs a document whose body is `body`, and the two constructors the press
 * and the challenge reader name, for the duration of `run`; restores what was
 * there after. Node has `Event` but neither `MouseEvent` nor `HTMLElement`.
 */
export function withPage<T>(body: FakeElement, run: () => T): T {
  const globals = globalThis as Record<string, unknown>;
  const saved = { document: globals.document, MouseEvent: globals.MouseEvent, HTMLElement: globals.HTMLElement };
  globals.document = {
    querySelectorAll: (selector: string) => [body, ...(body as unknown as Fake).descendants()].filter((element) => (element as unknown as Fake).matches(selector)),
    location: { href: PAGE_HREF }
  };
  globals.MouseEvent = class extends Event {};
  globals.HTMLElement = class {};
  try {
    return run();
  } finally {
    for (const [name, value] of Object.entries(saved)) {
      if (value === undefined) delete globals[name];
      else globals[name] = value;
    }
  }
}
