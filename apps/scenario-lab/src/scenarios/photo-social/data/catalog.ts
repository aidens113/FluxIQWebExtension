import type { Comment, Post } from "../types.js";
import { chatterFor } from "./chatter.js";
import { COPIED_GIVEAWAY_COMMENTS, GIVEAWAY_COMMENTS, GIVEAWAY_PINNED } from "./giveaway.js";
import { COPIED_GIVEAWAY_POST, NETWORK_POSTS } from "./network-posts.js";
import { GIVEAWAY_POST, STUDIO_POSTS } from "./studio-posts.js";

/** Every post on the site. */
export const ALL_POSTS: readonly Post[] = [...STUDIO_POSTS, ...NETWORK_POSTS];

export function postByCode(code: string): Post | undefined {
  return ALL_POSTS.find((post) => post.code === code);
}

/** A profile's grid: its own posts, never its ads, pinned first and then newest first. */
export function gridFor(handle: string): Post[] {
  const own = ALL_POSTS.filter((post) => post.author === handle && !post.sponsored);
  const pinned = own.filter((post) => post.pinned);
  const rest = own.filter((post) => !post.pinned).sort((a, b) => b.date.localeCompare(a.date));
  return [...pinned, ...rest];
}

/**
 * A post's comments in the order it shows them: the pinned comment first,
 * then newest first. The impersonator's ad carries the same thread as its
 * organic copy, because it is the same scam.
 */
export function commentsFor(post: Post): Comment[] {
  if (post.code === GIVEAWAY_POST.code) return [GIVEAWAY_PINNED, ...GIVEAWAY_COMMENTS];
  if (post.caption === COPIED_GIVEAWAY_POST.caption && post.author === COPIED_GIVEAWAY_POST.author) return [...COPIED_GIVEAWAY_COMMENTS];
  return chatterFor(post);
}

/** Top-level comments and their replies, which is what a post's comment count counts. */
export function commentCount(post: Post): number {
  return commentsFor(post).reduce((total, comment) => total + 1 + comment.replies.length, 0);
}
