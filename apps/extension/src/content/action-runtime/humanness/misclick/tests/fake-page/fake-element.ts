// Part of the page the misclick tests build by hand (`../misclick.test.ts`,
// `actions/tests/click/tests/misclick.test.ts`). Node has no DOM, so only what
// the misclick and the click verb read is faked; see `index.ts`.

import type { FakePage } from "./fake-page";
import { matchesFakeSelector } from "./selector-match";
import type { Box, FakeDocument, FakeElementInit, Style } from "./types";

export class FakeElement {
  readonly nodeType = 1;
  readonly shadowRoot = null;
  readonly children: FakeElement[] = [];
  parentElement: FakeElement | null = null;
  isConnected = true;
  onclick: (() => void) | null = null;
  readonly attributes: Map<string, string>;
  box: Box | undefined;
  readonly style: Style;
  readonly text: string;
  readonly popoverOpen: boolean;

  constructor(readonly page: FakePage, readonly tag: string, readonly name: string, init: FakeElementInit = {}) {
    this.attributes = new Map(Object.entries(init.attributes ?? {}));
    this.box = init.box;
    this.style = init.style ?? {};
    this.text = init.text ?? "";
    this.popoverOpen = init.popoverOpen ?? false;
    if (init.onclick) this.onclick = init.onclick;
  }

  get parentNode(): FakeElement | null {
    return this.parentElement;
  }
  get ownerDocument(): FakeDocument {
    return this.page.document;
  }
  get tagName(): string {
    return this.tag.toUpperCase();
  }
  get textContent(): string {
    return [this.text, ...this.children.map((child) => child.textContent)].filter(Boolean).join(" ");
  }
  getRootNode(): FakeDocument {
    return this.page.document;
  }
  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }
  hasAttribute(name: string): boolean {
    return this.attributes.has(name);
  }
  getAttributeNames(): string[] {
    return [...this.attributes.keys()];
  }
  getBoundingClientRect(): DOMRect {
    const { left, top, right, bottom } = this.box ?? { left: 0, top: 0, right: 0, bottom: 0 };
    return { left, top, right, bottom, x: left, y: top, width: right - left, height: bottom - top } as DOMRect;
  }
  getClientRects(): DOMRect[] {
    return this.box && this.style.visibility !== "hidden" ? [this.getBoundingClientRect()] : [];
  }
  holds(x: number, y: number): boolean {
    return Boolean(this.box) && x >= this.box!.left && x < this.box!.right && y >= this.box!.top && y < this.box!.bottom;
  }
  append(...children: FakeElement[]): this {
    for (const child of children) {
      child.parentElement = this;
      this.children.push(child);
    }
    return this;
  }
  descendants(): FakeElement[] {
    return this.children.flatMap((child) => [child, ...child.descendants()]);
  }
  matches(selector: string): boolean {
    return selector.split(",").some((part) => matchesFakeSelector(this, part.trim()));
  }
  closest(selector: string): FakeElement | null {
    for (let current: FakeElement | null = this; current; current = current.parentElement) {
      if (current.matches(selector)) return current;
    }
    return null;
  }
  querySelectorAll(selector: string): FakeElement[] {
    return this.descendants().filter((element) => element.matches(selector));
  }
  focus(): void {}
  dispatchEvent(event: { type: string; init?: { clientX?: number; clientY?: number } }): boolean {
    this.page.events.push({ type: event.type, on: this.name, x: event.init?.clientX ?? Number.NaN, y: event.init?.clientY ?? Number.NaN });
    if (event.type === "click") this.page.onClick?.(this);
    return true;
  }
}
