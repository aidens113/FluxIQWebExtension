// A budget observation that is not a breach: Core's own per-call reservation
// was smaller than the call turned out to be, while every cap the operator
// declared held. Reported beside the run's usage, never as a failure.

/** One call Core flagged as having supplied more input than it reserved. */
export type LiveLlmBudgetFindingCall = Readonly<{
  /** 1-based position among the itemized calls. */
  call: number;
  requestId: string | null;
  taskKind: string | null;
  /** What the provider reported it was given: Core publishes no reserved figure, so this is the overrun's upper side. */
  suppliedInputTokens: number | null;
  outputTokens: number | null;
}>;

export type LiveLlmBudgetFinding = Readonly<{
  code: "reservation_undercounted";
  /** Core's own count of calls that supplied more than they reserved. */
  overrunCalls: number;
  /** The flagged calls where Core itemized them; empty where only the count was published (a build). */
  calls: readonly LiveLlmBudgetFindingCall[];
  message: string;
}>;
