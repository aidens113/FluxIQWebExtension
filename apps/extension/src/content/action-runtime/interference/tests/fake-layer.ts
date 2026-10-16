// The least DOM the interference clearing reads, for Node: elements with a tag,
// attributes, parents, children and text, `closest`/`matches`/`querySelectorAll`
// over simple selectors, painted boxes, and presses that record themselves.
//
// Selectors are matched only in the forms the clearing's own constants use --
// a tag, attribute tests (`[a]`, `[a="v"]`), the two together, and comma lists.
// Anything else (descendant combinators, pseudo-classes) matches nothing, as a
// selector the page no longer satisfies would: that is the case the step-target
// rows need, and it keeps the challenge classifier's selectors inert here.
//
// Three more things a page has, for the rows that ask what lies over the
// viewport (t656): an open shadow root (`attachShadow`), a position and a box
// (`place`), and a hit test (`withPage`'s `view`). `hidden` on an element hides
// everything inside it, and a removed element is neither connected nor painted,
// as in a browser.

export type FakeElement = Element & {
  /** Every event type dispatched on this element, in order. */
  readonly events: string[];
  /** Whether a `click` reached it. */
  readonly pressed: boolean;
};

type Child = FakeElement | string;
type Box = { x: number; y: number; width: number; height: number };

const TEXT_NODE = 3;
const PAGE_HREF = "http://127.0.0.1:4000/scenarios/social-network-feed/friends/requests/";
const DEFAULT_BOX: Box = Object.freeze({ x: 0, y: 0, width: 10, height: 10 });
const NO_BOX: Box = Object.freeze({ x: 0, y: 0, width: 0, height: 0 });

/** The one document every fake element belongs to; `withPage` gives its view a `getComputedStyle`. */
const FAKE_DOCUMENT: { location: { href: string }; defaultView: Record<string, unknown> } = { location: { href: PAGE_HREF }, defaultView: {} };

class Fake {
  parent: Fake | undefined;
  /** The shadow root this element sits at the top of, when it does. */
  rootParent: FakeShadowRoot | undefined;
  shadowRoot: FakeShadowRoot | null = null;
  removed = false;
  position = "static";
  box: Box = DEFAULT_BOX;
  readonly nodes: Array<Fake | { nodeType: 3; textContent: string }> = [];
  readonly events: string[] = [];
  onClick: (() => void) | undefined;
  readonly nodeType = 1;

  constructor(readonly tag: string, readonly attrs: Record<string, string>) {}

  get ownerDocument(): typeof FAKE_DOCUMENT {
    return FAKE_DOCUMENT;
  }
  get tagName(): string {
    return this.tag.toUpperCase();
  }
  get localName(): string {
    return this.tag;
  }
  get parentElement(): Fake | null {
    return this.parent ?? null;
  }
  get parentNode(): Fake | FakeShadowRoot | null {
    return this.parent ?? this.rootParent ?? null;
  }
  /** Its parent in the painted tree: the parent element, or the host of the root it tops. */
  get composedParent(): Fake | undefined {
    return this.parent ?? this.rootParent?.host;
  }
  get isConnected(): boolean {
    for (let current: Fake | undefined = this; current; current = current.composedParent) {
      if (current.removed) return false;
    }
    return true;
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
  get previousElementSibling(): Fake | null {
    const siblings = this.parent?.children ?? this.rootParent?.nodes ?? [];
    return siblings[siblings.indexOf(this) - 1] ?? null;
  }
  get nextElementSibling(): Fake | null {
    const siblings = this.parent?.children ?? this.rootParent?.nodes ?? [];
    const index = siblings.indexOf(this);
    return index < 0 ? null : siblings[index + 1] ?? null;
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
  getRootNode(): FakeShadowRoot | typeof FAKE_DOCUMENT {
    let top: Fake = this;
    while (top.parent) top = top.parent;
    return top.rootParent ?? FAKE_DOCUMENT;
  }
  getAttribute(name: string): string | null {
    return this.attrs[name] ?? null;
  }
  hasAttribute(name: string): boolean {
    return name in this.attrs;
  }
  setAttribute(name: string, value: string): void {
    this.attrs[name] = value;
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
  /** Painted: connected, and neither it nor anything around it is `hidden`. */
  painted(): boolean {
    for (let current: Fake | undefined = this; current; current = current.composedParent) {
      if (current.removed || "hidden" in current.attrs) return false;
    }
    return true;
  }
  getClientRects(): Array<{ width: number; height: number }> {
    return this.painted() ? [{ width: this.box.width, height: this.box.height }] : [];
  }
  getBoundingClientRect(): Box {
    return this.painted() ? { ...this.box } : { ...NO_BOX };
  }
  focus(): void {}
  dispatchEvent(event: Event): boolean {
    this.events.push(event.type);
    if (event.type === "click") this.onClick?.();
    return true;
  }
}

/** An open shadow root: a fragment with a host, which the composed walks cross. */
class FakeShadowRoot {
  readonly nodeType = 11;
  readonly nodes: Fake[] = [];
  readonly parentNode = null;

  constructor(readonly host: Fake) {}

  get children(): Fake[] {
    return this.nodes;
  }
  get childNodes(): Fake[] {
    return this.nodes;
  }
  get textContent(): string {
    return this.nodes.map((node) => node.textContent).join("");
  }
  querySelectorAll(selector: string): Fake[] {
    return this.nodes.flatMap((node) => [node, ...node.descendants()]).filter((element) => element.matches(selector));
  }
  querySelector(selector: string): Fake | null {
    return this.querySelectorAll(selector)[0] ?? null;
  }
  getElementById(id: string): Fake | null {
    return this.querySelectorAll("*").find((element) => element.attrs.id === id) ?? null;
  }
  /** A hit test answers with the deepest element itself (`withPage`), so the root is never asked to descend. */
  elementFromPoint(): null {
    return null;
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

/** Gives `host` an open shadow root holding `children`, as a widget's custom element draws its content. */
export function attachShadow(host: FakeElement, children: FakeElement[]): void {
  const fake = host as unknown as Fake;
  const root = new FakeShadowRoot(fake);
  for (const child of children as unknown as Fake[]) {
    child.rootParent = root;
    root.nodes.push(child);
  }
  fake.shadowRoot = root;
}

/** Sets the element's computed `position` and its box in the viewport. */
export function place(element: FakeElement, placement: { position?: string; box?: Box }): FakeElement {
  const fake = element as unknown as Fake;
  if (placement.position) fake.position = placement.position;
  if (placement.box) fake.box = placement.box;
  return element;
}

/** Wires a press on `control` to remove `layer` from its parent, as a page's own handler would. */
export function closesOnPress(control: FakeElement, layer: FakeElement): void {
  onPress(control, () => {
    const fake = layer as unknown as Fake;
    const parent = fake.parent;
    if (!parent) return;
    parent.nodes.splice(parent.nodes.indexOf(fake), 1);
    fake.parent = undefined;
    fake.removed = true;
  });
}

/** Shows a hidden element, or hides a shown one, as a disclosure widget's handler does. */
export function toggleHidden(element: FakeElement): void {
  const attrs = (element as unknown as Fake).attrs;
  if ("hidden" in attrs) delete attrs.hidden;
  else attrs.hidden = "";
}

/** Runs `run` when a click reaches `control`. */
export function onPress(control: FakeElement, run: () => void): void {
  (control as unknown as Fake).onClick = run;
}

/** A viewport and the hit test over it: what `elementFromPoint` answers at each point. */
export type FakeView = { width: number; height: number; hitAt: (x: number, y: number) => FakeElement | null };

/**
 * A 1280 by 720 view whose hit test answers the first of `zones` -- listed
 * topmost first -- that is painted and whose box holds the point, and `floor`
 * where none does: the page itself.
 */
export function zonedView(zones: readonly FakeElement[], floor: FakeElement): FakeView {
  return {
    width: 1280,
    height: 720,
    hitAt: (x, y) => zones.find((zone) => {
      const box = zone.getBoundingClientRect();
      return box.width > 0 && x >= box.x && x < box.x + box.width && y >= box.y && y < box.y + box.height;
    }) ?? floor
  };
}

/**
 * Installs a document whose body is `body`, and the two constructors the press
 * and the challenge reader name, for the duration of `run`; restores what was
 * there after, once a returned promise settles. Node has `Event` but neither
 * `MouseEvent` nor `HTMLElement`.
 *
 * With `view`, a `window` of that size is installed too -- one that is not the
 * top frame, so a press is not described -- and the document hit-tests by
 * `view.hitAt`, so the viewport probes (`../probe-points.ts`) find what it
 * answers. Without one there is no `window`, and only declared modals are seen.
 */
export function withPage<T>(body: FakeElement, run: () => T, view?: FakeView): T {
  const globals = globalThis as Record<string, unknown>;
  const saved = {
    document: globals.document,
    window: globals.window,
    MouseEvent: globals.MouseEvent,
    HTMLElement: globals.HTMLElement,
    HTMLInputElement: globals.HTMLInputElement,
    HTMLSelectElement: globals.HTMLSelectElement,
    HTMLTextAreaElement: globals.HTMLTextAreaElement
  };
  const savedStyle = FAKE_DOCUMENT.defaultView.getComputedStyle;
  const all = (): Fake[] => [body as unknown as Fake, ...(body as unknown as Fake).descendants()];
  globals.document = {
    querySelectorAll: (selector: string) => all().filter((element) => element.matches(selector)),
    // The accessible name reads `aria-labelledby` through it (`identity/accessible-name.ts`).
    getElementById: (id: string) => all().find((element) => element.attrs.id === id) ?? null,
    elementFromPoint: (x: number, y: number) => view?.hitAt(x, y) ?? null,
    location: { href: PAGE_HREF }
  };
  if (view) globals.window = { innerWidth: view.width, innerHeight: view.height, top: {} };
  FAKE_DOCUMENT.defaultView.getComputedStyle = (element: Fake) => ({ position: element.position });
  globals.MouseEvent = class extends Event {};
  globals.HTMLElement = class {};
  // Named by the accessible-name and sensitivity rules; no fake element is one of them.
  globals.HTMLInputElement = class {};
  globals.HTMLSelectElement = class {};
  globals.HTMLTextAreaElement = class {};
  const restore = (): void => {
    FAKE_DOCUMENT.defaultView.getComputedStyle = savedStyle;
    for (const [name, value] of Object.entries(saved)) {
      if (value === undefined) delete globals[name];
      else globals[name] = value;
    }
  };
  let result: T;
  try {
    result = run();
  } catch (error) {
    restore();
    throw error;
  }
  if (isThenable(result)) return Promise.resolve(result).finally(restore) as T;
  restore();
  return result;
}

function isThenable(value: unknown): value is PromiseLike<unknown> {
  return typeof value === "object" && value !== null && typeof (value as { then?: unknown }).then === "function";
}
