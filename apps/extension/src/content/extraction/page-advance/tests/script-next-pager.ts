// A lamp shop's search results, for the tests of a pager that says its current
// page only by a class (`../../pager-reading/current-page.ts`) and whose Next
// is a script's element that does nothing when pressed (`../follow-next.ts`).
// Not one of the Lab's scenarios: a different kind of site with the structure
// run-mvd0pbn9-bad36023 failed on.
//
// The document is `scriptNextPage`'s: a results list (`li[data-hit]`), then a
// pager of Previous (a link, or on page one a `div` with an extra "off"
// class), the page numbers 1..4 each an `a[href]` to its page, Next -- a
// `div`, never a link, whose press changes nothing, and on the last page the
// same `div` with only the "off" class added -- and a go-to-page box. How the
// current number is drawn is chosen per test:
// - `current: "class"` -- the current number carries one extra class, the
//   others share one class list; `"plain"` -- every number carries the same;
// - `arrival` -- the address the page was opened at, which may carry what no
//   pager link does (an empty parameter a search form submits, or a tag).
// Pressing a number replaces the results and the pager with that page's, and
// the document's address becomes the link's, as a new document's does.

import { FakeElement } from "../../tests/store-pager";

const ORIGIN = "http://lamps.test";
const PAGES = 4;

/** What each result of the list answers to. */
export const SCRIPT_NEXT_HIT = "li[data-hit]";
/** The selector a recorded step names the pager's Next by on a page that is not the last, and on the last. */
export const SCRIPT_NEXT = 'div[class="pg"]';
export const LAST_PAGE_NEXT = 'div[class="pg pg-off"]';

export type ScriptNextStyle = { current: "class" | "plain"; arrival?: string };

/** The address the pager's number `page` links to: page one carries no page number. */
export function scriptNextAddress(page: number): string {
  return page > 1 ? `/find?q=lamp&page=${page}` : "/find?q=lamp";
}

export type ScriptNextPage = {
  /** Every address a pressed number led to, in order. */
  followed: string[];
  /** How many times Next was pressed. */
  nextPresses(): number;
  url(): string;
  restore(): void;
};

/** Stands page `page` up as the document until `restore`; `style` is how its pager draws the current number (see the header). */
export function scriptNextPage(page: number, style: ScriptNextStyle): ScriptNextPage {
  const saved = ["document", "window", "HTMLElement", "HTMLInputElement"].map((name) => [name, (globalThis as Record<string, unknown>)[name]] as const);
  const followed: string[] = [];
  let presses = 0;
  let href = style.arrival ?? scriptNextAddress(page);
  const results = new FakeElement("ol", { role: "list" });
  const column = new FakeElement("div", {}, "", [results]);
  let pager: FakeElement | undefined;
  const draw = (): void => {
    const shown = Number(new URL(href, ORIGIN).searchParams.get("page") ?? "1");
    results.replaceChildren(...Array.from({ length: 4 }, (_, index) => new FakeElement("li", { "data-hit": `${shown}-${index + 1}` }, "", [
      new FakeElement("a", { href: `/lamp/${shown}${index + 1}` }, `Lamp ${shown}.${index + 1}`)
    ])));
    const redrawn = pagerOf(shown, style, () => {
      presses += 1;
    }, (target) => {
      followed.push(target);
      href = target;
      draw();
    });
    if (pager) pager.replaceWith(redrawn);
    else column.append(redrawn);
    pager = redrawn;
  };
  draw();
  const body = new FakeElement("body", {}, "", [new FakeElement("main", {}, "", [column])]);
  const globals = globalThis as Record<string, unknown>;
  globals.HTMLElement = FakeElement;
  globals.HTMLInputElement = class {};
  globals.window = { addEventListener: () => {}, removeEventListener: () => {} };
  globals.document = {
    readyState: "complete",
    get URL(): string {
      return `${ORIGIN}${href}`;
    },
    querySelector: (selector: string) => body.querySelector(selector),
    querySelectorAll: (selector: string) => body.querySelectorAll(selector)
  };
  return {
    followed,
    nextPresses: () => presses,
    url: () => `${ORIGIN}${href}`,
    restore: () => {
      for (const [name, value] of saved) globals[name] = value;
    }
  };
}

/** The pager of page `page`; `pressNext` is what pressing Next does (nothing to the list), `follow` what pressing a link does. */
function pagerOf(page: number, style: ScriptNextStyle, pressNext: () => void, follow: (target: string) => void): FakeElement {
  const link = (target: string, className: string, text: string): FakeElement => {
    const element = new FakeElement("a", { class: className, href: target }, text);
    element.onClick = () => follow(target);
    return element;
  };
  const previous = page > 1 ? link(scriptNextAddress(page - 1), "pg", "‹ Previous") : new FakeElement("div", { class: "pg pg-off" }, "‹ Previous");
  const numbers = Array.from({ length: PAGES }, (_, index) => index + 1)
    .map((number) => link(scriptNextAddress(number), number === page && style.current === "class" ? "pg pg-on" : "pg", String(number)));
  const next = new FakeElement("div", { class: page >= PAGES ? "pg pg-off" : "pg" }, "Next ›");
  next.onClick = pressNext;
  const jump = new FakeElement("span", { class: "pg-jump" }, "Go to page ", [new FakeElement("input", { class: "box" }), new FakeElement("span", { class: "btn" }, "Go")]);
  return new FakeElement("div", { class: "pager" }, "", [previous, ...numbers, next, jump]);
}
