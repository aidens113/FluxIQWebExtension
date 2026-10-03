// Keeps the chat pinned to its newest content while the person is at the
// bottom (`isAtBottom`), and lets go the moment they scroll up. Following is
// decided by the person's own scrolling, not by the content: content that
// grows below a reader never pulls them down, and "Jump to latest" shows for
// as long as they are away from the bottom.
//
// Only a scroll that moved the view (its `scrollTop` differs from the last
// one the follower wrote or saw) and left it off the bottom ends following.
// A scroll event also fires for the follower's own `scrollTop` write, and
// content can grow between that write and the event's dispatch, so "off the
// bottom" alone is not the person leaving: with the view where the follower
// put it, it is content that grew, and the follower goes back down. Content that grows in place (a card's status changing, a line
// replaced) is followed through a ResizeObserver on the scrolled content.

import { isAtBottom } from "./scroll-follow";

/** What the follower needs of the scrolled element. */
export type ScrollHost = {
  scrollTop: number;
  readonly scrollHeight: number;
  readonly clientHeight: number;
  addEventListener(type: "scroll", listener: () => void, options?: { passive?: boolean }): void;
};

export type ScrollFollower = {
  /** Call after new content is on screen: follows it when the person was at the bottom. */
  contentChanged(): void;
  /** Goes to the bottom and follows from there (a send, or "Jump to latest"). */
  followNow(): void;
  /** Re-reads the position after something the person did changed the height. */
  recheck(): void;
  following(): boolean;
};

/**
 * Follows `host`; `showJump` is told whether "Jump to latest" should show.
 * `content`, the element inside `host` that holds the conversation, is
 * watched for growth where the browser has a ResizeObserver.
 */
export function createScrollFollower(host: ScrollHost, showJump: (show: boolean) => void, content?: Element): ScrollFollower {
  let following = true;
  let lastTop = host.scrollTop;
  let jump = false;
  const setJump = (next: boolean): void => {
    if (next === jump) return;
    jump = next;
    showJump(next);
  };
  const toBottom = (): void => {
    host.scrollTop = host.scrollHeight;
    lastTop = host.scrollTop;
  };
  const contentChanged = (): void => {
    if (following) toBottom();
    setJump(!following && !isAtBottom(host));
  };
  host.addEventListener("scroll", () => {
    const top = host.scrollTop;
    const moved = Math.abs(top - lastTop) >= 1;
    lastTop = top;
    if (isAtBottom(host)) following = true;
    else if (moved) following = false;
    else if (following) toBottom();
    setJump(!following);
  }, { passive: true });
  if (content && typeof ResizeObserver !== "undefined") new ResizeObserver(contentChanged).observe(content);
  return {
    contentChanged,
    followNow() {
      following = true;
      toBottom();
      setJump(false);
    },
    recheck() {
      lastTop = host.scrollTop;
      following = isAtBottom(host);
      setJump(!following);
    },
    following: () => following
  };
}
