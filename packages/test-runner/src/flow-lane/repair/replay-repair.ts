// Replaying a repaired Flow, to show the repair is reusable without the model.
//
// A repair that only works while a provider is being paid is not a repair; it
// is an expensive retry. The proof is deterministic reuse: run the applied Flow
// again against the same broken page, with no execution grant at all, and check
// two things -- that Core called no provider, and that the fixture's own goal
// still holds afterwards.
//
// The run carries no `llmExecution`, so Core has nothing to spend a call
// against. The check is still made from Core's own accounting rather than from
// that argument: a replay that somehow reached a provider has to be able to say
// so, and "we did not pass a grant" is an intention, not a measurement.

import type { ExistingRunDetail } from "../../existing-fluxiq-control.js";
import { classifyRunnerFailure, type RunnerFailureCategory } from "../../failure.js";
import type { FluxIQHttpOptions } from "../../http-control/index.js";
import { executeRecordedFlowRun, type PersistedFlowRunControl } from "../persisted-flow-run.js";

/** One replay of the applied Flow. */
export type RepairReplay = Readonly<{
  /** 1 for the first replay, so a message can name it the way an operator counts. */
  index: number;
  /** `ran` means Core started and finished a run; `unreachable` means it could not be run at all. */
  outcome: "ran" | "unreachable";
  runId: string | null;
  /** Core's run status, or the failure category for a replay that could not run. */
  status: string;
  /** Provider calls Core counted for this run. The whole point: it must be 0. */
  providerCalls: number;
  /** LLM interventions Core recorded for this run. Also 0 on a reused repair. */
  harnessActivations: number;
  /** Whether Core called a provider at all, by either count. */
  modelCalled: boolean;
  /** Whether the fixture's declared final state held after the replay. */
  goalPassed: boolean;
  /** Whether Core's own run and every action attempt succeeded. */
  flowSucceeded: boolean;
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
    const run = await executeRecordedFlowRun(control, {
      projectId: input.projectId,
      flowId: input.flowId,
      facilityRunId: input.facilityRunId,
      ...(input.domainId === undefined ? {} : { domainId: input.domainId }),
      ...(input.inputs ? { inputs: input.inputs } : {}),
      ...(input.actionTypes ? { actionTypes: input.actionTypes } : {}),
      onRunIdentified: (identified) => { runId = identified; },
    }, bounds);
    runId = run.runId;
    // Read from Core's own accounting, not from the absence of a grant.
    const providerCalls = countedProviderCalls(await control.getRunDetail(input.projectId, run.runId, bounds));
    const goalPassed = await input.checkGoal();
    return {
      index,
      outcome: "ran",
      runId: run.runId,
      status: run.status,
      providerCalls,
      harnessActivations: run.harnessActivations,
      modelCalled: providerCalls > 0 || run.harnessActivations > 0,
      goalPassed,
      flowSucceeded: run.status === "succeeded" && run.actions.every((action) => action.status === "succeeded"),
    };
  } catch (error) {
    // The category, never the message: a replay that broke on a read must not
    // put whatever that read said into the bundle.
    const status: RunnerFailureCategory = classifyRunnerFailure(error);
    return { index, outcome: "unreachable", runId, status, providerCalls: 0, harnessActivations: 0, modelCalled: false, goalPassed: false, flowSucceeded: false };
  }
}

/**
 * Provider calls Core counted for a run, from its own accounting and never
 * from the runner's belief about the grant it did not pass.
 *
 * Deliberately the narrow question. `live-llm` builds a whole usage record for
 * a run that was authorized to spend; a replay was authorized to spend nothing,
 * and all that has to be established is whether Core counted a call anyway. The
 * three readings are Core's own, most authoritative first: its per-run ledger,
 * its gate's count, and the per-call lines it itemized.
 */
function countedProviderCalls(detail: ExistingRunDetail): number {
  return detail.llmAccounting?.calls ?? detail.providerCallCount ?? (detail.providerCalls?.length ?? 0) + (detail.providerCallsOmitted ?? 0);
}
