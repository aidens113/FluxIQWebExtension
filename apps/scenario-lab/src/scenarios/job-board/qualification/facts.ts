import type { JobBoardState } from "../types.js";

/** Complete synthetic account facts; no personal or message contents. */
export function closedJobsAccountFacts(state: JobBoardState): string {
  return JSON.stringify({ saved: [...state.saved], follows: [...state.follows], alertSubscriptions: [...state.alertSubscriptions], applicationCount: state.applications.length });
}
