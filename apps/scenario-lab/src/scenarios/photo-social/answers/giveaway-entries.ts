import { GIVEAWAY_CLOSES, STUDIO } from "../data/index.js";
import type { Comment } from "../types.js";

export type GiveawayEntry = { entrant: string; comment: string; date: string };

const MENTION = /@([a-z0-9._]+[a-z0-9_])/gu;

/** The friends a comment tags: every account it mentions except the studio and the commenter, each once. */
export function friendsTagged(comment: Pick<Comment, "author" | "text">): string[] {
  const mentioned = [...comment.text.matchAll(MENTION)].map((match) => match[1]!);
  return [...new Set(mentioned.filter((handle) => handle !== STUDIO && handle !== comment.author))];
}

/** Whether one comment or reply qualifies on its own, before "one entry per person" is applied. */
export function qualifies(comment: Pick<Comment, "author" | "text" | "date">): boolean {
  return comment.author !== STUDIO && friendsTagged(comment).length >= 2 && comment.date <= GIVEAWAY_CLOSES;
}

/**
 * The entries a thread holds under the pinned rules, in the order the counted
 * comments appear once every comment and reply is loaded.
 *
 * The thread is listed newest first and replies oldest first under their
 * comment, so a person's first qualifying comment is the last of theirs in
 * document order. Each person counts once, at that comment.
 */
export function giveawayEntries(thread: readonly Comment[]): GiveawayEntry[] {
  const documentOrder = thread.flatMap((comment) => [comment, ...comment.replies]);
  const counted = new Map<string, Comment>();
  for (const comment of [...documentOrder].reverse()) {
    if (!counted.has(comment.author) && qualifies(comment)) counted.set(comment.author, comment);
  }
  const chosen = new Set(counted.values());
  return documentOrder.filter((comment) => chosen.has(comment)).map(({ author, text, date }) => ({ entrant: author, comment: text, date }));
}
