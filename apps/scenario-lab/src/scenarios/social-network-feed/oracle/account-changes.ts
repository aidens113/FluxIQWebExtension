import type { FeedState } from "../types.js";

/**
 * Every lasting act the account holds, written out in one canonical text: the
 * answer to each friend request, the friend requests and chat messages sent,
 * the group posts waiting for an admin, the posts created, and what was moved
 * to the trash, hidden, liked or shared, with the spam the trap field caught.
 * The overlays' answers and the rate-limit counter are left out, because they
 * are how a run got somewhere, not what it did.
 *
 * Lists are sorted where order is not the act, so two runs that hid the same
 * posts in a different order read the same. A run that did one thing more than
 * asked -- a like, a share, an extra hide -- reads differently, which is what
 * lets a task's final state catch an over-act its table cannot show.
 *
 * It is self-contained -- no imports, no closures -- because the page's script
 * carries it as source (`markup/shell.ts`) to rewrite the element after every
 * change, so the live page reads exactly what a fresh render would.
 */
export function accountChanges(state: FeedState): string {
  const sorted = (values: readonly string[]) => [...values].sort();
  const requests = Object.fromEntries(Object.entries(state.requests).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  return JSON.stringify({
    requests,
    friendRequestsSent: sorted(state.friendRequestsSent),
    chatMessagesSent: state.chatMessagesSent,
    pending: state.pending.map((entry) => ({ group: entry.group, kind: entry.kind, text: entry.text })),
    created: state.created.map((entry) => ({ text: entry.text, audience: entry.audience })),
    trashed: sorted(state.trashed),
    hidden: sorted(state.hidden),
    liked: sorted(state.liked),
    shared: sorted(state.shared),
    spam: state.spam,
  });
}
