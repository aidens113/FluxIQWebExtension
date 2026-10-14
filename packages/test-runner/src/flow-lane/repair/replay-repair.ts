// Replaying a repaired Flow, to show the repair is reusable without the model.
//
// A repair that only works while a provider is being paid is not a repair; it
// is an expensive retry. The proof is deterministic reuse: run the applied Flow
// again against the same broken page, with no model (no `runIntent`), and check
// two things -- that Core called no provider, and that the fixture's own goal
// still holds afterwards.
//
// The run carries no `llmExecution`, so Core has nothing to spend a call
// against. The check is still made from Core's own accounting rather than from
// that argument: a replay that somehow reached a provider has to be able to say
// so, and "we did not ask for a model" is an intention, not a measurement.
//
// Accounting Core did not publish is unknown, never 0 (adaptation plan G1):
// "no call" and "nobody counted" are different facts. `lab replay` refuses a
// replay with no accounting (`saved-flow-replay/provider/free-accounting.ts`),
// and `assertReplaysAccounted` refuses the in-run replay on the same rule.
//
// So the accounting is read only once Core has written it. Core saves a run in
// stages: the status its steps earned first, then its verdict on the result --
// and a run that asked no model anything gets its zero accounting in that same
// verdict save (Core `result-verification/run-record.ts`), never earlier. A
// replay read between the two saves finds a finished, succeeded run with no
// accounting on it. That is how run-mv8k9k2e-1f1065a8 failed: its replay ran
// about 48 s, outlived the 30 s request, and the read-back took the first
// terminal read, which landed in the 0.4 s before Core's verdict save. Each
// replay therefore runs through the one rule every replay shares, which waits
// for the verdict (`../replay/provider-free-replay-run.ts`), as `lab replay` does.

import type { ExistingRunDetail } from "../../existing-fluxiq-control.js";
import { classifyRunnerFailure, RunnerFailure, type RunnerFailureCategory } from "../../failure.js";
import type { FluxIQHttpOptions } from "../../http-control/index.js";
import { everyNodeEndedSucceeded } from "../node-recovery.js";
import type { PersistedFlowRunControl, PersistedFlowRunOutcome } from "../persisted-flow-run.js";
import { executeProviderFreeReplayRun } from "../replay/index.js";
import type { FlowRunDataset } from "../run-datasets.js";

/** One replay of the applied Flow. */
export type RepairReplay = Readonly<{
  /** 1 for the first replay, so a message can name it the way an operator counts. */
  index: number;
  /** `ran` means Core started and finished a run; `unreachable` means it could not be run at all. */
  outcome: "ran" | "unreachable";
  runId: string | null;
  /** Core's run status, or the failure category for a replay that could not run. */
  status: string;
  /**
   * Provider calls Core counted for this run. The whole point: it must be a
   * known 0. `null` when Core published no count -- or the replay never ran --
   * which is unknown, and fails the proof (`assertReplaysAccounted`).
   */
  providerCalls: number | null;
  /** LLM interventions Core recorded for this run. Also 0 on a reused repair. */
  harnessActivations: number;
  /** Whether Core called a provider at all, by its count, its itemized calls, or its interventions. */
  modelCalled: boolean;
  /** Whether the fixture's declared final state held after the replay. */
  goalPassed: boolean;
  /**
   * Whether the Flow did everything it was written to do: Core's run
   * succeeded, every step ended well, and no act was left not done
   * (`flowShortfallOf`). It is not "every attempt read succeeded": a step the
   * ladder retried keeps its failed attempt beside the success that followed.
   */
  flowSucceeded: boolean;
  /**
   * Why `flowSucceeded` is false, as a closed word, on a replay that ran:
   * `run_not_succeeded` (Core's run status), `step_not_succeeded` (a step whose
   * last attempt did not end well), `act_not_done` (a step that does a lasting
   * act was skipped and its act was not done, Core t444). Absent otherwise.
   */
  flowShortfall?: "run_not_succeeded" | "step_not_succeeded" | "person_cleared" | "act_not_done";
  /**
   * Whether the replay stored exactly the datasets the judged run stored, row
   * for row. `null` when the lane gave no datasets to reproduce: a page-state
   * repair is judged by the fixture's final state alone.
   */
  datasetsReproduced: boolean | null;
}>;

/**
 * The control a replay needs: run a persisted Flow, and read back what it
 * spent. `getRunDetail` is replaced rather than intersected, because the run
 * control asks only for the four recovery fields and this needs the whole
 * detail -- Core's own provider-call accounting is on it.
 */
export type RepairReplayControl = Omit<PersistedFlowRunControl, "getRunDetail"> & {
  getRunDetail(projectId: string, runId: string, bounds?: FluxIQHttpOptions): Promise<ExistingRunDetail>;
};

export type RepairReplayInput = {
  projectId: string;
  flowId: string;
  facilityRunId: string;
  domainId?: string;
  /** The same inputs the lane's own run was given: declared secrets, uploads and the run's identity. */
  inputs?: Record<string, unknown>;
  /** Attempt node id to the output its Flow node dispatches, so an attempt reads as an action type. */
  actionTypes?: ReadonlyMap<string, string>;
  /** How many times to replay. Zero runs none and is not an error. */
  replays: number;
  /**
   * Puts the page back the way the Flow expects to find it: the scenario lab
   * reset, the variant armed again, the start page loaded. Called before every
   * replay, because the previous one left the page wherever it ended.
   */
  prepare: () => Promise<void>;
  /** The fixture oracle, consulted after each replay. */
  checkGoal: () => Promise<boolean>;
  /**
   * The datasets the lane's own run stored and was judged right on, which each
   * replay must store exactly. A wrong-answer repair is a change to the answer,
   * and the fixture's page state says nothing about an answer: a replay that
   * returned other rows on the same page would otherwise pass.
   */
  expectedDatasets?: readonly FlowRunDataset[];
};

/**
 * Replays the applied Flow, recording each run rather than asserting on it.
 *
 * A replay Core could not run at all is recorded as `unreachable` with the
 * failure's category, and the remaining replays are still attempted: one broken
 * run out of three is a different finding from a repair that never replays, and
 * a loop that stopped at the first could not tell them apart.
 */
export async function replayRepairedFlow(
  control: RepairReplayControl,
  input: RepairReplayInput,
  bounds: FluxIQHttpOptions = {},
): Promise<RepairReplay[]> {
  const replays: RepairReplay[] = [];
  for (let index = 1; index <= input.replays; index += 1) {
    replays.push(await replayOnce(control, input, index, bounds));
  }
  return replays;
}

async function replayOnce(control: RepairReplayControl, input: RepairReplayInput, index: number, bounds: FluxIQHttpOptions): Promise<RepairReplay> {
  let runId: string | null = null;
  try {
    await input.prepare();
    const run = await executeProviderFreeReplayRun(control, {
      projectId: input.projectId,
      flowId: input.flowId,
      facilityRunId: input.facilityRunId,
      ...(input.domainId === undefined ? {} : { domainId: input.domainId }),
      ...(input.inputs ? { inputs: input.inputs } : {}),
      ...(input.actionTypes ? { actionTypes: input.actionTypes } : {}),
      onRunIdentified: (identified) => { runId = identified; },
    }, bounds);
    runId = run.runId;
    // Read from Core's own accounting, not from the absence of a `runIntent`,
    // and only after the verdict save that carries it (`executeProviderFreeReplayRun`).
    const detail = await control.getRunDetail(input.projectId, run.runId, bounds);
    const providerCalls = countedProviderCalls(detail);
    const itemizedCalls = (detail.providerCalls?.length ?? 0) + (detail.providerCallsOmitted ?? 0);
    const goalPassed = await input.checkGoal();
    const flowShortfall = flowShortfallOf(run);
    return {
      index,
      outcome: "ran",
      runId: run.runId,
      status: run.status,
      providerCalls,
      harnessActivations: run.harnessActivations,
      modelCalled: (providerCalls ?? 0) > 0 || itemizedCalls > 0 || run.harnessActivations > 0,
      goalPassed,
      flowSucceeded: flowShortfall === null,
      ...(flowShortfall === null ? {} : { flowShortfall }),
      datasetsReproduced: input.expectedDatasets ? sameDatasets(input.expectedDatasets, run.extracted) : null,
    };
  } catch (error) {
    // The category, never the message: a replay that broke on a read must not
    // put whatever that read said into the bundle.
    const status: RunnerFailureCategory = classifyRunnerFailure(error);
    // No count: a replay that never ran was never counted, and a 0 would read as a measurement.
    return { index, outcome: "unreachable", runId, status, providerCalls: null, harnessActivations: 0, modelCalled: false, goalPassed: false, flowSucceeded: false, datasetsReproduced: input.expectedDatasets ? false : null };
  }
}

/**
 * Fails a proof whose replays ran but whose provider calls Core did not count:
 * whether they called a model is unknown, and an unknown is not the known 0 a
 * reused repair must show (gate P5). A replay that never ran is judged as
 * unreachable by `assertLiveRepairProof`, not here.
 */
export function assertReplaysAccounted(replays: readonly RepairReplay[]): void {
  const unaccounted = replays.filter((replay) => replay.outcome === "ran" && replay.providerCalls === null);
  if (!unaccounted.length) return;
  throw new RunnerFailure("runtime.behavior", `Core published no provider call accounting for ${unaccounted.length} of ${replays.length} replay(s) of the applied Flow, so whether they called a model is unknown`, {
    details: { unaccountedReplays: unaccounted.map((replay) => replay.index) },
  });
}

/**
 * What kept a replay's Flow from succeeding, or `null` when nothing did.
 *
 * A step counts as succeeded when its node's last attempt ended well, by the
 * lane's one rule (`node-recovery.ts`, `everyNodeEndedSucceeded`): it
 * succeeded, possibly after the ladder retried it (run-mv4i1cls-463e4b5c's
 * replay: a press the page refused as busy, `web.action.rate_limited` with
 * effect `unacted`, then pressed again and succeeded); it was skipped as a
 * sometimes-present step that was not there, or passed over because its
 * effect already held or the run had already done it; or a person cleared it.
 * "Every attempt read succeeded" failed that replay on the retry it recovered
 * from, and would fail every skipped popup too.
 *
 * A skip is not enough when the step does a lasting act: Core marks it
 * `notDone` (t444), the run still reads `succeeded`, and the act the Flow
 * exists to do did not happen. Any such attempt fails the replay, even if the
 * same node ran again for another row.
 *
 * A replay proves the repair holds unattended, so a step a person had to clear
 * fails it although the lane's shared rule counts it as ended well.
 */
function flowShortfallOf(run: PersistedFlowRunOutcome): NonNullable<RepairReplay["flowShortfall"]> | null {
  if (run.status !== "succeeded") return "run_not_succeeded";
  if (!everyNodeEndedSucceeded(run.actions)) return "step_not_succeeded";
  if (run.actions.some((action) => action.clearedByPerson === true)) return "person_cleared";
  if (run.actions.some((action) => action.skipped?.reason === "target_absent" && action.skipped.notDone === true)) return "act_not_done";
  return null;
}

/** The same datasets by id, each with the same rows in the same order. */
function sameDatasets(expected: readonly FlowRunDataset[], actual: readonly FlowRunDataset[]): boolean {
  const rows = (datasets: readonly FlowRunDataset[]) => JSON.stringify([...datasets].sort((a, b) => a.datasetId.localeCompare(b.datasetId)).map((dataset) => [dataset.datasetId, dataset.records]));
  return rows(expected) === rows(actual);
}

/**
 * Provider calls Core counted for a run, from its own accounting and never
 * from the runner's belief about the model it did not ask for.
 *
 * Deliberately the narrow question. `live-llm` builds a whole usage record for
 * a run that was authorized to spend; a replay was authorized to spend nothing,
 * and all that has to be established is whether Core counted a call anyway. The
 * two counts are Core's own, most authoritative first: its per-run ledger and
 * its gate's count. Neither published is `null`, as `lab replay` reads it; the
 * per-call lines are not a count (`modelCalled` still reads them as calls).
 */
function countedProviderCalls(detail: ExistingRunDetail): number | null {
  return detail.llmAccounting?.calls ?? detail.providerCallCount ?? null;
}
