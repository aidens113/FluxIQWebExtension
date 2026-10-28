// `web.dom.next_page` on a list the page loads in parts as it is scrolled
// (`../scroll-for-more.ts`, `../list-loading.ts`, `../found-way.ts`).
//
// Live run `run-mvcvzwk1-c1d869e4` (2026-10-17): a feed that fetches its next
// batch when its end nears the bottom of the screen, marks itself busy and
// draws two placeholder cards while the batch is on its way. A next-page step
// scrolled the window to the bottom, saw no new item within the 900 ms growth
// window, found the window at the bottom of the placeholders, and answered
// `ended: scrolled_to_end`; the batch arrived a moment later.
//
// The page here is synthetic, the feed's shape and no site's words: a column of
// posts, each one row of the document, an empty sentinel after them, and a
// window that scrolls over rows. A scroll that brings the sentinel within reach
// of the viewport fetches the next batch after `batchMs`, marking the feed
// busy and drawing placeholders while it waits, as the options say.

import assert from "node:assert/strict";
import test from "node:test";
import { STORE_ITEM, storePage } from "../../tests/store-pager";
import { movePage } from "..";
import { pressLoadMore } from "../load-more";

/** One row of the fake document per element, and the viewport's height, in px. */
const ROW_PX = 100;
const VIEWPORT_PX = 800;
/** How far below the viewport the sentinel starts a fetch. */
const REACH_PX = 300;
const POST = "[data-post]";

/** An element: tags, attributes that can change, text, a parent and children, and the simple selectors the step reads. */
class El {
  readonly tagName: string;
  parentElement: El | null = null;
  children: El[] = [];
  onClick: (() => void) | undefined;
  readonly scrollHeight = 0;
  readonly clientHeight = 0;
  private readonly attributes: Map<string, string>;
  private readonly ownText: string;

  constructor(tag: string, attributes: Record<string, string> = {}, text = "", children: El[] = []) {
    this.tagName = tag.toUpperCase();
    this.attributes = new Map(Object.entries(attributes));
    this.ownText = text;
    for (const child of children) this.append(child);
  }

  append(child: El): void {
    child.parentElement = this;
    this.children.push(child);
  }

  remove(): void {
    const parent = this.parentElement;
    if (!parent) return;
    parent.children.splice(parent.children.indexOf(this), 1);
    this.parentElement = null;
  }

  get isConnected(): boolean {
    let top: El = this;
    while (top.parentElement) top = top.parentElement;
    return top.tagName === "BODY";
  }

  /** The top of its tree, as the press watch asks before a load-more press (`../load-more.ts`). */
  getRootNode(): El {
    let top: El = this;
    while (top.parentElement) top = top.parentElement;
    return top;
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  removeAttribute(name: string): void {
    this.attributes.delete(name);
  }

  get textContent(): string {
    return this.ownText + this.children.map((child) => child.textContent).join("");
  }

  get firstChild(): unknown {
    return this.children[0] ?? (this.ownText === "" ? null : {});
  }

  get nextElementSibling(): El | null {
    const siblings = this.parentElement?.children ?? [];
    return siblings[siblings.indexOf(this) + 1] ?? null;
  }

  contains(other: El | null): boolean {
    for (let node = other; node; node = node.parentElement) if (node === this) return true;
    return false;
  }

  matches(selector: string): boolean {
    return selector.split(",").some((part) => compoundMatches(this, part.trim()));
  }

  closest(selector: string): El | null {
    for (let node: El | null = this; node; node = node.parentElement) if (node.matches(selector)) return node;
    return null;
  }

  querySelectorAll(selector: string): El[] {
    return descendants(this).filter((element) => element.matches(selector));
  }

  querySelector(selector: string): El | null {
    return this.querySelectorAll(selector)[0] ?? null;
  }

  click(): void {
    this.onClick?.();
  }

  getClientRects(): unknown[] {
    return this.isConnected ? [{}] : [];
  }

  compareDocumentPosition(other: El): number {
    const order = descendants(page?.body ?? this);
    return order.indexOf(other) > order.indexOf(this) ? 4 : 2;
  }
}

function descendants(root: El): El[] {
  return root.children.flatMap((child) => [child, ...descendants(child)]);
}

/** `*`, a tag, `[name]` or `[name="value"]`, or a tag with one of those; `:disabled` names nothing here. */
function compoundMatches(element: El, selector: string): boolean {
  if (selector === ":disabled") return false;
  const parsed = /^(\*|[a-z]+)?(?:\[([\w-]+)(?:="([^"]*)")?\])?$/u.exec(selector);
  if (!parsed) throw new Error(`The fake page does not read the selector ${JSON.stringify(selector)}.`);
  const [, tag, attribute, value] = parsed;
  if (tag !== undefined && tag !== "*" && element.tagName !== tag.toUpperCase()) return false;
  if (attribute === undefined) return true;
  const actual = element.getAttribute(attribute);
  return value === undefined ? actual !== null : actual === value;
}

/** How the feed loads its next batch. */
type FeedOptions = {
  /** How long a batch takes to arrive after the scroll that asked for it. */
  batchMs: number;
  /** How many batches of five the feed still has. */
  batches: number;
  /** Whether the feed marks itself `aria-busy="true"` while a batch is on its way. */
  busy?: boolean;
  /** Whether two empty placeholder cards stand in for the batch while it is on its way. */
  placeholders?: boolean;
  /** Whether the batch never arrives: the feed stays loading. */
  stuck?: boolean;
  /** Whether a Load more control under the feed also loads a batch. */
  loadMore?: boolean;
  /** The button is exposed only after an initial scroll-loaded batch. */
  hiddenLoadMore?: boolean;
  /** Scrolling exposes the button without loading a batch itself. */
  revealMoreOnScroll?: boolean;
  /**
   * The loader refuses the first `refusals` requests it is not told to force,
   * writing `words` under the list (a limiter's notice, t762), and then either
   * offers a Try again control after `retryAfterMs` whose press loads the batch,
   * or goes by itself after `clearsAfterMs` and loads the batch. Neither: the
   * notice stays for good.
   */
  pause?: { words: string; refusals: number; retryAfterMs?: number; clearsAfterMs?: number };
};

type FeedPage = { body: El; feed: El; scrolls(): number; posts(): number; restore(): void };
let page: FeedPage | undefined;

function post(index: number): El {
  return new El("div", { "data-post": String(index) }, `Post ${index}`);
}

/** Stands the feed up as the document with five posts; see the header. */
function feedPage(options: FeedOptions): FeedPage {
  const saved = Object.fromEntries(["document", "window", "HTMLElement", "HTMLInputElement", "getComputedStyle"].map((name) => [name, (globalThis as Record<string, unknown>)[name]]));
  let next = 1;
  const batch = (): El[] => Array.from({ length: 5 }, () => post(next++));
  const feed = new El("div", { role: "feed" }, "", batch());
  const sentinel = new El("div", { "aria-hidden": "true" });
  const main = new El("main", {}, "", [new El("h1", {}, "Home"), feed, sentinel]);
  const body = new El("body", {}, "", [main]);
  const height = (): number => descendants(body).length * ROW_PX;
  const rowOf = (element: El): number => descendants(body).indexOf(element) * ROW_PX;
  let left = options.batches;
  let loading = false;
  let scrolls = 0;
  let more: El | undefined;
  const view = { scrollX: 0, scrollY: 0, innerHeight: VIEWPORT_PX };
  let refused = 0;
  let notice: El | undefined;
  const refuse = (pause: NonNullable<FeedOptions["pause"]>): void => {
    refused += 1;
    notice = new El("div", {}, pause.words);
    const siblings = main.children;
    notice.parentElement = main;
    siblings.splice(siblings.indexOf(feed) + 1, 0, notice);
    const shown = notice;
    const goAway = (): void => {
      shown.remove();
      notice = undefined;
      load(true);
    };
    if (pause.retryAfterMs !== undefined) {
      setTimeout(() => {
        const retry = new El("button", {}, "Try again");
        retry.onClick = goAway;
        shown.append(retry);
      }, pause.retryAfterMs);
    }
    if (pause.clearsAfterMs !== undefined) setTimeout(goAway, pause.clearsAfterMs);
  };
  const load = (force = false): void => {
    if (loading || left === 0) return;
    if (options.pause && !force && notice === undefined && refused < options.pause.refusals) return refuse(options.pause);
    if (notice !== undefined && !force) return;
    loading = true;
    left -= 1;
    if (options.busy) feed.setAttribute("aria-busy", "true");
    const stand = options.placeholders ? [new El("div", { "aria-hidden": "true" }), new El("div", { "aria-hidden": "true" })] : [];
    for (const placeholder of stand) feed.append(placeholder);
    if (options.stuck) return;
    setTimeout(() => {
      for (const placeholder of stand) placeholder.remove();
      for (const item of batch()) feed.append(item);
      if (options.busy) feed.setAttribute("aria-busy", "false");
      loading = false;
      if (options.hiddenLoadMore) more?.removeAttribute("hidden");
    }, options.batchMs);
  };
  const onScroll = (): void => {
    if (options.revealMoreOnScroll) {
      more?.removeAttribute("hidden");
      return;
    }
    if (rowOf(sentinel) - view.scrollY < view.innerHeight + REACH_PX) load();
  };
  if (options.loadMore) {
    const control = new El("button", { "data-more": "" }, "Load more");
    more = control;
    if (options.hiddenLoadMore) control.setAttribute("hidden", "");
    control.onClick = () => load();
    main.append(control);
  }
  (globalThis as Record<string, unknown>).HTMLElement = El;
  (globalThis as Record<string, unknown>).HTMLInputElement = class {};
  (globalThis as Record<string, unknown>).getComputedStyle = () => ({ overflowY: "visible" });
  (globalThis as Record<string, unknown>).window = {
    get scrollX() { return view.scrollX; },
    get scrollY() { return view.scrollY; },
    innerHeight: VIEWPORT_PX,
    scrollTo: (to: { top: number }) => {
      const top = Math.max(0, Math.min(to.top, height() - VIEWPORT_PX));
      scrolls += 1;
      if (top === view.scrollY) return;
      view.scrollY = top;
      // The page hears a scroll after the frame that made it, as a browser's listeners do.
      setTimeout(onScroll, 0);
    },
    addEventListener: () => {},
    removeEventListener: () => {}
  };
  (globalThis as Record<string, unknown>).document = {
    readyState: "complete",
    URL: "http://feed.test/",
    body,
    documentElement: { get scrollHeight() { return height(); } },
    querySelector: (selector: string) => body.querySelector(selector),
    querySelectorAll: (selector: string) => body.querySelectorAll(selector)
  };
  page = {
    body,
    feed,
    scrolls: () => scrolls,
    posts: () => body.querySelectorAll(POST).length,
    restore: () => {
      for (const [name, value] of Object.entries(saved)) (globalThis as Record<string, unknown>)[name] = value;
      page = undefined;
    }
  };
  return page;
}

async function onFeed<T>(options: FeedOptions, body: (feed: FeedPage) => Promise<T>): Promise<T> {
  const feed = feedPage(options);
  try {
    return await body(feed);
  } finally {
    feed.restore();
  }
}

test("a feed whose batch arrives within the growth window moves by scroll", async () => {
  await onFeed({ batchMs: 200, batches: 3, busy: true, placeholders: true }, async (feed) => {
    assert.deepEqual(await movePage({ item: POST, pagination: { mode: "scroll" } }, { timeoutMs: 30_000 }), { outcome: "moved", by: "scroll" });
    assert.equal(feed.posts(), 10);
  });
});

// The live failure: the batch takes longer than the 900 ms window, and the
// window is at the bottom of the placeholders when it closes. Each signal on
// its own keeps the step waiting: the busy mark, and the placeholders.
for (const [name, signals] of [
  ["marked busy and showing placeholders", { busy: true, placeholders: true }],
  ["marked busy only", { busy: true }],
  ["showing placeholders only", { placeholders: true }]
] as const) {
  test(`a feed whose slow batch is on its way, ${name}, moves by scroll once it arrives rather than ending`, async () => {
    await onFeed({ batchMs: 2_500, batches: 3, ...signals }, async (feed) => {
      const answer = await movePage({ item: POST, pagination: { mode: "scroll" } }, { timeoutMs: 30_000 });
      assert.deepEqual(answer, { outcome: "moved", by: "scroll" });
      assert.equal(feed.posts(), 10, "the slow batch was waited for");
    });
  });
}

test("a feed with nothing more ends on scrolled_to_end after a bounded wait", async () => {
  await onFeed({ batchMs: 200, batches: 0, busy: true, placeholders: true }, async (feed) => {
    const startedAt = Date.now();
    const answer = await movePage({ item: POST, pagination: { mode: "scroll" } }, { timeoutMs: 30_000 });
    assert.deepEqual(answer, { outcome: "ended", stop: "scrolled_to_end" });
    assert.ok(Date.now() - startedAt < 3_000, `a quiet page is not waited on: took ${Date.now() - startedAt} ms`);
    assert.equal(feed.posts(), 5);
  });
});

test("a feed that shows a batch loading and never brings it ends once the loading wait is spent, not never", async () => {
  await onFeed({ batchMs: 0, batches: 1, busy: true, placeholders: true, stuck: true }, async (feed) => {
    const startedAt = Date.now();
    const answer = await movePage({ item: POST, pagination: { mode: "scroll" } }, { timeoutMs: 60_000 });
    const tookMs = Date.now() - startedAt;
    assert.deepEqual(answer, { outcome: "ended", stop: "scrolled_to_end" });
    assert.ok(tookMs >= 15_000 && tookMs < 25_000, `bounded by the loading wait: took ${tookMs} ms`);
    assert.equal(feed.posts(), 5);
  });
});

test("a list that carried no way forward and shows no control is scrolled for more", async () => {
  await onFeed({ batchMs: 2_000, batches: 2, busy: true, placeholders: true }, async (feed) => {
    assert.deepEqual(await movePage({ item: POST }, { timeoutMs: 30_000 }), { outcome: "moved", by: "scroll" });
    assert.equal(feed.posts(), 10);
    assert.deepEqual(await movePage({ item: POST }, { timeoutMs: 30_000 }), { outcome: "moved", by: "scroll" });
    assert.deepEqual(await movePage({ item: POST }, { timeoutMs: 30_000 }), { outcome: "ended", stop: "scrolled_to_end" });
    assert.equal(feed.posts(), 15);
  });
});

test("a named Load more is pressed, never scrolled past, on a page that would also load on a scroll", async () => {
  await onFeed({ batchMs: 200, batches: 2, loadMore: true }, async (feed) => {
    assert.deepEqual(await movePage({ item: POST, pagination: { mode: "loadMore", control: "button[data-more]" } }, { timeoutMs: 30_000 }), { outcome: "moved", by: "loadMore" });
    assert.equal(feed.posts(), 10);
    assert.equal(feed.scrolls(), 0, "the window was not scrolled");
  });
});

test("a hidden Load more does not end the list before its scroll-loaded batch exposes the control", async () => {
  await onFeed({ batchMs: 200, batches: 2, loadMore: true, hiddenLoadMore: true }, async (feed) => {
    const request = { item: POST, pagination: { mode: "loadMore" as const, control: "button[data-more]" } };
    assert.deepEqual(await movePage(request, { timeoutMs: 30_000 }), { outcome: "moved", by: "scroll" });
    assert.equal(feed.posts(), 10);
    assert.ok(feed.scrolls() > 0);
    const scrolls = feed.scrolls();
    assert.deepEqual(await movePage(request, { timeoutMs: 30_000 }), { outcome: "moved", by: "loadMore" });
    assert.equal(feed.posts(), 15);
    assert.equal(feed.scrolls(), scrolls, "the now-visible button is preferred to another scroll");
  });
});

test("a hidden Load more cannot scroll beyond a read's requested page limit", async () => {
  await onFeed({ batchMs: 200, batches: 2, loadMore: true, hiddenLoadMore: true }, async (feed) => {
    const progress = { item: POST, shown: document.querySelectorAll(POST), pagesRead: 1, scrolls: 0, deadline: Date.now() + 10_000, hasUnreadItem: () => false };
    assert.deepEqual(await pressLoadMore({ mode: "loadMore", control: "button[data-more]" }, { ...progress, shown: Array.from(progress.shown) }, 1), { outcome: "truncated", stop: "page_limit" });
    assert.equal(feed.scrolls(), 0);
    assert.equal(feed.posts(), 5);
  });
});

test("a scroll that exposes only the Load more control presses it before reporting the list ended", async () => {
  await onFeed({ batchMs: 200, batches: 1, loadMore: true, hiddenLoadMore: true, revealMoreOnScroll: true }, async (feed) => {
    assert.deepEqual(await movePage({ item: POST, pagination: { mode: "loadMore", control: "button[data-more]" } }, { timeoutMs: 30_000 }), { outcome: "moved", by: "loadMore" });
    assert.equal(feed.posts(), 10);
    assert.ok(feed.scrolls() > 0);
  });
});

test("a pager's Next found from a list that carried no way is followed, and a disabled one ends the list, with no scroll", async () => {
  for (const [number, expected] of [[1, { outcome: "moved", by: "next", page: 2 }], [5, { outcome: "ended", stop: "control_disabled" }]] as const) {
    const shown = storePage(number);
    let scrolled = 0;
    window.scrollTo = () => { scrolled += 1; };
    try {
      assert.deepEqual(await movePage({ item: STORE_ITEM }, { timeoutMs: 20_000 }), expected);
      assert.equal(scrolled, 0, `page ${number}: the control was preferred to a scroll`);
    } finally {
      shown.restore();
    }
  }
});

// A list is going on, ended, or paused by the site (t755, t762). A loader that
// answers a scroll or a press with a notice to wait has paused the list: the
// step waits as the notice asks, or presses the retry it offers, and asks again.
// The words are a limiter's, not a site's; the notice, its seconds and its Try
// again are what the options set.
const WAIT_WORDS = "Please wait a few moments before you try again.";

test("a scroll met by the loader's notice presses the Try again it offers and moves, never ending the list", async () => {
  await onFeed({ batchMs: 100, batches: 3, pause: { words: WAIT_WORDS, refusals: 1, retryAfterMs: 2_500 } }, async (feed) => {
    assert.deepEqual(await movePage({ item: POST, pagination: { mode: "scroll" } }, { timeoutMs: 30_000 }), { outcome: "moved", by: "scroll" });
    assert.equal(feed.posts(), 10, "the retry loaded the batch");
  });
});

test("a scroll met by a notice that goes by itself waits it out and moves", async () => {
  await onFeed({ batchMs: 100, batches: 3, pause: { words: WAIT_WORDS, refusals: 1, clearsAfterMs: 3_000 } }, async (feed) => {
    assert.deepEqual(await movePage({ item: POST }, { timeoutMs: 30_000 }), { outcome: "moved", by: "scroll" });
    assert.equal(feed.posts(), 10);
  });
});

test("a scroll met by a notice that stays fails rate_limited with the notice's words, not ended", async () => {
  await onFeed({ batchMs: 100, batches: 3, pause: { words: "Too many requests. Try again in 1s.", refusals: 99 } }, async (feed) => {
    const answer = await movePage({ item: POST, pagination: { mode: "scroll" } }, { timeoutMs: 60_000 });
    assert.equal(answer.outcome, "failed");
    if (answer.outcome !== "failed") return;
    assert.equal(answer.stop, "rate_limited");
    assert.match(answer.reason, /Too many requests\. Try again in 1s\./u);
    assert.equal(feed.posts(), 5);
  });
});

test("a Load more press met by the loader's notice presses the Try again it offers and moves", async () => {
  await onFeed({ batchMs: 100, batches: 3, loadMore: true, pause: { words: WAIT_WORDS, refusals: 1, retryAfterMs: 2_500 } }, async (feed) => {
    // The press is the page's request for a batch: a scroll tripped the limiter first.
    assert.deepEqual(await movePage({ item: POST, pagination: { mode: "loadMore", control: "button[data-more]" } }, { timeoutMs: 30_000 }), { outcome: "moved", by: "loadMore" });
    assert.equal(feed.posts(), 10);
  });
});

test("a Load more press met by a notice that stays fails rate_limited, not list_unchanged and not ended", async () => {
  await onFeed({ batchMs: 100, batches: 3, loadMore: true, pause: { words: "Too many requests. Try again in 1s.", refusals: 99 } }, async (feed) => {
    const answer = await movePage({ item: POST, pagination: { mode: "loadMore", control: "button[data-more]" } }, { timeoutMs: 60_000 });
    assert.equal(answer.outcome, "failed");
    if (answer.outcome !== "failed") return;
    assert.equal(answer.stop, "rate_limited");
    assert.match(answer.reason, /Too many requests/u);
    assert.equal(feed.posts(), 5);
  });
});
