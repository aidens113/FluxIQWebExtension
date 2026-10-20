// The page the click verb's tests fake (`actions/tests/click.test.ts`), at the
// three things the verb reads: the element's `closest`, its document's
// `location`, and what `dispatchEvent` answers. Moved out of `click.test.ts` on
// 2026-10-20, unchanged, so the click tests split by subject share one fake.

import type { TestContext } from "node:test";

export const PAGE = "http://127.0.0.1:4000/scenarios/company-directory/";
export const LINK_HREF = `${PAGE}?sector=logistics`;

/** What the page does when the click event reaches it. */
export type PageBehaviour = {
  /** The target is inside a link naming `LINK_HREF`; a button otherwise. */
  link: boolean;
  /** The page's handler cancels the click's default action. */
  prevent: boolean;
  /** The handler moves the address before the click event returns, as a hash link or a synchronous router push does. */
  moveTo?: string;
  /** The target is no command control -- a text box, a line of text -- so no selector but a link's finds it. */
  plain?: boolean;
};

export type FakePage = { element: Element; events: string[] };

/** The `MouseEvent` the verb constructs, which Node lacks; only its type is read here. */
export function installMouseEvent(t: TestContext): void {
  const global = globalThis as { MouseEvent?: unknown };
  const had = Object.prototype.hasOwnProperty.call(global, "MouseEvent");
  const previous = global.MouseEvent;
  global.MouseEvent = class {
    constructor(readonly type: string, readonly init: unknown) {}
  };
  t.after(() => {
    if (had) global.MouseEvent = previous;
    else delete global.MouseEvent;
  });
}

export function fakePage(behaviour: PageBehaviour): FakePage {
  const events: string[] = [];
  const location = { href: PAGE };
  const anchor = { href: LINK_HREF, protocol: "http:", focus: () => undefined };
  const target = {
    ownerDocument: { location, defaultView: {} },
    closest: (selector: string) => {
      if (selector === "a[href]") return behaviour.link ? anchor : null;
      return behaviour.plain ? null : target;
    },
    focus: () => undefined,
    dispatchEvent(event: { type: string }): boolean {
      events.push(event.type);
      if (event.type !== "click") return true;
      if (behaviour.moveTo !== undefined) location.href = behaviour.moveTo;
      return !behaviour.prevent;
    }
  };
  return { element: target as unknown as Element, events };
}
