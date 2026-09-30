// The least DOM the overlay surface touches, for Node: elements that keep
// their styles, attributes, children and text, a closed shadow root, and
// Web Animations that record themselves. It counts every node ever created
// and every text write, which is what an in-place update is measured by.

class FakeAnimation {
  onfinish: (() => void) | null = null;
  playState: "running" | "paused" | "finished" | "idle" = "running";
  constructor(readonly keyframes: unknown, readonly options: unknown) {}
  pause(): void {
    this.playState = "paused";
  }
  play(): void {
    this.playState = "running";
  }
  cancel(): void {
    this.playState = "idle";
  }
  finish(): void {
    this.playState = "finished";
    this.onfinish?.();
  }
}

class FakeStyle {
  readonly values = new Map<string, string>();
  setProperty(name: string, value: string): void {
    this.values.set(name, value);
  }
  getPropertyValue(name: string): string {
    return this.values.get(name) ?? "";
  }
}

export class FakeNode {
  parent: FakeNode | undefined;
  readonly children: FakeNode[] = [];
  readonly style = new FakeStyle();
  readonly attributes = new Map<string, string>();
  readonly animations: FakeAnimation[] = [];
  shadow: FakeNode | undefined;
  textWrites = 0;
  private text = "";

  constructor(readonly dom: FakeDom, readonly tagName: string) {
    dom.created += 1;
  }

  get textContent(): string {
    return this.text + this.children.map((child) => child.textContent).join("");
  }

  set textContent(value: string) {
    this.textWrites += 1;
    this.dom.textWrites += 1;
    this.text = value;
  }

  get isConnected(): boolean {
    for (let node: FakeNode | undefined = this; node; node = node.parent) if (node === this.dom.documentElement) return true;
    return false;
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  hasAttribute(name: string): boolean {
    return this.attributes.has(name);
  }

  append(...nodes: FakeNode[]): void {
    for (const node of nodes) {
      node.parent?.children.splice(node.parent.children.indexOf(node), 1);
      node.parent = this;
      this.children.push(node);
    }
  }

  remove(): void {
    if (!this.parent) return;
    this.parent.children.splice(this.parent.children.indexOf(this), 1);
    this.parent = undefined;
  }

  attachShadow(init: { mode: string }): FakeNode {
    if (this.shadow) throw new Error("already a shadow host");
    const root = new FakeNode(this.dom, `#shadow-root(${init.mode})`);
    root.parent = this;
    this.shadow = root;
    return root;
  }

  animate(keyframes: unknown, options: unknown): FakeAnimation {
    const animation = new FakeAnimation(keyframes, options);
    this.animations.push(animation);
    return animation;
  }

  /** Every node beneath this one, shadow roots included. */
  descendants(): FakeNode[] {
    const found: FakeNode[] = [];
    const visit = (node: FakeNode) => {
      for (const child of [...(node.shadow ? [node.shadow] : []), ...node.children]) {
        found.push(child);
        visit(child);
      }
    };
    visit(this);
    return found;
  }
}

class FakeDom {
  created = 0;
  textWrites = 0;
  readonly documentElement: FakeNode;

  constructor() {
    this.documentElement = new FakeNode(this, "html");
  }

  createElement(tag: string): FakeNode {
    return new FakeNode(this, tag);
  }

  createElementNS(_namespace: string, tag: string): FakeNode {
    return new FakeNode(this, tag);
  }

  querySelectorAll(selector: string): FakeNode[] {
    const attribute = /^\[([a-z-]+)\]$/u.exec(selector)?.[1];
    if (!attribute) throw new Error(`fake DOM: unsupported selector ${selector}`);
    return [this.documentElement, ...this.documentElement.descendants()].filter((node) => node.hasAttribute(attribute));
  }
}

/** The fake document `withFakeDom` installs. */
export type FakeDocument = FakeDom;

/** Installs `dom` as the global document for the duration of `run`. */
export function withFakeDom<T>(run: (dom: FakeDom) => T): T {
  const globals = globalThis as unknown as Record<string, unknown>;
  const saved = { document: globals["document"], matchMedia: globals["matchMedia"] };
  const dom = new FakeDom();
  globals["document"] = dom;
  globals["matchMedia"] = () => ({ matches: false });
  try {
    return run(dom);
  } finally {
    globals["document"] = saved.document;
    globals["matchMedia"] = saved.matchMedia;
  }
}
