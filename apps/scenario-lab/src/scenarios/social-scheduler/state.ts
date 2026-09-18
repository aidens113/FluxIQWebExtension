import { queuePostsFor } from "./posts.js";
import { applyChanges, isComposedPost, queueCounts } from "./queue.js";
import { schedulerModes, type SchedulerMode, type SchedulerState } from "./types.js";

/** Enough history to see what a run did, and a hard stop so a stuck page cannot grow the snapshot without bound. */
const ACTIVITY_LIMIT = 50;

/** The workspace as it stands: nothing composed, nothing retried, the console unarmed. The lab seed reaches none of it. */
export function createSchedulerState(): SchedulerState {
  return withOracle({ mode: "baseline", composed: [], retried: [], postViews: [], activity: [] });
}

/**
 * `schedule-post` records a post the composer sent; `retry-posts` records
 * failures the bulk toolbar put back in the queue; `view-post` records a post
 * page the run opened; `set-mode` arms one of the renderings and, like every
 * armed fixture here, clears what an earlier run did, so an armed run's oracle
 * is its own and never a stale success from the recording. Anything else, or a
 * payload the page could not have sent, leaves the state alone.
 */
export function mutateSchedulerState(state: SchedulerState, operation: string, payload: unknown): SchedulerState {
  if (!isRecord(payload)) return state;
  if (operation === "set-mode") {
    const mode = schedulerModes.find((candidate): candidate is SchedulerMode => candidate === payload.mode);
    return mode === undefined ? state : withOracle({ mode, composed: [], retried: [], postViews: [], activity: [] });
  }
  if (operation === "schedule-post") {
    if (!isComposedPost(payload)) return state;
    const composed = { accountSlug: payload.accountSlug, body: payload.body, date: payload.date, time: payload.time };
    return withOracle({
      ...state,
      composed: [...state.composed, composed],
      activity: append(state.activity, `scheduled ${composed.accountSlug} ${composed.date} ${composed.time}`),
    });
  }
  if (operation === "retry-posts") {
    const failed = new Set(queuePostsFor(state.mode).filter((post) => post.status === "Failed").map((post) => post.id));
    const ids = readIds(payload.ids).filter((id) => failed.has(id) && !state.retried.includes(id));
    if (ids.length === 0) return state;
    return withOracle({ ...state, retried: [...state.retried, ...ids], activity: append(state.activity, `retried ${ids.length}`) });
  }
  if (operation === "view-post") {
    const { id } = payload;
    const known = typeof id === "string" && applyChanges(queuePostsFor(state.mode), state.retried, state.composed).some((post) => post.id === id);
    return known && typeof id === "string" ? { ...state, postViews: append(state.postViews, id) } : state;
  }
  return state;
}

/** The queue a rendering would now show, given the run's own changes. */
function withOracle(state: Omit<SchedulerState, "oracle">): SchedulerState {
  return { ...state, oracle: queueCounts(applyChanges(queuePostsFor(state.mode), state.retried, state.composed)) };
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
