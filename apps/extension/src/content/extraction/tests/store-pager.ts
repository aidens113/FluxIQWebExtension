// A results page shaped like the everything store's, as a `next` read sees it
// (`apps/scenario-lab/src/scenarios/everything-store/pages/results/`), for the
// tests of how that read finds its Next. Node has no document, so this is the
// least of one those tests need: elements with tags, attributes, text, parents
// and children; a `querySelector` that evaluates the child-combinator,
// `:nth-of-type` selectors a proposal's `selectorFor` writes, exactly; and
// clicks that turn the page.
//
// The tree is the store's, level for level: `main` holds the results bar and
// the layout; the layout a filter rail and a column; the column the results, a
// "frequently viewed" widget of links that are not results, and the pager. The
// pager is the store's own, page for page (`pagination.ts` there): Previous is
// text on page one and a link after it, the current page is text marked
// `aria-current`, the numbers shown move with the page, and page two's Next
// leads back to page two. So a positional selector names the same link here
// that it names on the store, which is the whole point.

/** An element, as much of one as the pager lookup, the label reader and the page advance ask for. */
export class FakeElement {
  readonly tagName: string;
  parentElement: FakeElement | null = null;
  children: FakeElement[] = [];
  isConnected = true;
  onClick: (() => void) | undefined;
  private readonly attributes: Map<string, string>;
  private readonly ownText: string;

  constructor(tag: string, attributes: Record<string, string> = {}, text = "", children: FakeElement[] = []) {
    this.tagName = tag.toUpperCase();
    this.attributes = new Map(Object.entries(attributes));
    this.ownText = text;
    for (const child of children) this.append(child);
  }

  append(child: FakeElement): void {
    child.parentElement = this;
    this.children.push(child);
  }

  replaceChildren(...children: FakeElement[]): void {
    for (const child of this.children) detach(child);
    this.children = [];
    for (const child of children) this.append(child);
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  get textContent(): string {
    return this.ownText + this.children.map((child) => child.textContent).join("");
  }

  get firstChild(): unknown {
    return this.children[0] ?? (this.ownText === "" ? null : {});
  }

  get baseURI(): string {
    return (globalThis as { document?: { URL?: string } }).document?.URL ?? STORE_ORIGIN;
  }

  get classList(): string[] {
    return [];
  }

  contains(other: FakeElement | null): boolean {
    for (let node = other; node; node = node.parentElement) if (node === this) return true;
    return false;
  }

  matches(selector: string): boolean {
    return selector.split(",").some((part) => part.trim() !== ":disabled" && simpleMatches(this, part.trim()));
  }

  closest(selector: string): FakeElement | null {
    for (let node: FakeElement | null = this; node; node = node.parentElement) if (node.matches(selector)) return node;
    return null;
  }

  querySelectorAll(selector: string): FakeElement[] {
    if (selector.includes(">")) return chainFrom(this, selector);
    return descendants(this).filter((element) => element.matches(selector));
  }

  querySelector(selector: string): FakeElement | null {
    return this.querySelectorAll(selector)[0] ?? null;
  }

  click(): void {
    this.onClick?.();
  }
}

function detach(element: FakeElement): void {
  element.isConnected = false;
  element.parentElement = null;
  for (const child of element.children) detach(child);
}

function descendants(root: FakeElement): FakeElement[] {
  return root.children.flatMap((child) => [child, ...descendants(child)]);
}

/** One compound of a simple selector: `*`, a tag, `[name]` or `[name="value"]`, or a tag with one of those. */
function simpleMatches(element: FakeElement, selector: string): boolean {
  const parsed = /^(\*|[a-z]+)?(?:\[([\w-]+)(?:="([^"]*)")?\])?$/u.exec(selector);
  if (!parsed) throw new Error(`The fake page does not read the selector ${JSON.stringify(selector)}.`);
  const [, tag, attribute, value] = parsed;
  if (tag !== undefined && tag !== "*" && element.tagName !== tag.toUpperCase()) return false;
  if (attribute === undefined) return true;
  const actual = element.getAttribute(attribute);
  return value === undefined ? actual !== null : actual === value;
}

/** A child-combinator chain -- `main > div:nth-of-type(2) > nav > a:nth-of-type(4)` -- whose first step is any descendant. */
function chainFrom(root: FakeElement, selector: string): FakeElement[] {
  const steps = selector.split(">").map((step) => step.trim());
  let found = descendants(root).filter((element) => stepMatches(element, steps[0] ?? ""));
  for (const step of steps.slice(1)) found = found.flatMap((element) => element.children.filter((child) => stepMatches(child, step)));
  return found;
}

function stepMatches(element: FakeElement, step: string): boolean {
  const parsed = /^([a-z]+)(?::nth-of-type\((\d+)\))?$/u.exec(step);
  if (!parsed) throw new Error(`The fake page does not read the selector step ${JSON.stringify(step)}.`);
  const [, tag, nth] = parsed;
  if (element.tagName !== tag?.toUpperCase()) return false;
  if (nth === undefined) return true;
  const sameTag = (element.parentElement?.children ?? [element]).filter((sibling) => sibling.tagName === element.tagName);
  return sameTag.indexOf(element) === Number(nth) - 1;
}

const STORE_ORIGIN = "http://store.test";
/** How many results pages the store's earbud search has. */
export const PAGE_COUNT = 5;
/** What each card of the results answers to. */
export const STORE_ITEM = "[data-card]";
/** A `next` selector `selectorFor` writes for the store's Next, which is its `a` at that position among the pager's. */
export const nthPagerLink = (position: number): string => `main > div:nth-of-type(2) > div > nav > a:nth-of-type(${position})`;

const pageHref = (target: number): string => `/s?k=wireless+earbuds&page=${target}`;

/** The page numbers the store's pager shows: the first three, the current one and its neighbours, and the last. */
function shownPages(current: number): number[] {
  const pages = new Set([1, 2, 3, current - 1, current, current + 1, PAGE_COUNT]);
  return [...pages].filter((page) => page >= 1 && page <= PAGE_COUNT).sort((left, right) => left - right);
}

/** One results page: the page it is, what it shows, and the page each pressed link would have loaded, in order. */
export type StorePage = {
  cards: FakeElement[];
  /** The page each followed control led to, in order. */
  followed: number[];
  /** Puts the pager under the list, for a page that draws it late. */
  drawPager(): void;
  restore(): void;
};

function link(target: number, label: string, text: string, turnTo: (page: number) => void): FakeElement {
  const element = new FakeElement("a", { href: pageHref(target), "aria-label": label }, text);
  element.onClick = () => turnTo(target);
  return element;
}

/** The store's pager for `page`, markup for markup; `turnTo` is what pressing one of its links does. */
function pager(page: number, turnTo: (target: number) => void): FakeElement {
  const previous = page > 1
    ? link(page - 1, `Go to previous page, page ${page - 1}`, "Previous", turnTo)
    : new FakeElement("span", { "aria-disabled": "true" }, "Previous");
  const numbers: FakeElement[] = [];
  let last = 0;
  for (const target of shownPages(page)) {
    if (target > last + 1) numbers.push(new FakeElement("span", { "aria-hidden": "true" }, "…"));
    numbers.push(target === page
      ? new FakeElement("span", { "aria-current": "page", "aria-label": `Current page, page ${target}` }, String(target))
      : link(target, `Go to page ${target}`, String(target), turnTo));
    last = target;
  }
  // The store's own bug: on page two, Next leads back to page two.
  const next = page < PAGE_COUNT
    ? link(page === 2 ? 2 : page + 1, `Go to next page, page ${page + 1}`, "Next", turnTo)
    : new FakeElement("span", { "aria-disabled": "true" }, "Next");
  return new FakeElement("nav", { role: "navigation", "aria-label": "pagination" }, "", [previous, ...numbers, next]);
}

/** Four cards of a page; the second is a product whose own link reads "Next", which is never the pager's. */
function cardsOf(page: number): FakeElement[] {
  return [1, 2, 3, 4].map((index) => new FakeElement("div", { "data-card": `${page}-${index}` }, "", [
    new FakeElement("a", { href: `/dp/P${page}${index}` }, index === 2 ? "Next" : `Wireless earbuds ${page}.${index}`)
  ]));
}

/**
 * Stands the store's results page `page` up as the document, until `restore`.
 * With `pager: "late"`, the page draws its list first and its pager only when
 * `drawPager` is called. Pressing a pager link replaces the results with that
 * page's, as the store's does, and records where it led.
 */
export function storePage(page: number, options: { pager?: "drawn" | "late" | "none" } = {}): StorePage {
  const saved = {
    document: (globalThis as Record<string, unknown>).document,
    window: (globalThis as Record<string, unknown>).window,
    element: (globalThis as Record<string, unknown>).HTMLElement,
    input: (globalThis as Record<string, unknown>).HTMLInputElement
  };
  const followed: number[] = [];
  const results = new FakeElement("div", { role: "list" }, "", cardsOf(page));
  const turnTo = (target: number): void => {
    followed.push(target);
    results.replaceChildren(...cardsOf(target));
  };
  const widget = new FakeElement("div", { role: "region", "aria-label": "Customers frequently viewed" }, "", [
    new FakeElement("a", { href: "/dp/W1" }, "Popular earbuds"),
    new FakeElement("a", { href: "/dp/W2" }, "Popular charging case")
  ]);
  const column = new FakeElement("div", {}, "", [results, widget]);
  const nav = pager(page, turnTo);
  if ((options.pager ?? "drawn") === "drawn") column.append(nav);
  const rail = new FakeElement("aside", {}, "", [new FakeElement("a", { href: pageHref(1) + "&stars=4", "aria-label": "4 Stars & Up" }, "4 Stars & Up")]);
  const main = new FakeElement("main", {}, "", [
    new FakeElement("div", {}, "", [new FakeElement("span", {}, `results for "wireless earbuds"`)]),
    new FakeElement("div", {}, "", [rail, column])
  ]);
  const body = new FakeElement("body", {}, "", [main]);

  (globalThis as Record<string, unknown>).HTMLElement = FakeElement;
  (globalThis as Record<string, unknown>).HTMLInputElement = class {};
  (globalThis as Record<string, unknown>).window = { addEventListener: () => {}, removeEventListener: () => {} };
  (globalThis as Record<string, unknown>).document = {
    readyState: "complete",
    URL: `${STORE_ORIGIN}${pageHref(page)}`,
    querySelector: (selector: string) => body.querySelector(selector),
    querySelectorAll: (selector: string) => body.querySelectorAll(selector)
  };
  return {
    cards: [...results.children],
    followed,
    drawPager: () => { column.append(nav); },
    restore: () => {
      for (const [name, value] of Object.entries({ document: saved.document, window: saved.window, HTMLElement: saved.element, HTMLInputElement: saved.input })) {
        (globalThis as Record<string, unknown>)[name] = value;
      }
    }
  };
}
