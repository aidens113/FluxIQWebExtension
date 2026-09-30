// Keeps the chat pinned to its newest content while the person is at the
// bottom (`isAtBottom`), and lets go the moment they scroll up. Following is
// decided by the person's own scrolling, not by the content: content that
// grows below a reader never pulls them down, and "Jump to latest" shows for
// as long as they are away from the bottom.

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
  /** Re-reads the position after something the person did changed the height (an opened fold). */
  recheck(): void;
  following(): boolean;
};

/** Follows `host`; `showJump` is told whether "Jump to latest" should show. */
export function createScrollFollower(host: ScrollHost, showJump: (show: boolean) => void): ScrollFollower {
  let following = true;
  let jump = false;
  const setJump = (next: boolean): void => {
    if (next === jump) return;
    jump = next;
    showJump(next);
  };
  const toBottom = (): void => {
    host.scrollTop = host.scrollHeight;
  };
  host.addEventListener("scroll", () => {
    following = isAtBottom(host);
    setJump(!following);
  }, { passive: true });
  return {
    contentChanged() {
      if (following) toBottom();
      setJump(!following && !isAtBottom(host));
    },
    followNow() {
      following = true;
      toBottom();
      setJump(false);
    },
    recheck() {
      following = isAtBottom(host);
      setJump(!following);
    },
    following: () => following
  };
}
