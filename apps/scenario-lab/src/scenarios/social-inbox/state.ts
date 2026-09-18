import { conversationsFor, INBOX_TEAM } from "./conversations.js";
import { applyInboxChanges, inboxCounts } from "./inbox.js";
import { inboxModes, type InboxMode, type InboxState } from "./types.js";

/** Enough history to see what a run did, and a hard stop so a stuck page cannot grow the snapshot without bound. */
const ACTIVITY_LIMIT = 50;
/** As much of a reply as the fixture keeps, so nothing sent to the page can grow the snapshot without bound. */
const REPLY_LIMIT = 500;

/** The inbox as it stands: nothing answered, nothing handed on, the fixture unarmed. The lab seed reaches none of it. */
export function createInboxState(): InboxState {
  return withOracle({ mode: "baseline", replies: [], handled: [], assigned: [], opened: [], activity: [] });
}

/**
 * `reply` records an answer the reply dialog sent; `mark-handled` records
 * conversations closed without a reply; `assign` records ones handed to a
 * teammate; `open-conversation` records a conversation page the run opened;
 * `set-mode` arms one of the renderings and, like every armed fixture here,
 * clears what an earlier run did, so an armed run's oracle is its own and
 * never a stale success from the recording. Anything else, or a payload the
 * page could not have sent, leaves the state alone.
 */
export function mutateInboxState(state: InboxState, operation: string, payload: unknown): InboxState {
  if (!isRecord(payload)) return state;
  if (operation === "set-mode") {
    const mode = inboxModes.find((candidate): candidate is InboxMode => candidate === payload.mode);
    return mode === undefined ? state : withOracle({ mode, replies: [], handled: [], assigned: [], opened: [], activity: [] });
  }
  const known = new Set(conversationsFor(state.mode).map((conversation) => conversation.id));
  if (operation === "reply") {
    const { id, text } = payload;
    if (typeof id !== "string" || !known.has(id) || typeof text !== "string" || text.trim() === "") return state;
    if (state.replies.some((entry) => entry.id === id)) return state;
    return withOracle({
      ...state,
      replies: [...state.replies, { id, text: text.trim().slice(0, REPLY_LIMIT) }],
      activity: append(state.activity, `replied ${id}`),
    });
  }
  if (operation === "mark-handled") {
    const ids = readIds(payload.ids).filter((id) => known.has(id) && !state.handled.includes(id));
    if (ids.length === 0) return state;
    return withOracle({ ...state, handled: [...state.handled, ...ids], activity: append(state.activity, `handled ${ids.length}`) });
  }
  if (operation === "assign") {
    const to = INBOX_TEAM.find((candidate) => candidate === payload.to);
    const ids = readIds(payload.ids).filter((id) => known.has(id));
    if (to === undefined || ids.length === 0) return state;
    const kept = state.assigned.filter((entry) => !ids.includes(entry.id));
    return withOracle({
      ...state,
      assigned: [...kept, ...ids.map((id) => ({ id, to }))],
      activity: append(state.activity, `assigned ${ids.length} ${to}`),
    });
  }
  if (operation === "open-conversation") {
    const { id } = payload;
    return typeof id === "string" && known.has(id) ? { ...state, opened: append(state.opened, id) } : state;
  }
  return state;
}

/** The inbox a rendering would now show, given the run's own changes. */
function withOracle(state: Omit<InboxState, "oracle">): InboxState {
  return { ...state, oracle: inboxCounts(applyInboxChanges(conversationsFor(state.mode), state)) };
}

function readIds(value: unknown): string[] {
  return Array.isArray(value) ? [...new Set(value.filter((entry): entry is string => typeof entry === "string"))] : [];
}

function append(entries: readonly string[], entry: string): string[] {
  return [...entries, entry].slice(-ACTIVITY_LIMIT);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
