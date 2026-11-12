// Part of the page the misclick tests build by hand (`../misclick.test.ts`,
// `actions/tests/click/tests/misclick.test.ts`). Node has no DOM, so only what
// the misclick and the click verb read is faked; see `index.ts`.

import { FakeElement } from "./fake-element";
import type { FakeDocument, FakeElementInit, FakeEvent } from "./types";

/** A 1000 by 800 viewport whose body fills it; elements are painted in the order they are added, the last on top. */
export class FakePage {
  readonly events: FakeEvent[] = [];
  readonly hitTests: Array<{ x: number; y: number }> = [];
  readonly document: FakeDocument;
  /** Called when an element receives a click, for a page that answers one. */
  onClick: ((element: FakeElement) => void) | undefined;
  /** When set, every hit test throws: the page must not be read. */
  sealed = false;
  private readonly root: FakeElement;
  private readonly bodyElement: FakeElement;

  constructor() {
    this.root = new FakeElement(this, "html", "html", { box: { left: 0, top: 0, right: 1000, bottom: 800 } });
    this.bodyElement = new FakeElement(this, "body", "body", { box: { left: 0, top: 0, right: 1000, bottom: 800 } });
    this.root.append(this.bodyElement);
    const page = this;
    this.document = {
      documentElement: this.root,
      body: this.bodyElement,
      location: { href: "http://127.0.0.1:4000/scenarios/company-directory/" },
      defaultView: {
        innerWidth: 1000,
        innerHeight: 800,
        getComputedStyle: (element: FakeElement) => ({ cursor: "auto", position: "static", visibility: "visible", ...element.style })
      },
      elementFromPoint(x: number, y: number): FakeElement | null {
        if (page.sealed) throw new Error("the page was read");
        page.hitTests.push({ x, y });
        const painted = page.root.descendants().filter((element) => element.isConnected && element.getClientRects().length > 0 && element.holds(x, y));
        return painted.at(-1) ?? null;
      },
      querySelectorAll(selector: string): FakeElement[] {
        if (page.sealed) throw new Error("the page was read");
        return [page.root, ...page.root.descendants()].filter((element) => element.matches(selector));
      }
    };
  }

  get body(): FakeElement {
    return this.bodyElement;
  }

  /** A new element under `parent` (the body when none is named). */
  add(tag: string, name: string, init: FakeElementInit = {}, parent: FakeElement = this.bodyElement): FakeElement {
    const element = new FakeElement(this, tag, name, init);
    parent.append(element);
    return element;
  }

  /** The events one element received. */
  eventsOn(name: string): FakeEvent[] {
    return this.events.filter((event) => event.on === name);
  }
}
