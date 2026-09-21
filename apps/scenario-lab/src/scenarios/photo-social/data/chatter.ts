import type { Comment, Post } from "../types.js";
import { ACCOUNTS, STUDIO, VIEWER } from "./accounts.js";
import { commentId } from "./shortcode.js";

const LINES = [
  "Beautiful \u{1F60D}", "That glaze!", "Need this in my kitchen", "So calming to watch", "Do you sell these?",
  "The colour on this", "Gorgeous work", "Saving this for inspiration", "Wow", "How long did this take?",
  "Stunning as always", "\u{1F525}\u{1F525}", "Love the texture", "This made my morning", "Where is this?",
] as const;

const PEOPLE = ACCOUNTS.filter((account) => !account.verified && account.handle !== VIEWER && !account.handle.startsWith("harbour") && account.category === "").map(({ handle }) => handle);

function mix(text: string): number {
  let value = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 0x01000193) >>> 0;
  }
  return value;
}

/**
 * The comments under any post that is not a giveaway: a handful of ordinary
 * remarks, chosen from the post's own code so they never change, none of them
 * older than the post. Enough that a post looks lived in, never enough to need
 * loading more.
 */
export function chatterFor(post: Post): Comment[] {
  const seed = mix(post.code);
  const count = post.author === STUDIO ? 2 + (seed % 5) : seed % 4;
  return Array.from({ length: count }, (_, index) => {
    const pick = mix(`${post.code}:${index}`);
    return {
      id: commentId(`${post.code}:chatter:${index}`),
      author: PEOPLE[pick % PEOPLE.length]!,
      date: post.date,
      text: LINES[(pick >>> 5) % LINES.length]!,
      likes: (pick >>> 9) % 4,
      pinned: false,
      replies: [],
    };
  });
}
