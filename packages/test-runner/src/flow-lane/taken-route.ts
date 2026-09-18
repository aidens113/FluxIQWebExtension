// Which route a Flow run took, and why, read from Core's run detail.
//
// A Flow with a Router runs one Subflow, chosen before any step by rules over
// the run's inputs and the state Core's host observed. Without this a bundle
// said which actions ran and nothing about why those and not others, so a
// Flow that always took one route -- whatever the page showed -- looked the
// same as one that chose. Core records each rule's verdict and the matcher's
// reason, which names the path and the test and never a value it read; this
// copies those and the ids beside them, and nothing else.

export type FlowRunRoute = Readonly<{
  selectedRuleId: string | null;
  selectedSubflowId: string | null;
  fallbackUsed: boolean;
  rejectedRuleIds: readonly string[];
  evaluations: ReadonlyArray<Readonly<{ ruleId: string; matched: boolean; reason: string }>>;
  /** Whether the host observed the state the rules read; `null` when Core did not say. */
  stateObserved: boolean | null;
  statePaths: readonly string[];
}>;

const MAX_EVALUATIONS = 16;
const MAX_REASON_LENGTH = 300;

/** The run's first route decision, or `null` for a run no Router decided. */
export function readFlowRunRoute(runDetail: Readonly<Record<string, unknown>>): FlowRunRoute | null {
  const decisions = Array.isArray(runDetail.routeDecisions) ? runDetail.routeDecisions : [];
  const decision = record(decisions[0]);
  if (!decision) return null;
  const metadata = record(decision.metadata);
  const routeState = record(metadata?.routeState);
  const evaluations = (Array.isArray(metadata?.evaluations) ? metadata.evaluations : []).slice(0, MAX_EVALUATIONS).flatMap((value) => {
    const evaluation = record(value);
    if (typeof evaluation?.ruleId !== "string" || typeof evaluation.matched !== "boolean") return [];
    return [{ ruleId: evaluation.ruleId, matched: evaluation.matched, reason: typeof evaluation.reason === "string" ? evaluation.reason.slice(0, MAX_REASON_LENGTH) : "" }];
  });
  return {
    selectedRuleId: typeof decision.selectedRuleId === "string" ? decision.selectedRuleId : null,
    selectedSubflowId: typeof decision.selectedSubflowId === "string" ? decision.selectedSubflowId : null,
    fallbackUsed: decision.fallbackUsed === true,
    rejectedRuleIds: strings(decision.rejectedRuleIds),
    evaluations,
    stateObserved: typeof routeState?.observed === "boolean" ? routeState.observed : null,
    statePaths: strings(routeState?.paths),
  };
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").slice(0, MAX_EVALUATIONS) : [];
}
