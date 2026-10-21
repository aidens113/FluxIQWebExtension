import assert from "node:assert/strict";
import test from "node:test";
import { installScrollWatch, type ScrollWatchScope } from "../scroll-watch.js";

// A page of the shape the watch reads: the window scrolls the document, and an
// element scrolls its own content when its style lets it. Only what the watch
// touches is modelled.
class FakeElement {
  parentElement: FakeElement | null = null;
  overflowY = "visible";
  ownTop = 0;
  constructor(public scrollHeight: number, public clientHeight: number, public placedAt = 0) {}
  get scrollTop(): number {
    return this.ownTop;
  }
  set scrollTop(value: number) {
    this.ownTop = this.clamped(value);
  }
  // A native scroll call does not go through the scrollTop setter, so neither does the fake's.
  scrollTo(options: { top?: number }): void {
    if (typeof options.top === "number") this.ownTop = this.clamped(options.top);
  }
  scrollBy(options: { top?: number }): void {
    if (typeof options.top === "number") this.ownTop = this.clamped(this.ownTop + options.top);
  }
  clamped(value: number): number {
    return Math.max(0, Math.min(value, this.scrollHeight - this.clientHeight));
  }
  scrollIntoView(_options?: unknown): void {
    const scroller = this.parentElement && this.parentElement.overflowY === "auto" ? this.parentElement : null;
    if (scroller) scroller.ownTop = scroller.clamped(this.placedAt - scroller.clientHeight);
    else page.window.moveTo(this.placedAt - page.window.innerHeight);
  }
}

let page: { window: { scrollY: number; innerHeight: number; moveTo(top: number): void; scrollTo(options: { top?: number }): void; scrollBy(options: { top?: number }): void } & Record<string, unknown>; document: { documentElement: FakeElement; body: FakeElement; scrollingElement: FakeElement } };

function newPage(height: number): ScrollWatchScope & typeof page {
  const documentElement = new FakeElement(height, 700);
  const body = new FakeElement(height, height);
  const window = {
    scrollY: 0,
    innerHeight: 700,
    moveTo(top: number) {
      window.scrollY = Math.max(0, Math.min(top, documentElement.scrollHeight - window.innerHeight));
    },
    scrollTo(options: { top?: number }) {
      if (typeof options.top === "number") window.moveTo(options.top);
    },
    scrollBy(options: { top?: number }) {
      if (typeof options.top === "number") window.moveTo(window.scrollY + options.top);
    }
  } as typeof page.window;
  page = { window, document: { documentElement, body, scrollingElement: documentElement } };
  return { ...page, Element: FakeElement, getComputedStyle: (element: unknown) => ({ overflowY: (element as FakeElement).overflowY }) } as ScrollWatchScope & typeof page;
}

const pastEnd = (scope: { window: Record<string, unknown> }): number => (scope.window["__watch"] as { pastEnd: number }).pastEnd;
const originalProto = Object.getOwnPropertyDescriptors(FakeElement.prototype);
test.afterEach(() => {
  for (const [name, descriptor] of Object.entries(originalProto)) Object.defineProperty(FakeElement.prototype, name, descriptor);
});

test("a window scroll that reaches the page's end is counted; one short of it, or back up, is not", () => {
  const scope = newPage(2000);
  installScrollWatch("__watch", scope);
  scope.window.scrollTo({ top: 500 });
  assert.equal(pastEnd(scope), 0, "short of the end");
  scope.window.scrollTo({ top: 2000 });
  assert.equal(scope.window.scrollY, 1300);
  assert.equal(pastEnd(scope), 1, "asked for the end: live, a feed would load more there");
  scope.window.scrollTo({ top: 2000 });
  scope.window.scrollBy({ top: 400 });
  assert.equal(pastEnd(scope), 3, "both later requests asked past the end");
  scope.window.scrollTo({ top: 0 });
  assert.equal(pastEnd(scope), 3, "scrolling back up is not asking for more");
});

test("a container's scrollTop set to or past its end is counted; one short of it is not", () => {
  const scope = newPage(700);
  installScrollWatch("__watch", scope);
  const feed = new FakeElement(3000, 600);
  feed.overflowY = "auto";
  feed.scrollTop = 100;
  assert.equal(pastEnd(scope), 0);
  feed.scrollTop = feed.scrollHeight;
  assert.equal(feed.scrollTop, 2400);
  assert.equal(pastEnd(scope), 1);
  feed.scrollTop = feed.scrollHeight;
  feed.scrollTo({ top: 5000 });
  feed.scrollBy({ top: 50 });
  assert.equal(pastEnd(scope), 4);
});

test("a list's end scrolled into view counts when it moved anything or left its scroller at the end", () => {
  const scope = newPage(2000);
  installScrollWatch("__watch", scope);
  const middle = new FakeElement(100, 100, 1000);
  middle.parentElement = scope.document.body;
  scope.window.scrollTo({ top: 300 });
  middle.scrollIntoView({ block: "end" });
  assert.equal(scope.window.scrollY, 300);
  assert.equal(pastEnd(scope), 0, "already in view mid-page: nothing moved, so nothing was woken");
  scope.window.scrollTo({ top: 0 });
  middle.scrollIntoView({ block: "end" });
  assert.equal(pastEnd(scope), 1, "it moved the page short of its end: live, a loader under the list wakes there");
  const last = new FakeElement(100, 100, 2000);
  last.parentElement = scope.document.body;
  last.scrollIntoView({ block: "end" });
  assert.equal(pastEnd(scope), 2, "it moved the page to its end");
  last.scrollIntoView({ block: "end" });
  assert.equal(pastEnd(scope), 3, "at the end, though nothing moved");
  last.scrollIntoView({ block: "center" });
  assert.equal(pastEnd(scope), 3, "revealing a target's own box is not asking for more");
});

test("a list's end in a scrolling pane is judged by the pane, not the page", () => {
  const scope = newPage(700);
  installScrollWatch("__watch", scope);
  const pane = new FakeElement(3000, 600);
  pane.overflowY = "auto";
  pane.parentElement = scope.document.body;
  const last = new FakeElement(100, 100, 3000);
  last.parentElement = pane;
  last.scrollIntoView({ block: "end" });
  assert.equal(pane.scrollTop, 2400);
  assert.equal(pastEnd(scope), 1);
});

test("the watch's count lives under the name it was given", () => {
  const scope = newPage(700);
  installScrollWatch("__watch", scope);
  assert.deepEqual(scope.window["__watch"], { pastEnd: 0 });
});
