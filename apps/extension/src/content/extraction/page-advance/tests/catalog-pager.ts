// A library catalog's search results, narrowed by format and language, for the
// tests of a Next whose address drops the list's narrowing (`../dropped-state.ts`,
// `../follow-next.ts`). Not one of the Lab's scenarios: a different kind of site
// with the same structure as the defect -- the narrowing lives in the address's
// query, and the pager's controls may or may not carry it.
//
// The document is `catalogPage`'s: a results list (`li[data-hit]`), then a pager
// of Previous, the page numbers (the current one a `span` marked
// `aria-current`) and Next (`a[rel="next"]`). How the pager draws its links is
// chosen per test:
// - `next: "keeps"` -- Next carries every parameter of the page, as most
//   sites' do; `"drops"` -- Next carries only the search term and the page,
//   so it leads to the unnarrowed catalog;
// - `numbers: "keep"` -- the page numbers carry every parameter; `"drop"` --
//   they too carry only the term; `"none"` -- the pager draws no numbers.
// - `shown: "applied"` (the default) -- a filter rail beside the list shows
//   the narrowing applied, as a checked format checkbox and a selected
//   language option; `"nothing"` -- the address narrows the list and nothing
//   on the page shows it;
// - `arrivedWith` -- a parameter the first page's address carries that no link
//   keeps and nothing on the page shows, as a tracking tag a page is opened
//   with.
// Pressing a link replaces the results and the pager with those of the address
// it leads to, and the document's address becomes it, as a new document's does.

import { FakeElement } from "../../tests/store-pager";

const ORIGIN = "http://library.test";
/** The search the catalog shows, narrowed to e-books in English. */
const TERM = "gardening";
const NARROWING = "format=ebook&lang=en";
/** How many pages the narrowed search has, and the unnarrowed one. */
const NARROWED_PAGES = 3;

/** What each result of the list answers to. */
export const CATALOG_HIT = "li[data-hit]";
/** The Next a `next` way names on the catalog's pager. */
export const CATALOG_NEXT = 'a[rel="next"]';

export type CatalogPagerStyle = { next: "keeps" | "drops"; numbers: "keep" | "drop" | "none"; shown?: "applied" | "nothing"; arrivedWith?: string };

/** The address of page `page` of the search, narrowed or not; page one carries no page number. */
export function catalogAddress(page: number, narrowed: boolean): string {
  const query = [`term=${TERM}`, ...(narrowed ? [NARROWING] : []), ...(page > 1 ? [`p=${page}`] : [])].join("&");
  return `/catalog?${query}`;
}

export type CatalogPage = {
  /** Every address a pressed link led to, in order. */
  followed: string[];
  /** The document's address now. */
  url(): string;
  restore(): void;
};

/**
 * Stands page `page` of the narrowed search up as the document, until
 * `restore`; `style` is how its pager draws its links (see the header).
 */
export function catalogPage(page: number, style: CatalogPagerStyle): CatalogPage {
  const saved = {
    document: (globalThis as Record<string, unknown>).document,
    window: (globalThis as Record<string, unknown>).window,
    element: (globalThis as Record<string, unknown>).HTMLElement,
    input: (globalThis as Record<string, unknown>).HTMLInputElement
  };
  const followed: string[] = [];
  let href = `${catalogAddress(page, true)}${style.arrivedWith === undefined ? "" : `&${style.arrivedWith}`}`;
  const results = new FakeElement("ol", { role: "list" });
  const rail = new FakeElement("form", { role: "search" });
  const column = new FakeElement("div", {}, "", [results]);
  let nav: FakeElement | undefined;
  const draw = (): void => {
    const url = new URL(href, ORIGIN);
    const shown = Number(url.searchParams.get("p") ?? "1");
    const narrowed = url.searchParams.get("format") !== null;
    results.replaceChildren(...hitsOf(shown, narrowed));
    rail.replaceChildren(...railOf(narrowed && style.shown !== "nothing"));
    const redrawn = pagerOf(shown, narrowed, style, (target) => {
      followed.push(target);
      href = target;
      draw();
    });
    if (nav) nav.replaceWith(redrawn);
    else column.append(redrawn);
    nav = redrawn;
  };
  draw();
  const body = new FakeElement("body", {}, "", [new FakeElement("main", {}, "", [rail, column])]);

  (globalThis as Record<string, unknown>).HTMLElement = FakeElement;
  (globalThis as Record<string, unknown>).HTMLInputElement = class {};
  (globalThis as Record<string, unknown>).window = { addEventListener: () => {}, removeEventListener: () => {} };
  (globalThis as Record<string, unknown>).document = {
    readyState: "complete",
    get URL(): string {
      return `${ORIGIN}${href}`;
    },
    querySelector: (selector: string) => body.querySelector(selector),
    querySelectorAll: (selector: string) => body.querySelectorAll(selector)
  };
  return {
    followed,
    url: () => `${ORIGIN}${href}`,
    restore: () => {
      for (const [name, value] of Object.entries({ document: saved.document, window: saved.window, HTMLElement: saved.element, HTMLInputElement: saved.input })) {
        (globalThis as Record<string, unknown>)[name] = value;
      }
    }
  };
}

/** Four results of a page; an unnarrowed page's are other titles, as a wider search's are. */
function hitsOf(page: number, narrowed: boolean): FakeElement[] {
  return Array.from({ length: 4 }, (_, index) => new FakeElement("li", { "data-hit": `${narrowed ? "n" : "all"}-${page}-${index + 1}` }, "", [
    new FakeElement("a", { href: `/record/${narrowed ? "n" : "all"}${page}${index + 1}` }, `${narrowed ? "E-book" : "Any format"} ${page}.${index + 1}`)
  ]));
}

/**
 * The filter rail: a checkbox for each format and a language select, the
 * narrowing's own choices checked and selected when `applied`, none otherwise.
 */
function railOf(applied: boolean): FakeElement[] {
  const on = (yes: boolean, attribute: string): Record<string, string> => (yes ? { [attribute]: "" } : {});
  return [
    new FakeElement("input", { type: "checkbox", name: "format", value: "ebook", ...on(applied, "checked") }),
    new FakeElement("input", { type: "checkbox", name: "format", value: "audiobook" }),
    new FakeElement("input", { type: "search", name: "term", value: TERM }),
    new FakeElement("select", { name: "lang" }, "", [
      new FakeElement("option", { value: "", ...on(!applied, "selected") }, "Any language"),
      new FakeElement("option", { value: "en", ...on(applied, "selected") }, "English"),
      new FakeElement("option", { value: "fr" }, "French")
    ])
  ];
}

function link(target: string, attributes: Record<string, string>, text: string, follow: (target: string) => void): FakeElement {
  const element = new FakeElement("a", { href: target, ...attributes }, text);
  element.onClick = () => follow(target);
  return element;
}

/** The pager of page `page`; `follow` is what pressing one of its links does. */
function pagerOf(page: number, narrowed: boolean, style: CatalogPagerStyle, follow: (target: string) => void): FakeElement {
  const pages = NARROWED_PAGES;
  const controls: FakeElement[] = [];
  if (page > 1) controls.push(link(catalogAddress(page - 1, narrowed), { "aria-label": "Previous page" }, "Previous", follow));
  if (style.numbers !== "none") {
    for (let number = 1; number <= pages; number += 1) {
      controls.push(number === page
        ? new FakeElement("span", { "aria-current": "page" }, String(number))
        : link(catalogAddress(number, narrowed && style.numbers === "keep"), {}, String(number), follow));
    }
  }
  controls.push(page < pages
    ? link(catalogAddress(page + 1, narrowed && style.next === "keeps"), { rel: "next", "aria-label": "Next page" }, "Next", follow)
    : new FakeElement("span", { "aria-disabled": "true" }, "Next"));
  return new FakeElement("nav", { "aria-label": "Results pages" }, "", controls);
}
