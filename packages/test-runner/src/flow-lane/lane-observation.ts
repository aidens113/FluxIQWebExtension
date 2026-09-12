import type { AutomationStudioFailureRecord, EvaluationLane, ExpectedFailure, RunActionLatency, RunEvaluation } from "@fluxiq-web-extension/test-contracts";
import type { PersistedFlowRunOutcome } from "./persisted-flow-run.js";

/**
 * The `RunEvaluation` fields a run can only be observed to have, published by
 * whichever lane ran it. The bench previously inferred the oracle verdict from
 * a failure category, which cannot distinguish "the fixture disagreed" from
 * "the rig broke before the oracle was reached"; the lane knows, so it says.
 */
export type RunLaneObservation = Pick<
  RunEvaluation,
  "lane" | "flowCreated" | "oracleVerdict" | "reportedVerdict" | "automationFailureReported" | "automationFailureExpected" | "harnessActivations" | "actions"
>;

/** The recording lane: it creates no Flow, so `flowCreated` is null and FluxIQ's verdict comes from the Core probe. */
export function recordingLaneObservation(input: {
  oracleVerdict: RunEvaluation["oracleVerdict"];
  reportedVerdict: RunEvaluation["reportedVerdict"];
  automationFailureReported: RunEvaluation["automationFailureReported"];
  automationFailureExpected: ExpectedFailure | null;
  actions: readonly RunActionLatency[];
}): RunLaneObservation {
  return {
    lane: "recording" satisfies EvaluationLane,
    flowCreated: null,
    oracleVerdict: input.oracleVerdict,
    reportedVerdict: input.reportedVerdict,
    automationFailureReported: input.automationFailureReported,
    automationFailureExpected: input.automationFailureExpected,
    harnessActivations: 0,
    actions: [...input.actions],
  };
}

/**
 * The Flow lane. `flowCreated` false means recording, proposal, or approval
 * never produced a runnable Flow, so nothing ran and FluxIQ reported no
 * verdict — the contract requires `reportedVerdict` to be null there.
 */
export function flowLaneObservation(input: {
  flowCreated: boolean;
  oracleVerdict: RunEvaluation["oracleVerdict"];
  run: PersistedFlowRunOutcome | undefined;
  automationFailureExpected: ExpectedFailure | null;
}): RunLaneObservation {
  const run = input.flowCreated ? input.run : undefined;
  return {
    lane: "flow" satisfies EvaluationLane,
    flowCreated: input.flowCreated,
    oracleVerdict: input.oracleVerdict,
    reportedVerdict: run ? reportedVerdict(run) : null,
    automationFailureReported: run ? reportedFailure(run) : null,
    automationFailureExpected: input.automationFailureExpected,
    harnessActivations: run?.harnessActivations ?? 0,
    actions: run ? run.actions.flatMap((action) => (action.durationMs === undefined ? [] : [{ actionType: action.actionType, durationMs: action.durationMs }])) : [],
  };
}

function reportedVerdict(run: PersistedFlowRunOutcome): RunEvaluation["reportedVerdict"] {
  return run.status === "succeeded" && run.actions.every((action) => action.status === "succeeded") && !run.failure ? "passed" : "failed";
}

/** A failed run always carries a category; `ambiguous_or_unknown` when Core recorded no structured record. */
function reportedFailure(run: PersistedFlowRunOutcome): RunEvaluation["automationFailureReported"] {
  if (reportedVerdict(run) === "passed") return null;
  const record: AutomationStudioFailureRecord | null = run.failure;
  if (!record) return { category: "ambiguous_or_unknown" };
  return { category: record.category, ...(record.code === undefined ? {} : { code: record.code }) };
}
