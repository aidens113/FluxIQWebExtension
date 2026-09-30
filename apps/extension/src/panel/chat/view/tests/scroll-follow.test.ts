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

function host(): ScrollHost & { scroll(to: number): void; grow(by: number): void } {
  let listener: (() => void) | undefined;
  const made = {
    scrollTop: 0,
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
    }
  };
  return made;
}

test("at the bottom, new content is followed and no jump button shows", () => {
  const view = host();
  const jumps: boolean[] = [];
  const follower = createScrollFollower(view, (show) => jumps.push(show));
  view.grow(300);
  follower.contentChanged();
  assert.equal(view.scrollTop, view.scrollHeight);
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
  assert.equal(view.scrollTop, view.scrollHeight);
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
  assert.equal(view.scrollTop, view.scrollHeight);
});
