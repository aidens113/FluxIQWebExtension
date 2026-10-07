import type { FeedState } from "../types.js";

/** Complete synthetic account facts; no personal or message contents. */
export function requestAuditAccountFacts(state: FeedState): string {
  return JSON.stringify({ requests: Object.fromEntries(Object.entries(state.requests).sort(([a], [b]) => a.localeCompare(b))), friendRequestsSent: [...state.friendRequestsSent], chatMessagesSent: state.chatMessagesSent, pendingCount: state.pending.length, createdCount: state.created.length, trashed: [...state.trashed], hidden: [...state.hidden], liked: [...state.liked], shared: [...state.shared], spam: state.spam });
}
