// The least of a page `reveal-aim.ts` and `reveal-by-scroll.ts` read: elements
// laid out down a document, a viewport that scrolls over them, computed styles,
// and a scroll container that scrolls its own content. Geometry is in document
// coordinates and turned into viewport boxes by the page's scroll position, so
// a scroll moves every box exactly as a browser's would.

/** The computed styles the reveal reads, each with a browser's default. */
export type FakeStyle = { display: string; visibility: string; opacity: string; position: string; overflowY: string };

/** One element's place in the document, and what a scroll records. */
export type FakeNodeSpec = {
  tag?: string;
  top: number;
  height: number;
  style?: Partial<FakeStyle>;
  attributes?: Record<string, string>;
  /** Content height, for an element that scrolls its own content. */
  scrollHeight?: number;
};

/** The page: its viewport, how far it is scrolled, and every scroll made on it. */
export type FakePage = {
  scrollY: number;
  readonly innerWidth: number;
  readonly innerHeight: number;
  readonly scrolls: { tag: string; block: string }[];
  readonly document: { defaultView: FakePage; documentElement: FakeNode; body: FakeNode };
  readonly body: FakeNode;
  getComputedStyle(element: FakeNode): FakeStyle;
  /** The largest scroll position the page allows. */
  maxScrollY(): number;
};

/** A page `height` px tall on screen over a document `documentHeight` px long, scrolled to the top. */
export function fakePage(height = 800, documentHeight = 4000): FakePage {
  const page = {
    scrollY: 0,
    innerWidth: 1280,
    innerHeight: height,
    scrolls: [],
    getComputedStyle: (element: FakeNode) => element.style,
    maxScrollY: () => Math.max(0, page.document.body.height - height)
  } as unknown as { -readonly [K in keyof FakePage]: FakePage[K] };
  const html = new FakeNode(page, null, { tag: "html", top: 0, height: documentHeight });
  const body = new FakeNode(page, html, { tag: "body", top: 0, height: documentHeight });
  page.document = { defaultView: page, documentElement: html, body };
  page.body = body;
  return page;
}

export class FakeNode {
  readonly nodeType = 1;
  readonly tagName: string;
  readonly style: FakeStyle;
  readonly attributes: Map<string, string>;
  top: number;
  height: number;
  scrollTop = 0;
  readonly scrollLeft = 0;
  readonly scrollHeight: number;
  connected = true;

  constructor(readonly page: FakePage, readonly parentElement: FakeNode | null, spec: FakeNodeSpec) {
    this.tagName = (spec.tag ?? "div").toUpperCase();
    this.style = { display: "block", visibility: "visible", opacity: "1", position: "static", overflowY: "visible", ...spec.style };
    this.attributes = new Map(Object.entries(spec.attributes ?? {}));
    this.top = spec.top;
    this.height = spec.height;
    this.scrollHeight = spec.scrollHeight ?? spec.height;
  }

  get parentNode(): FakeNode | null {
    return this.parentElement;
  }
  get ownerDocument(): FakePage["document"] {
    return this.page.document;
  }
  get isConnected(): boolean {
    return this.connected;
  }
  get clientHeight(): number {
    return this.height;
  }

  /** A child laid out inside this element. */
  child(spec: FakeNodeSpec): FakeNode {
    return new FakeNode(this.page, this, spec);
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }
  hasAttribute(name: string): boolean {
    return this.attributes.has(name);
  }
  matches(selector: string): boolean {
    const attribute = /^\[([a-z-]+)\]$/u.exec(selector);
    return attribute ? this.hasAttribute(attribute[1]!) : false;
  }

  /** Whether this element or an ancestor is `display: none`, which takes its box away. */
  undisplayed(): boolean {
    for (let current: FakeNode | null = this; current; current = current.parentElement) {
      if (current.style.display === "none") return true;
    }
    return false;
  }

  /** The viewport box: document position less the page's scroll and every scrolling ancestor's own scroll. */
  getBoundingClientRect(): DOMRect {
    if (this.undisplayed() || this.height <= 0) return rect(0, 0, 0, 0);
    let offset = this.page.scrollY;
    for (let current = this.parentElement; current; current = current.parentElement) offset += current.scrollTop;
    return rect(0, this.top - offset, 200, this.height);
  }

  scrollIntoView(options: { block: "end" | "center" }): void {
    this.page.scrolls.push({ tag: this.tagName.toLowerCase(), block: options.block });
    const wanted = options.block === "end" ? this.top + this.height - this.page.innerHeight : this.top + this.height / 2 - this.page.innerHeight / 2;
    this.page.scrollY = Math.min(this.page.maxScrollY(), Math.max(0, wanted));
  }
}

function rect(left: number, top: number, width: number, height: number): DOMRect {
  return { left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) } as DOMRect;
}

/** A node as the reveal is handed it. */
export function element(node: FakeNode): Element {
  return node as unknown as Element;
}
