// The Retry a failed load-more offers (lane t195, run `run-munnyvbr-11c28a0f`:
// Guildline's first Show more fails and only its Retry loads the rows). The
// label rule is the guard that keeps the read from pressing a Retry that acts:
// the whole label must ask to load again and nothing more.

import assert from "node:assert/strict";
import test from "node:test";
import { awaitListComplete } from "../list-wait";
import { isLoadRetryLabel, LIST_LOAD_RETRIES, newRetryBudget, offeredLoadRetry } from "../load-retry";
import { advancePage, type PaginationProgress } from "../pagination";
import { FakeElement } from "./store-pager";

test("the labels a failed load offers are pressed", () => {
  for (const label of ["Retry", "retry", " Try again ", "Try again.", "Reload", "Load again", "Try loading again"]) {
    assert.equal(isLoadRetryLabel(label), true, label);
  }
});

test("a Retry that does something else, or a sentence, is never pressed", () => {
  for (const label of ["Retry payment", "Try again to publish", "Retry and send", "Something went wrong. Retry", "Place order", "Show more", "Delete", "", "Retry ".repeat(10)]) {
    assert.equal(isLoadRetryLabel(label), false, label);
  }
});

// A feed draws its Try again as a bare focusable span with no role (t194-w24,
// the classifieds feed), which the pressable controls used to leave out.

/** A Show more and, beside it, a Retry drawn as a span with these attributes; answers what `offeredLoadRetry` offers. */
function offeredBeside(retry: Record<string, string>): { offered: unknown; retry: FakeElement } {
  const saved = (globalThis as Record<string, unknown>).HTMLElement;
  (globalThis as Record<string, unknown>).HTMLElement = FakeElement;
  try {
    const showMore = new FakeElement("button", { type: "button" }, "Show more");
    const control = new FakeElement("span", retry, "Try again");
    new FakeElement("div", {}, "", [new FakeElement("div", {}, "", [showMore]), new FakeElement("div", {}, "", [new FakeElement("span", {}, "Something went wrong."), control])]);
    return { offered: offeredLoadRetry(showMore as unknown as Element), retry: control };
  } finally {
    (globalThis as Record<string, unknown>).HTMLElement = saved;
  }
}

test("a Try again drawn as a bare span in the tab order is offered; one taken out of it, or never in it, is not", () => {
  const inOrder = offeredBeside({ tabindex: "0" });
  assert.equal(inOrder.offered, inOrder.retry);
  assert.equal(offeredBeside({ tabindex: "-1" }).offered, undefined);
  assert.equal(offeredBeside({}).offered, undefined);
  const asButton = offeredBeside({ role: "button" });
  assert.equal(asButton.offered, asButton.retry, "a span with a button's role was offered before, and still is");
});

// A read presses the "Try again" its list offers after a batch failed to load,
// bounded, and goes on reading (t194-w24 GAP 2).
//
// The classifieds feed loads its next batch when the space under its last card
// scrolls into reach. One batch per session fails the first time it is asked
// for: its skeletons stay, and a bare focusable span -- no role, `tabindex="0"`
// -- reading "Try again" is drawn under them. Every read stopped at 9 of 12
// rows: the one-page reveal (`list-wait.ts`) and a scroll-paged read
// (`pagination.ts`) saw nothing arrive and called the list ended. A model
// pressing Try again while authoring would not help a replayed Flow, which
// meets the failure again, so the read itself has to press it.
//
// The fake feed here is the feed's own shape (`client/feed-script.ts` in the
// classifieds scenario): `section > [grid of cards, skeletons, retry line]`.

const CARD = "[data-card]";

function card(index: number): FakeElement {
  return new FakeElement("div", { "data-card": String(index) }, `Bike ${index}`);
}

/** How the feed's failed batch answers a press of its Try again: it loads, or it fails again with a new line. */
type OnRetry = "loads" | "fails-again";

type Feed = { grid: FakeElement; section: FakeElement; presses(): number; restore(): void };

/**
 * Stands the feed up as the document with nine cards and a failed batch under
 * them. `retry` draws the failed batch's control; `above` puts the line above
 * the grid instead of under it.
 */
function feedWithFailedBatch(onRetry: OnRetry, retry: Record<string, string> = { tabindex: "0" }, options: { above?: boolean; label?: string } = {}): Feed {
  const saved = { document: (globalThis as Record<string, unknown>).document, element: (globalThis as Record<string, unknown>).HTMLElement };
  const grid = new FakeElement("div", { class: "grid" }, "", Array.from({ length: 9 }, (_, index) => card(index + 1)));
  const skeletons = new FakeElement("div", { class: "loadMore" }, "", [new FakeElement("div", { class: "skeleton" })]);
  const section = new FakeElement("section");
  let presses = 0;
  const failedLine = (): FakeElement => {
    const control = new FakeElement("span", { class: "linkButton", ...retry }, options.label ?? "Try again");
    const line = new FakeElement("div", { class: "retry" }, "", [new FakeElement("span", {}, "Could not load more results."), control]);
    control.onClick = () => {
      presses += 1;
      // The feed removes the line at the press; a batch that fails again draws a new one.
      if (onRetry === "fails-again") {
        line.replaceWith(failedLine());
        return;
      }
      line.replaceWith();
      setTimeout(() => { for (const index of [10, 11, 12]) grid.append(card(index)); }, 30);
    };
    return line;
  };
  for (const element of options.above ? [failedLine(), grid, skeletons] : [grid, skeletons, failedLine()]) section.append(element);
  const body = new FakeElement("body", {}, "", [new FakeElement("main", {}, "", [section])]);
  (globalThis as Record<string, unknown>).HTMLElement = FakeElement;
  (globalThis as Record<string, unknown>).document = {
    readyState: "complete",
    URL: "http://classifieds.test/search?q=bike",
    body,
    documentElement: { scrollHeight: 1_000 },
    querySelector: (selector: string) => body.querySelector(selector),
    querySelectorAll: (selector: string) => body.querySelectorAll(selector)
  };
  return {
    grid,
    section,
    presses: () => presses,
    restore: () => {
      (globalThis as Record<string, unknown>).document = saved.document;
      (globalThis as Record<string, unknown>).HTMLElement = saved.element;
    }
  };
}

function cardCount(): number {
  return document.querySelectorAll(CARD).length;
}

test("a one-page read whose list ends on a failed batch presses its bare-span Try again and has the whole list", async () => {
  const feed = feedWithFailedBatch("loads");
  try {
    assert.equal(await awaitListComplete(CARD, Number.MAX_SAFE_INTEGER, Date.now() + 10_000), "complete");
    assert.equal(feed.presses(), 1);
    assert.equal(cardCount(), 12, "the three cards of the failed batch");
  } finally {
    feed.restore();
  }
});

test("a batch that fails again is retried at most twice in one read, however many waits that read makes", async () => {
  const feed = feedWithFailedBatch("fails-again");
  try {
    const budget = newRetryBudget();
    const startedAt = Date.now();
    assert.equal(await awaitListComplete(CARD, Number.MAX_SAFE_INTEGER, Date.now() + 10_000, budget), "complete");
    assert.equal(await awaitListComplete(CARD, Number.MAX_SAFE_INTEGER, Date.now() + 10_000, budget), "complete");
    assert.equal(feed.presses(), LIST_LOAD_RETRIES);
    assert.equal(LIST_LOAD_RETRIES, 2);
    assert.equal(cardCount(), 9);
    // A press that fails again shows a new Try again at once, which ends the wait rather than waiting the press's window out.
    assert.ok(Date.now() - startedAt < 2_000, `took ${Date.now() - startedAt} ms`);
  } finally {
    feed.restore();
  }
});

test("only the list's own Retry is pressed: not one out of the tab order, not one above the list, not one that does something else", async () => {
  for (const [name, stand] of [
    ["tabindex -1", () => feedWithFailedBatch("loads", { tabindex: "-1" })],
    ["no tabindex", () => feedWithFailedBatch("loads", {})],
    ["above the list", () => feedWithFailedBatch("loads", { tabindex: "0" }, { above: true })],
    ["Retry payment", () => feedWithFailedBatch("loads", { tabindex: "0" }, { label: "Retry payment" })],
    ["hidden", () => feedWithFailedBatch("loads", { tabindex: "0", hidden: "" })]
  ] as const) {
    const feed = stand();
    try {
      assert.equal(await awaitListComplete(CARD, Number.MAX_SAFE_INTEGER, Date.now() + 10_000), "complete", name);
      assert.equal(feed.presses(), 0, name);
      assert.equal(cardCount(), 9, name);
    } finally {
      feed.restore();
    }
  }
});

test("a read that wants no more than it sees presses nothing", async () => {
  const feed = feedWithFailedBatch("loads");
  try {
    assert.equal(await awaitListComplete(CARD, 5, Date.now() + 10_000), "complete");
    assert.equal(feed.presses(), 0);
  } finally {
    feed.restore();
  }
});

test("a read that pages by scrolling presses the failed batch's Try again instead of ending as scrolled_to_end", async () => {
  const feed = feedWithFailedBatch("loads");
  const saved = { window: (globalThis as Record<string, unknown>).window, style: (globalThis as Record<string, unknown>).getComputedStyle };
  // A window already at the bottom of a page that does not grow by scrolling: only the Try again can bring more.
  (globalThis as Record<string, unknown>).window = { scrollX: 0, scrollY: 200, innerHeight: 800, scrollTo: () => {}, addEventListener: () => {}, removeEventListener: () => {} };
  (globalThis as Record<string, unknown>).getComputedStyle = () => ({ overflowY: "visible" });
  (document.body as unknown as { scrollHeight: number }).scrollHeight = 1_000;
  try {
    const firstNine = new Set(Array.from(document.querySelectorAll(CARD)));
    const progress: PaginationProgress = {
      item: CARD,
      shown: [...firstNine],
      pagesRead: 1,
      scrolls: 0,
      deadline: Date.now() + 20_000,
      hasUnreadItem: () => Array.from(document.querySelectorAll(CARD)).some((element) => !firstNine.has(element))
    };
    assert.deepEqual(await advancePage({ mode: "scroll", maxScrolls: 10 }, progress), { outcome: "advanced" });
    assert.equal(feed.presses(), 1);
    assert.equal(progress.scrolls, 1, "a press is not a scroll");
    assert.equal(progress.listRetries?.pressed, 1, "and it is spent from the read's budget");
    assert.equal(cardCount(), 12);
  } finally {
    (globalThis as Record<string, unknown>).window = saved.window;
    (globalThis as Record<string, unknown>).getComputedStyle = saved.style;
    feed.restore();
  }
});
