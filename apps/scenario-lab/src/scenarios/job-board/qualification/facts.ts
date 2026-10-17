import type { JobBoardState } from "../types.js";

/**
 * Complete synthetic account facts; no personal or message contents. Every
 * job-board qualification oracle reads them. Saved keys and follows are
 * sorted, so the facts say what the account holds and never the order a run
 * happened to act in.
 */
export function closedJobsAccountFacts(state: JobBoardState): string {
  return JSON.stringify({ saved: [...state.saved].sort(), follows: [...state.follows].sort(), alertSubscriptions: [...state.alertSubscriptions], applicationCount: state.applications.length });
}
