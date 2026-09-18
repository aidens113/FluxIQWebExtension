import type { AutomationStudioFailureRecord, EvaluationLane, ExpectedFailure, RunActionLatency, RunActionTiming, RunAutomationFailure, RunEvaluation, RunExtractionMeasurement } from "@fluxiq-web-extension/test-contracts";
import type { PersistedFlowRunOutcome } from "./persisted-flow-run.js";

/**
 * The `RunEvaluation` fields a run can only be observed to have, published by
 * whichever lane ran it. The bench previously inferred the oracle verdict from
 * a failure category, which cannot distinguish "the fixture disagreed" from
 * "the rig broke before the oracle was reached"; the lane knows, so it says.
 */
export type RunLaneObservation = Pick<
  RunEvaluation,
  "lane" | "flowCreated" | "oracleVerdict" | "reportedVerdict" | "automationFailureReported" | "automationFailureExpected" | "harnessActivations" | "actions" | "extraction"
> & {
  /**
   * Core's recovery record for the Flow that ran, `null` when none ran. Both
   * lane builders below state it. It is optional only because the bench's Flow
   * lane (`bench/evaluate-run.ts`, `evaluateFlowRun`) rebuilds its observation
   * member by member and does not yet copy this one; absent, the evaluation
   * records `null` -- not measured -- and never "no recovery".
   */
  harnessRecovery?: RunEvaluation["harnessRecovery"];
};

/**
 * The recording lane: it creates no Flow, so `flowCreated` is null and
 * FluxIQ's verdict comes from the Core probe.
 *
 * `extraction` is `null`, which the contract reads as **not measured** rather
 * than as "no extraction step": this lane asserts each extract step as it runs
 * (`run-scenario.ts`) and publishes no per-step measurement, so a bench states
 * no extraction block for it. Stating `[]` would claim the lane measured
 * extraction and found none, which is a different and false statement.
 */
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
    extraction: null,
    // No Flow ran, so nothing was there for Core to recover.
    harnessRecovery: null,
  };
}

/**
 * The recording lane's observation from what the runner holds when the run
 * ends: the Core action probe's timings, the first failure FluxIQ reported for
 * them, and the lane's own extraction measurements.
 *
 * FluxIQ's verdict is read from the actions it executed. No action, or a lane
 * that could not observe the failure (`automationFailure` undefined), leaves
 * the verdict unknown rather than passing: a run that reported nothing has not
 * reported success. `extraction` is one measurement per `extract` step of the
 * script the lane ran, or `null` when it ran no script at all, which the
 * contract reads as unmeasured; it replaces the `null` `recordingLaneObservation`
 * states because only the run knows which steps ran.
 */
export function recordingLaneProbeObservation(input: {
  oracleVerdict: RunEvaluation["oracleVerdict"];
  actions: readonly RunActionTiming[];
  automationFailure: RunAutomationFailure | null | undefined;
  automationFailureExpected: ExpectedFailure | null;
  extraction: readonly RunExtractionMeasurement[] | null;
}): RunLaneObservation {
  const { actions, automationFailure } = input;
  const reported: Pick<RunLaneObservation, "reportedVerdict" | "automationFailureReported"> = !actions.length || automationFailure === undefined
    ? { reportedVerdict: null, automationFailureReported: null }
    : automationFailure
      ? { reportedVerdict: "failed", automationFailureReported: { category: automationFailure.category, ...(automationFailure.code === undefined ? {} : { code: automationFailure.code }) } }
      : actions.every((action) => action.status === "succeeded")
        ? { reportedVerdict: "passed", automationFailureReported: null }
        : { reportedVerdict: "failed", automationFailureReported: { category: "ambiguous_or_unknown" } };
  return {
    ...recordingLaneObservation({
      oracleVerdict: input.oracleVerdict,
      ...reported,
      automationFailureExpected: input.automationFailureExpected,
      actions: actions.flatMap((action) => (action.durationMs === undefined ? [] : [{ actionType: action.actionType, durationMs: action.durationMs }])),
    }),
    extraction: input.extraction === null ? null : [...input.extraction],
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
  /**
   * One measurement per extract step of the workflow, as the lane judged them
   * against Core's run datasets; `[]` for a workflow with no extract step, and
   * `null` when no Flow ran, since a run that never happened measured nothing.
   */
  extraction?: readonly RunExtractionMeasurement[];
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
    extraction: run && input.extraction ? [...input.extraction] : null,
    // A run that recovered nothing states `attempted: false`; only a run that never happened is unmeasured.
    harnessRecovery: run ? run.harnessRecovery : null,
  };
}

/**
 * The one observation a finished run publishes, chosen in one place.
 *
 * What the Flow lane published wins, whenever it got that far. A run planned
 * on the Flow lane that never reached the publish -- a short proposal, a
 * refused approval, a rig fault before the Flow ran -- is still a Flow-lane
 * run: no Flow was created, so `flowCreated` is false and FluxIQ reported no
 * verdict. That is exactly how the bench scores such a run
 * (`bench/evaluate-run.ts`, `evaluateFlowRun`), so one run read on its own and
 * the same run read as a corpus row agree. Substituting the recording lane's
 * observation here filed a Flow run as `lane: "recording"`, and the category
 * Core reported never reached `evaluation.json`.
 *
 * `evaluated` is false on the existing and clone targets, which run a
 * pre-existing Flow on no evaluation lane and publish nothing. The recording
 * lane's observation is built only when it is the answer.
 */
export function selectLaneObservation(input: {
  evaluated: boolean;
  flowLane: boolean;
  published: RunLaneObservation | undefined;
  automationFailureExpected: ExpectedFailure | null;
  recordingLane: () => RunLaneObservation;
}): RunLaneObservation | undefined {
  if (input.published) return input.published;
  if (!input.evaluated) return undefined;
  if (input.flowLane) return flowLaneObservation({ flowCreated: false, oracleVerdict: null, run: undefined, automationFailureExpected: input.automationFailureExpected });
  return input.recordingLane();
}

/**
 * What FluxIQ reported for the run: its steps, and then whether anyone judged
 * what they produced.
 *
 * A run whose steps did not all succeed is `failed`, as it always was. A run
 * whose steps succeeded is only `passed` when Core also says its result was
 * judged and answered the request. Core recording `unverified` means the run
 * stored a result and reached no model to judge it, and that must not read as
 * a pass: on 2026-09-18 a created Flow returned ten rows of which not one was
 * right, every step succeeded, no model was asked, and the run read `passed`.
 *
 * `no_result` stays `passed`. A Flow that stores no records -- one that signs
 * in, or presses something -- has no result of this kind, and its steps are
 * the whole account of whether it worked; calling it unverified would report
 * a missing judgement of a thing there was nothing to judge. `refuted` cannot
 * normally reach here, because Core fails the session it refutes, and is
 * mapped to `failed` rather than trusted to arrive that way.
 *
 * A run carrying no verification at all is `passed`: nothing claims a
 * judgement was skipped, which is a different fact from Core saying so, and
 * reading it as unverified would relabel every run against a Core that records
 * none.
 */
function reportedVerdict(run: PersistedFlowRunOutcome): RunEvaluation["reportedVerdict"] {
  if (!(run.status === "succeeded" && run.actions.every((action) => action.status === "succeeded") && !run.failure)) return "failed";
  if (run.resultVerification === "refuted") return "failed";
  return run.resultVerification === "unverified" ? "unverified" : "passed";
}

/** A failed run always carries a category; `ambiguous_or_unknown` when Core recorded no structured record. A run nobody judged reported no failure to categorize. */
function reportedFailure(run: PersistedFlowRunOutcome): RunEvaluation["automationFailureReported"] {
  if (reportedVerdict(run) !== "failed") return null;
  const record: AutomationStudioFailureRecord | null = run.failure;
  if (!record) return { category: "ambiguous_or_unknown" };
  return { category: record.category, ...(record.code === undefined ? {} : { code: record.code }) };
}
