import type { StoreState } from "./types.js";

/** Enough history to see what a run did, and a hard stop so a stuck page cannot grow the snapshot without bound. */
const ACTIVITY_LIMIT = 60;

/** The state with one more line in its activity log. */
export function withActivity(state: StoreState, entry: string): StoreState {
  return { ...state, activity: [...state.activity, entry].slice(-ACTIVITY_LIMIT) };
}
