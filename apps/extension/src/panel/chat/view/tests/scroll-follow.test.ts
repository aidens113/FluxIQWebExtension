// Following new content: at the bottom it scrolls into view; scrolled up the
// view stays where the person put it and "Jump to latest" shows, until they
// come back down or press it.

import assert from "node:assert/strict";
import test from "node:test";
import { FOLLOW_SLACK_PX, isAtBottom } from "../scroll-follow";
import { createScrollFollower, type ScrollHost } from "../scroll-follower";

test("at the bottom means within the slack of the very end", () => {
  assert.equal(isAtBottom({ scrollTop: 600, scrollHeight: 1000, clientHeight: 400 }), true);
  assert.equal(isAtBottom({ scrollTop: 600 - FOLLOW_SLACK_PX, scrollHeight: 1000, clientHeight: 400 }), true);
  assert.equal(isAtBottom({ scrollTop: 600 - FOLLOW_SLACK_PX - 1, scrollHeight: 1000, clientHeight: 400 }), false);
  assert.equal(isAtBottom({ scrollTop: 0, scrollHeight: 300, clientHeight: 400 }), true, "content shorter than the view");
});

// A browser clamps `scrollTop` to the bottom; so does this host.
function host(): ScrollHost & { scroll(to: number): void; grow(by: number): void; bottom(): number } {
  let listener: (() => void) | undefined;
  let top = 0;
  const made = {
    get scrollTop() {
      return top;
    },
    set scrollTop(to: number) {
      top = Math.max(0, Math.min(to, made.scrollHeight - made.clientHeight));
    },
    scrollHeight: 400,
    clientHeight: 400,
    addEventListener(_type: "scroll", next: () => void) {
      listener = next;
    },
    scroll(to: number) {
      made.scrollTop = to;
      listener?.();
    },
    grow(by: number) {
      made.scrollHeight += by;
    },
    bottom: () => made.scrollHeight - made.clientHeight
  };
  return made;
}

test("at the bottom, new content is followed and no jump button shows", () => {
  const view = host();
  const jumps: boolean[] = [];
  const follower = createScrollFollower(view, (show) => jumps.push(show));
  view.grow(300);
  follower.contentChanged();
  assert.equal(view.scrollTop, view.bottom());
  assert.deepEqual(jumps, []);
});

test("scrolled up, new content does not move the view and Jump to latest shows", () => {
  const view = host();
  const jumps: boolean[] = [];
  const follower = createScrollFollower(view, (show) => jumps.push(show));
  view.grow(600);
  follower.contentChanged();
  view.scroll(100);
  assert.equal(follower.following(), false);
  assert.deepEqual(jumps, [true]);
  view.grow(200);
  follower.contentChanged();
  assert.equal(view.scrollTop, 100);
  // Jump to latest goes down and follows again.
  follower.followNow();
  assert.equal(view.scrollTop, view.bottom());
  assert.equal(follower.following(), true);
  assert.deepEqual(jumps, [true, false]);
});

test("scrolling back to the bottom by hand follows again", () => {
  const view = host();
  const follower = createScrollFollower(view, () => undefined);
  view.grow(600);
  follower.contentChanged();
  view.scroll(0);
  assert.equal(follower.following(), false);
  view.scroll(view.scrollHeight - view.clientHeight - 10);
  assert.equal(follower.following(), true);
  view.grow(50);
  follower.contentChanged();
  assert.equal(view.scrollTop, view.bottom());
});

test("content that grows after the follower scrolled does not let go: the late scroll event is not the person", () => {
  const view = host();
  const jumps: boolean[] = [];
  const follower = createScrollFollower(view, (show) => jumps.push(show));
  view.grow(600);
  follower.contentChanged();
  const settled = view.scrollTop;
  // A card lands before the follower's own scroll event is dispatched; the
  // event then reports the view off the bottom though nothing moved up.
  view.grow(300);
  view.scroll(settled);
  assert.equal(follower.following(), true);
  assert.deepEqual(jumps, []);
  view.grow(100);
  follower.contentChanged();
  assert.equal(view.scrollTop, view.bottom());
  assert.deepEqual(jumps, []);
});

test("a card growing in place while following ends at the bottom", () => {
  const originalObserver = (globalThis as { ResizeObserver?: unknown }).ResizeObserver;
  const callbacks: Array<() => void> = [];
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver = class {
    constructor(callback: () => void) {
      callbacks.push(callback);
    }
    observe(): void {}
    disconnect(): void {}
  };
  try {
    const view = host();
    const content = {} as Element;
    const follower = createScrollFollower(view, () => undefined, content);
    view.grow(600);
    follower.contentChanged();
    // "Working on it" becomes "Didn't work: ..." without contentChanged().
    view.grow(120);
    for (const callback of callbacks) callback();
    assert.equal(view.scrollTop, view.bottom());
    assert.equal(follower.following(), true);
  } finally {
    (globalThis as { ResizeObserver?: unknown }).ResizeObserver = originalObserver;
  }
});

test("the person scrolling up stops following, is never pulled down, and Jump to latest resumes", () => {
  const view = host();
  const jumps: boolean[] = [];
  const follower = createScrollFollower(view, (show) => jumps.push(show));
  view.grow(600);
  follower.contentChanged();
  view.scroll(view.scrollTop - 200);
  assert.equal(follower.following(), false);
  assert.deepEqual(jumps, [true]);
  const reading = view.scrollTop;
  view.grow(300);
  view.scroll(reading);
  follower.contentChanged();
  assert.equal(view.scrollTop, reading, "a reader is never pulled down");
  assert.equal(follower.following(), false);
  follower.followNow();
  assert.equal(view.scrollTop, view.bottom());
  assert.equal(follower.following(), true);
  assert.deepEqual(jumps, [true, false]);
});
