import type { DecisionKinds } from "./decision-kinds.js";

/**
 * What an attempt cost in browser calls beside what the saved Flow does, worked out from the run's step folders alone.
 * Every count is of step folders, so it needs no model call and holds for runs made before it existed.
 */
export type AttemptOverhead = Readonly<{
  attempt: number;
  /** Step folders of this attempt that reached the browser. */
  liveBrowserCalls: number;
  /** The saved Flow's browser nodes (control nodes left out), from the run's first deterministic replay; `null` when none ran. */
  flowBrowserCalls: number | null;
  /** `liveBrowserCalls / flowBrowserCalls`; `null` with no live calls or no replay to compare with. */
  overhead: number | null;
  /** Browser calls whose node, parameters (without replay words) and place already occurred in this attempt. */
  repeatedCalls: number;
  /** `core.run_flow` decisions that ran the whole Flow from its first step. */
  wholeFlowRuns: number;
  decisions: DecisionKinds;
}>;
