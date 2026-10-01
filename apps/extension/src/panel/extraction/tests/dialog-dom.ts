// Local modal DOM model. It models focus/removal/inertness, not browser layout.
import { FakeElement } from "../../chat/tests/fake-dom";

type FakeNode = Parameters<FakeElement["removeChild"]>[0];
type Listener = (event: Event) => void;
class DialogElement extends FakeElement {
  readonly classList = { add: (name: string) => { this.className = [...new Set([...this.className.split(/\s+/u).filter(Boolean), name])].join(" "); } };
  inert = false;
  type = "";
  checked = false;
  name = "";
  selected = false;
  selectionStart: number | null = 0;
  selectionEnd: number | null = 0;
  selectionDirection: "forward" | "backward" | "none" = "none";
  // Its own document, through a getter: `FakeElement` reads its owner off the
  // installed fake document through one (`cfecc984`), so a parameter property
  // would assign to that getter and throw, and a property may not override it.
  private readonly owner: DialogDocument;
  constructor(tag: string, ownerDocument: DialogDocument) {
    super(tag);
    this.owner = ownerDocument;
  }
  get ownerDocument(): DialogDocument { return this.owner; }
  get parentElement(): DialogElement | null { return this.parentNode as DialogElement | null; }
  get nextSibling(): FakeNode | null {
    const nodes = this.parentNode?.childNodes ?? [];
    return nodes[nodes.indexOf(this) + 1] ?? null;
  }
  override get isConnected(): boolean {
    return this === this.ownerDocument.body || this.parentElement?.isConnected === true;
  }
  get tabIndex(): number {
    const specified = this.getAttribute("tabindex");
    return specified === null ? (["BUTTON", "INPUT", "SELECT", "TEXTAREA"].includes(this.tagName) || this.getAttribute("href") !== null ? 0 : -1) : Number(specified);
  }
  set tabIndex(value: number) { this.setAttribute("tabindex", String(value)); }
  override setAttribute(name: string, value: string): void {
    super.setAttribute(name, value);
    if (name === "type") this.type = value;
  }
  contains(node: unknown): boolean { return node === this || this.descendants().includes(node as FakeElement); }
  matches(selector: string): boolean {
    const tag = selector.match(/^[a-z]+/iu)?.[0];
    if (tag && this.tagName !== tag.toUpperCase()) return false;
    for (const match of selector.matchAll(/\.([\w-]+)/gu)) if (!this.className.split(/\s+/u).includes(match[1]!)) return false;
    for (const match of selector.matchAll(/\[([\w-]+)(?:="([^"]*)")?\]/gu)) {
      const actual = match[1] === "hidden" ? (this.hidden ? "" : null)
        : match[1] === "inert" ? (this.inert ? "" : null)
          : match[1] === "data-field" ? this.dataset.field ?? null : this.getAttribute(match[1]!);
      if (actual === null || (match[2] !== undefined && actual !== match[2])) return false;
    }
    return true;
  }
  closest(selector: string): DialogElement | null {
    return selector.split(",").some((part) => this.matches(part.trim())) ? this : this.parentElement?.closest(selector) ?? null;
  }
  querySelectorAll(selector: string): DialogElement[] {
    return this.descendants().filter((element): element is DialogElement => element instanceof DialogElement && selector.split(",").some((part) => element.matches(part.trim())));
  }
  querySelector(selector: string): DialogElement | null { return this.querySelectorAll(selector)[0] ?? null; }
  getClientRects(): unknown[] { return this.isConnected && this.closest("[hidden]") === null ? [{}] : []; }
  override focus(options?: FocusOptions): void {
    if (!this.isConnected || this.disabled || this.closest("[hidden], [inert]")) return;
    this.ownerDocument.activeElement = this;
    this.ownerDocument.focusCalls.push({ element: this, options });
    this.ownerDocument.emit("focusin", { target: this });
  }
  setSelectionRange(start: number, end: number, direction: "forward" | "backward" | "none" = "none"): void {
    this.selectionStart = start; this.selectionEnd = end; this.selectionDirection = direction;
  }
  override removeChild(node: FakeNode): void {
    if (node === this.ownerDocument.activeElement || (node instanceof DialogElement && node.contains(this.ownerDocument.activeElement))) this.ownerDocument.activeElement = this.ownerDocument.body;
    super.removeChild(node);
    if (this === this.ownerDocument.body) this.ownerDocument.notify();
  }
  override insertBefore<T extends FakeNode>(node: T, reference: FakeNode | null): T {
    const result = super.insertBefore(node, reference);
    if (this === this.ownerDocument.body) this.ownerDocument.notify();
    return result;
  }
}
class DialogDocument {
  readonly body = new DialogElement("body", this);
  activeElement = this.body;
  focused = true;
  visibilityState = "visible";
  readonly focusCalls: { element: DialogElement; options?: FocusOptions | undefined }[] = [];
  readonly listeners = new Map<string, Listener[]>();
  readonly observers = new Set<() => void>();
  createElement(tag: string): DialogElement { return new DialogElement(tag, this); }
  hasFocus(): boolean { return this.focused; }
  querySelector(selector: string): DialogElement | null { return this.body.querySelector(selector); }
  addEventListener(type: string, listener: Listener): void { this.listeners.set(type, [...this.listeners.get(type) ?? [], listener]); }
  removeEventListener(type: string, listener: Listener): void { this.listeners.set(type, (this.listeners.get(type) ?? []).filter((held) => held !== listener)); }
  emit(type: string, fields: Record<string, unknown> = {}) {
    const event = { type, defaultPrevented: false, stopped: false, preventDefault() { this.defaultPrevented = true; }, stopPropagation() { this.stopped = true; }, ...fields };
    for (const listener of this.listeners.get(type) ?? []) { listener(event as unknown as Event); if (event.stopped) break; }
    return event;
  }
  notify(): void { for (const callback of this.observers) callback(); }
}
function makeWorld() {
  const doc = new DialogDocument();
  const host = doc.createElement("div");
  doc.body.append(host);
  const timers = new Map<number, () => void>();
  let timerId = 0;
  const world = {
    document: doc, host, timers,
    sent: [] as Record<string, unknown>[],
    reply: (message: Record<string, unknown>): unknown | Promise<unknown> => message.type === "fluxiq.extractionStart" ? { ok: true, sessionId: "s1", tabId: 11, form: "list" } : { ok: true },
    get(id: string): DialogElement { const found = doc.body.descendants().find((element) => element.id === id); if (!(found instanceof DialogElement)) throw new Error(`missing ${id}`); return found; },
    native: (element: DialogElement) => element as unknown as HTMLElement,
    flush: async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); },
    tick: async () => { for (const callback of [...timers.values()]) callback(); await world.flush(); },
    interval: (callback: () => void) => { const id = ++timerId; timers.set(id, callback); return id; },
    Observer: class {
      constructor(readonly callback: () => void) {}
      observe(): void { doc.observers.add(this.callback); }
      disconnect(): void { doc.observers.delete(this.callback); }
    }
  };
  return world;
}
export async function withDialogDom(body: (world: ReturnType<typeof makeWorld>) => void | Promise<void>): Promise<void> {
  const world = makeWorld();
  const keys = ["document", "MutationObserver", "chrome", "setInterval", "clearInterval"] as const;
  const target = globalThis as unknown as Record<string, unknown>;
  const prior = new Map(keys.map((key) => [key, Object.getOwnPropertyDescriptor(target, key)]));
  const runtime: { lastError: { message: string } | undefined; sendMessage(message: Record<string, unknown>, callback: (response: unknown) => void): void } = {
    lastError: undefined,
    sendMessage(message, callback) {
      world.sent.push(message);
      void Promise.resolve().then(() => world.reply(message)).then(callback, (error: unknown) => {
        runtime.lastError = { message: error instanceof Error ? error.message : String(error) };
        callback(undefined); runtime.lastError = undefined;
      });
    }
  };
  const values: Record<string, unknown> = { document: world.document, MutationObserver: world.Observer, chrome: { runtime }, setInterval: world.interval, clearInterval: (id: number) => world.timers.delete(id) };
  for (const key of keys) Object.defineProperty(target, key, { configurable: true, writable: true, value: values[key] });
  try { await body(world); } finally {
    world.timers.clear();
    for (const key of keys) { const descriptor = prior.get(key); if (descriptor) Object.defineProperty(target, key, descriptor); else delete target[key]; }
  }
}
