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
//
// **And with `lazyTail`, the store's results as a read that reveals them sees
// them.** The store draws twelve results with the page and a sentinel under
// the twelfth; once a scroll brings the sentinel within 200 px of the viewport,
// it fetches the rest of the page and replaces itself with them, 600 ms later
// (`client/search-script.ts`, `client/timings.ts` there). Here every element
// takes one row of the document in document order, the viewport is 800 px
// tall, `scrollIntoView` scrolls it, and a page turn starts at the top again,
// as a new document does: so twelve results reach below the fold, and the
// last four exist only once something scrolled the sentinel into reach.
//
// **And the same pager drawn the ways other sites draw theirs** (t194-w30):
// - `controls: "buttons"` is Guildline's people search (t194-w27 G1): every
//   page control a `<button>` with no address, the current page a button
//   marked `aria-current`, and Next a script's button -- which keeps the
//   store's own bug, so from page two it loads page two;
// - `current: "self-link"` is the marketplace's unfiltered search (t194-w26
//   G5): nothing marked `aria-current`, the current page a link to the
//   document showing it, and Previous and the numbers sharing one mark
//   (`data-page-item`) that Next does not carry; `current: "unmarked"` is the
//   same pager whose current page links somewhere else, so nothing on it says
//   which page is current;
// - `stuckOn` is a page every control of which loads that same page again:
//   a list that goes on past a page the read cannot leave;
// - `lastNext: "enabled"` is Guildline's last page (S6 GAP N1): Next stays an
//   enabled script button with no address on the last page, and pressing it
//   reloads that page, while the pager marks the last number current.

/** One row of the fake document per element, and the viewport's height, in px. */
const ROW_PX = 40;
const VIEWPORT_PX = 800;
/** How far below the viewport the store's sentinel starts its fetch. */
const SENTINEL_REACH_PX = 200;

/** The page's scroll: where it is, how often it moved, and what the page does when it moves. */
type Viewport = { root: FakeElement; scrollY: number; scrolls: number; listeners: Array<() => void> };
let viewport: Viewport | undefined;

/** An element's top in the document: its row in document order, or 0 once it left the page. */
function layoutTop(element: FakeElement): number {
  const index = viewport === undefined ? -1 : descendants(viewport.root).indexOf(element);
  return Math.max(0, index) * ROW_PX;
}

/** An element, as much of one as the pager lookup, the label reader, the page advance and the reveal ask for. */
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

  /** One box while it is on the page and not `hidden`, none otherwise: whether it is painted. */
  getClientRects(): unknown[] {
    for (let node: FakeElement | null = this; node; node = node.parentElement) if (node.getAttribute("hidden") !== null) return [];
    return this.isConnected ? [{}] : [];
  }

  /** `DOCUMENT_POSITION_PRECEDING` (2), `FOLLOWING` (4) or, for a descendant, `CONTAINED_BY | FOLLOWING` (20), by the order of one tree. */
  compareDocumentPosition(other: FakeElement): number {
    if (this.contains(other) && other !== this) return 20;
    let top: FakeElement = this;
    while (top.parentElement) top = top.parentElement;
    const order = [top, ...descendants(top)];
    return order.indexOf(other) > order.indexOf(this) ? 4 : order.indexOf(other) < order.indexOf(this) ? 2 : 0;
  }

  get nextElementSibling(): FakeElement | null {
    const siblings = this.parentElement?.children ?? [];
    return siblings[siblings.indexOf(this) + 1] ?? null;
  }

  getBoundingClientRect(): { x: number; y: number; top: number; bottom: number; left: number; right: number; width: number; height: number } {
    const top = layoutTop(this) - (viewport?.scrollY ?? 0);
    return { x: 0, y: top, top, bottom: top + ROW_PX, left: 0, right: 320, width: 320, height: ROW_PX };
  }

  /** Scrolls the viewport so this element's bottom meets the viewport's, as `block: "end"` does. */
  scrollIntoView(): void {
    if (!viewport) return;
    const scrollY = Math.max(0, layoutTop(this) + ROW_PX - VIEWPORT_PX);
    if (scrollY === viewport.scrollY) return;
    viewport.scrollY = scrollY;
    viewport.scrolls += 1;
    for (const listener of viewport.listeners) listener();
  }

  /** Puts `nodes` where this element was, as the store's sentinel does with the results it fetched. */
  replaceWith(...nodes: FakeElement[]): void {
    const parent = this.parentElement;
    if (!parent) return;
    const at = parent.children.indexOf(this);
    detach(this);
    for (const node of nodes) node.parentElement = parent;
    parent.children.splice(at, 1, ...nodes);
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

/** A child-combinator chain -- `main > div:nth-of-type(2) > nav > a:nth-of-type(4)`, or `nav > *` -- whose first step is any descendant. */
function chainFrom(root: FakeElement, selector: string): FakeElement[] {
  const steps = selector.split(">").map((step) => step.trim());
  let found = descendants(root).filter((element) => stepMatches(element, steps[0] ?? ""));
  for (const step of steps.slice(1)) found = found.flatMap((element) => element.children.filter((child) => stepMatches(child, step)));
  return found;
}

function stepMatches(element: FakeElement, step: string): boolean {
  const parsed = /^([a-z]+|\*)(?::nth-of-type\((\d+)\))?$/u.exec(step);
  if (!parsed) throw new Error(`The fake page does not read the selector step ${JSON.stringify(step)}.`);
  const [, tag, nth] = parsed;
  if (tag !== "*" && element.tagName !== tag?.toUpperCase()) return false;
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
  /** How many times the page scrolled. */
  scrolls(): number;
  /** Puts the pager under the list, for a page that draws it late. */
  drawPager(): void;
  restore(): void;
};

/** The store's split of a results page: the results drawn with it, the ones its sentinel fetches, and how long the fetch takes. */
export type LazyTail = { eager: number; lazy: number; loadMs: number };

/** The everything store's own split: twelve drawn, four fetched, 600 ms after the sentinel comes within reach. */
export const STORE_LAZY_TAIL: LazyTail = { eager: 12, lazy: 4, loadMs: 600 };

/** How the pager draws its controls and its current page: see the header. */
export type PagerStyle = {
  controls?: "links" | "buttons";
  current?: "aria" | "self-link" | "unmarked";
  /** A page every control of which loads that page again. */
  stuckOn?: number;
  /** Next stays enabled on the last page and loads that page again. */
  lastNext?: "enabled";
};

/** The Next a `next` read names on a pager drawn with `controls: "buttons"`. */
export const NEXT_BUTTON = 'button[data-next="true"]';
/** What Previous and the numbers share on a pager drawn with `current: "self-link"` or `"unmarked"`, and Next does not. */
export const PAGE_ITEM = "a[data-page-item]";

/** A control that loads `target` when pressed: a link to it, or a script's button with no address. */
function control(target: number, label: string, text: string, turnTo: (page: number) => void, style: PagerStyle, extra: Record<string, string> = {}): FakeElement {
  const element = style.controls === "buttons"
    ? new FakeElement("button", { type: "button", "aria-label": label, ...extra }, text)
    : new FakeElement("a", { href: pageHref(target), "aria-label": label, ...extra }, text);
  element.onClick = () => turnTo(target);
  return element;
}

/** The store's pager for `page`, markup for markup unless `style` draws it another site's way; `turnTo` is what pressing one of its controls does. */
function pager(page: number, turnTo: (target: number) => void, style: PagerStyle = {}): FakeElement {
  const lead = (target: number): number => (style.stuckOn === page ? page : target);
  const item: Record<string, string> = style.current === "self-link" || style.current === "unmarked" ? { "data-page-item": "" } : {};
  const previous = page > 1
    ? control(lead(page - 1), `Go to previous page, page ${page - 1}`, "Previous", turnTo, style, item)
    : new FakeElement("span", { "aria-disabled": "true" }, "Previous");
  const numbers: FakeElement[] = [];
  let last = 0;
  for (const target of shownPages(page)) {
    if (target > last + 1) numbers.push(new FakeElement("span", { "aria-hidden": "true" }, "…"));
    numbers.push(target !== page
      ? control(lead(target), `Go to page ${target}`, String(target), turnTo, style, item)
      : currentPage(page, turnTo, style, item));
    last = target;
  }
  // The store's own bug: on page two, Next leads back to page two.
  const next = page < PAGE_COUNT
    ? control(lead(page === 2 ? 2 : page + 1), `Go to next page, page ${page + 1}`, "Next", turnTo, style, style.controls === "buttons" ? { "data-next": "true" } : {})
    : style.lastNext === "enabled"
      ? control(page, "Go to next page", "Next", turnTo, style, style.controls === "buttons" ? { "data-next": "true" } : {})
      : new FakeElement(style.controls === "buttons" ? "button" : "span", { "aria-disabled": "true" }, "Next");
  return new FakeElement("nav", { role: "navigation", "aria-label": "pagination" }, "", [previous, ...numbers, next]);
}

/** The current page as the pager draws it: marked text, a marked button, or a link with no mark -- to this page or, unmarked, elsewhere. */
function currentPage(page: number, turnTo: (target: number) => void, style: PagerStyle, item: Record<string, string>): FakeElement {
  if (style.current === "self-link") return control(page, `Go to page ${page}`, String(page), turnTo, style, item);
  if (style.current === "unmarked") {
    const element = new FakeElement("a", { href: `${pageHref(page)}&from=pager`, "aria-label": `Go to page ${page}`, ...item }, String(page));
    element.onClick = () => turnTo(page);
    return element;
  }
  if (style.controls === "buttons") return control(page, `Current page, page ${page}`, String(page), turnTo, style, { "aria-current": "page" });
  return new FakeElement("span", { "aria-current": "page", "aria-label": `Current page, page ${page}` }, String(page));
}

/** Cards `first` to `last` of a page (four by default); the second is a product whose own link reads "Next", which is never the pager's. */
function cardsOf(page: number, first = 1, last = 4): FakeElement[] {
  return Array.from({ length: last - first + 1 }, (_, offset) => first + offset).map((index) => new FakeElement("div", { "data-card": `${page}-${index}` }, "", [
    new FakeElement("a", { href: `/dp/P${page}${index}` }, index === 2 ? "Next" : `Wireless earbuds ${page}.${index}`)
  ]));
}

/**
 * What a page draws in its results: every card, or, with a lazy tail, its eager
 * cards and a sentinel under the last of them that fetches the rest once a
 * scroll brings it within reach, and replaces itself with them. With
 * `shifted`, every page after the first leads with page one's first card
 * again, as a search whose index shifted between page loads shows it.
 */
function resultsOf(page: number, tail: LazyTail | undefined, scrolled: Viewport, shifted = false): FakeElement[] {
  const carried = shifted && page > 1 ? cardsOf(1, 1, 1) : [];
  if (tail === undefined) return [...carried, ...cardsOf(page)];
  const sentinel = new FakeElement("div", { "data-sentinel": "" });
  let requested = false;
  scrolled.listeners.push(() => {
    if (requested || !sentinel.isConnected || sentinel.getBoundingClientRect().top > VIEWPORT_PX + SENTINEL_REACH_PX) return;
    requested = true;
    setTimeout(() => { sentinel.replaceWith(...cardsOf(page, tail.eager + 1, tail.eager + tail.lazy)); }, tail.loadMs);
  });
  return [...carried, ...cardsOf(page, 1, tail.eager), sentinel];
}

/**
 * Stands the store's results page `page` up as the document, until `restore`.
 * With `pager: "late"`, the page draws its list first and its pager only when
 * `drawPager` is called. Pressing a pager link replaces the results with that
 * page's and the pager with that page's, as the store's does, scrolls back to
 * the top, and records where it led. With `lazyTail`, each page's results end
 * in the store's sentinel (see the header). With `shifted`, each later page
 * leads with page one's first card again (`resultsOf`).
 */
export function storePage(page: number, options: { pager?: "drawn" | "late" | "none"; lazyTail?: LazyTail; shifted?: boolean } & PagerStyle = {}): StorePage {
  const saved = {
    document: (globalThis as Record<string, unknown>).document,
    window: (globalThis as Record<string, unknown>).window,
    element: (globalThis as Record<string, unknown>).HTMLElement,
    input: (globalThis as Record<string, unknown>).HTMLInputElement
  };
  const followed: number[] = [];
  const scrolled: Viewport = { root: new FakeElement("body"), scrollY: 0, scrolls: 0, listeners: [] };
  const results = new FakeElement("div", { role: "list" }, "", resultsOf(page, options.lazyTail, scrolled, options.shifted));
  // The page the document shows, which its address follows as a new document's would.
  let current = page;
  const turnTo = (target: number): void => {
    followed.push(target);
    current = target;
    results.replaceChildren(...resultsOf(target, options.lazyTail, scrolled, options.shifted));
    scrolled.scrollY = 0;
    // A pager drawn with the list is redrawn with it, for the page it now shows.
    if (nav.parentElement) {
      const redrawn = pager(target, turnTo, options);
      nav.replaceWith(redrawn);
      nav = redrawn;
    }
  };
  const widget = new FakeElement("div", { role: "region", "aria-label": "Customers frequently viewed" }, "", [
    new FakeElement("a", { href: "/dp/W1" }, "Popular earbuds"),
    new FakeElement("a", { href: "/dp/W2" }, "Popular charging case")
  ]);
  const column = new FakeElement("div", {}, "", [results, widget]);
  let nav = pager(page, turnTo, options);
  if ((options.pager ?? "drawn") === "drawn") column.append(nav);
  const rail = new FakeElement("aside", {}, "", [new FakeElement("a", { href: pageHref(1) + "&stars=4", "aria-label": "4 Stars & Up" }, "4 Stars & Up")]);
  const main = new FakeElement("main", {}, "", [
    new FakeElement("div", {}, "", [new FakeElement("span", {}, `results for "wireless earbuds"`)]),
    new FakeElement("div", {}, "", [rail, column])
  ]);
  const body = new FakeElement("body", {}, "", [main]);
  scrolled.root = body;
  viewport = scrolled;

  (globalThis as Record<string, unknown>).HTMLElement = FakeElement;
  (globalThis as Record<string, unknown>).HTMLInputElement = class {};
  (globalThis as Record<string, unknown>).window = { addEventListener: () => {}, removeEventListener: () => {} };
  (globalThis as Record<string, unknown>).document = {
    readyState: "complete",
    get URL(): string {
      return `${STORE_ORIGIN}${pageHref(current)}`;
    },
    querySelector: (selector: string) => body.querySelector(selector),
    querySelectorAll: (selector: string) => body.querySelectorAll(selector)
  };
  return {
    cards: results.children.filter((child) => child.getAttribute("data-card") !== null),
    followed,
    scrolls: () => scrolled.scrolls,
    drawPager: () => { column.append(nav); },
    restore: () => {
      if (viewport === scrolled) viewport = undefined;
      for (const [name, value] of Object.entries({ document: saved.document, window: saved.window, HTMLElement: saved.element, HTMLInputElement: saved.input })) {
        (globalThis as Record<string, unknown>)[name] = value;
      }
    }
  };
}
