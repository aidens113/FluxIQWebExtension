// The whole proof of one live repair: approve it, apply it, replay it.
//
// The three steps only mean something together. An approved proposal proves
// nothing on its own; an applied one proves the Flow changed but not that the
// change works; a replay proves it works but only of a change that was really
// applied. So they are sequenced here, and the record they leave is a single
// document a reader can check end to end without opening the code.
//
// A run that proposed nothing is the interesting case. That is exactly what a
// refusal task must do -- the page offers no correct repair, and the model is
// right to leave it alone -- so "no proposal" is recorded as the outcome it is
// and fails nothing here. Whether a proposal *should* have been made is the
// scenario's own expectation, judged where the scenario declares it.

import type { RunHarnessRecovery } from "@fluxiq-web-extension/test-contracts";
import { RunnerFailure } from "../../failure.js";
import type { FluxIQHttpOptions } from "../../http-control/index.js";
import { applyLiveRepair, type RepairApplication, type RepairApplicationControl } from "./apply-repair.js";
import { replayRepairedFlow, type RepairReplay, type RepairReplayControl, type RepairReplayInput } from "./replay-repair.js";

/** Everything one live repair left behind, as `snapshots/repair-lane.json` states it. */
export type LiveRepairProof = Readonly<{
  /** The Lab task that asked for it: `repair` or `adapt`. */
  task: string;
  /** Core's grant purpose for that task. */
  purpose: string;
  /** What the run saved, from its recovery record. Identifiers only. */
  adaptationIds: readonly string[];
  changeProposalIds: readonly string[];
  application: RepairApplication;
  /** What `--replays` asked for, beside what was run: a repair that was never applied is replayed 0 times. */
  replaysRequested: number;
  replays: readonly RepairReplay[];
}>;

export type ProveLiveRepairControl = RepairApplicationControl & RepairReplayControl;

export type ProveLiveRepairInput = Omit<RepairReplayInput, "replays"> & {
  task: string;
  purpose: string;
  /** The Flow run's recovery record, which names what the run saved. */
  recovery: RunHarnessRecovery;
  /** How many times to replay once the repair is applied. */
  replays: number;
};

/**
 * Applies the repair and replays it, returning what happened rather than
 * judging it. Nothing is replayed unless every adaptation reached `applied`:
 * replaying a Flow that was not repaired would measure the unrepaired Flow and
 * report it against the repair.
 */
export async function proveLiveRepair(
  control: ProveLiveRepairControl,
  input: ProveLiveRepairInput,
  bounds: FluxIQHttpOptions = {},
): Promise<LiveRepairProof> {
  const adaptationIds = [...input.recovery.adaptationIds];
  const application = await applyLiveRepair(control, { projectId: input.projectId, flowId: input.flowId, adaptationIds }, bounds);
  const replays = application.outcome === "applied"
    ? await replayRepairedFlow(control, { ...input, replays: input.replays }, bounds)
    : [];
  return {
    task: input.task,
    purpose: input.purpose,
    adaptationIds,
    changeProposalIds: [...input.recovery.changeProposalIds],
    application,
    replaysRequested: input.replays,
    replays,
  };
}

/**
 * Fails a run whose repair was not reusable, after the proof was published.
 *
 * `runtime.behavior` throughout: what Core proposed, whether it could be
 * applied, and whether the applied Flow then runs without a model are all the
 * behaviour under test, not a fault of the rig.
 */
export function assertLiveRepairProof(proof: LiveRepairProof): void {
  // Nothing was proposed. A refusal task ends here, correctly.
  if (proof.application.outcome === "no_proposal") return;
  if (proof.application.outcome !== "applied") {
    const statuses = proof.application.adaptations.map((item) => item.statusAfter ?? "unreported");
    const refusals = [...new Set(proof.application.adaptations.flatMap((item) => item.refusedBy ? [item.refusedBy] : []))];
    throw new RunnerFailure("runtime.behavior", `The repair Core proposed could not be applied: ${statuses.length} adaptation(s) ended ${statuses.join(", ")} rather than applied${refusals.length ? ` (a review was refused: ${refusals.join(", ")})` : ""}`, {
      details: { repairApplication: proof.application.outcome, adaptationStatuses: statuses, refusedBy: refusals },
    });
  }
  const unreachable = proof.replays.filter((replay) => replay.outcome !== "ran");
  if (unreachable.length) {
    throw new RunnerFailure("runtime.behavior", `Replay ${unreachable[0]!.index} of the applied Flow could not be run (${unreachable[0]!.status})`, {
      details: { replaysRequested: proof.replaysRequested, unreachableReplays: unreachable.map((replay) => replay.index) },
    });
  }
  const called = proof.replays.filter((replay) => replay.modelCalled);
  if (called.length) {
    throw new RunnerFailure("runtime.behavior", `The applied repair is not deterministic: ${called.length} of ${proof.replays.length} replay(s) called the model`, {
      details: { calledReplays: called.map((replay) => ({ index: replay.index, providerCalls: replay.providerCalls, harnessActivations: replay.harnessActivations })) },
    });
  }
  const failed = proof.replays.filter((replay) => !replay.goalPassed || !replay.flowSucceeded);
  if (failed.length) {
    throw new RunnerFailure("runtime.behavior", `The applied repair did not hold: ${failed.length} of ${proof.replays.length} replay(s) did not reach the fixture's expected final state`, {
      details: { failedReplays: failed.map((replay) => ({ index: replay.index, status: replay.status, goalPassed: replay.goalPassed, flowSucceeded: replay.flowSucceeded })) },
    });
  }
}
