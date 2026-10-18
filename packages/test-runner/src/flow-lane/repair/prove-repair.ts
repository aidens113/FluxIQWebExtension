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
import { assertReplaysAccounted, replayRepairedFlow, type RepairReplay, type RepairReplayControl, type RepairReplayInput } from "./replay-repair.js";

/** Everything one live repair left behind, as `snapshots/repair-lane.json` states it. */
export type LiveRepairProof = Readonly<{
  /** The Lab task that asked for it: `repair` or `adapt`. */
  task: string;
  /** Core's run intent for that task. */
  purpose: string;
  /** What the run saved, from its recovery record. Identifiers only. */
  adaptationIds: readonly string[];
  changeProposalIds: readonly string[];
  application: RepairApplication;
  /** What `--replays` asked for, beside what ran; an unchanged creation can replay without a repair. */
  replaysRequested: number;
  replays: readonly RepairReplay[];
  /** A passed creation with no recovery reuses its unchanged Flow, without claiming an adaptation. */
  replayOfUnchangedCreation?: true;
}>;

export type ProveLiveRepairControl = RepairApplicationControl & RepairReplayControl;

export type ProveLiveRepairInput = Omit<RepairReplayInput, "replays"> & {
  task: string;
  purpose: string;
  /** The Flow run's recovery record, which names what the run saved. */
  recovery: RunHarnessRecovery;
  /** How many times to replay once the repair is applied. */
  replays: number;
  /** Set only after the creation's whole-run verdicts and absence of recovery were checked. */
  replayOfUnchangedCreation?: true;
};

/**
 * Applies the repair and replays it, returning what happened rather than
 * judging it. Repairs replay only after every adaptation reached `applied`.
 * A separately qualified unchanged creation replays as reuse, not adaptation.
 */
export async function proveLiveRepair(
  control: ProveLiveRepairControl,
  input: ProveLiveRepairInput,
  bounds: FluxIQHttpOptions = {},
): Promise<LiveRepairProof> {
  const adaptationIds = [...input.recovery.adaptationIds];
  const application = await applyLiveRepair(control, { projectId: input.projectId, flowId: input.flowId, adaptationIds }, bounds);
  const replays = application.outcome === "applied" || (application.outcome === "no_proposal" && input.replayOfUnchangedCreation === true)
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
    ...(input.replayOfUnchangedCreation ? { replayOfUnchangedCreation: true as const } : {}),
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
  // Nothing was proposed. A repair/refusal task ends here, correctly; a
  // creation still owes the replay it requested. A re-author the
  // run made and did not keep never reaches this point: the lane fails it
  // first (`run-repair-lane.ts`, `unkeptReauthorOf`), because "no proposal"
  // would read a repair that was thrown away as one that was never needed.
  const unchangedCreation = proof.replayOfUnchangedCreation === true && proof.task === "create-flow"
    && proof.adaptationIds.length === 0 && proof.changeProposalIds.length === 0 && proof.application.outcome === "no_proposal";
  if (proof.application.outcome === "no_proposal" && !proof.replayOfUnchangedCreation) {
    if (proof.task === "create-flow" && proof.replaysRequested > 0) {
      throw new RunnerFailure("runtime.behavior", "The created Flow did not qualify for its requested replay", {
        details: { replaysRequested: proof.replaysRequested, replays: proof.replays.length },
      });
    }
    return;
  }
  if (proof.application.outcome !== "applied" && !unchangedCreation) {
    const statuses = proof.application.adaptations.map((item) => item.statusAfter ?? "unreported");
    const refusals = [...new Set(proof.application.adaptations.flatMap((item) => item.refusedBy ? [item.refusedBy] : []))];
    throw new RunnerFailure("runtime.behavior", `The repair Core proposed could not be applied: ${statuses.length} adaptation(s) ended ${statuses.join(", ")} rather than applied${refusals.length ? ` (a review was refused: ${refusals.join(", ")})` : ""}`, {
      details: { repairApplication: proof.application.outcome, adaptationStatuses: statuses, refusedBy: refusals },
    });
  }
  if (proof.replays.length !== proof.replaysRequested || proof.replays.some((replay, index) => replay.index !== index + 1)) {
    throw new RunnerFailure("runtime.behavior", "The Flow did not produce every requested replay receipt", {
      details: { replaysRequested: proof.replaysRequested, replayIndices: proof.replays.map((replay) => replay.index) },
    });
  }
  if (unchangedCreation) assertReplaysAccounted(proof.replays);
  const subject = unchangedCreation ? "saved Flow" : "applied repair";
  const unreachable = proof.replays.filter((replay) => replay.outcome !== "ran");
  if (unreachable.length) {
    throw new RunnerFailure("runtime.behavior", `Replay ${unreachable[0]!.index} of the applied Flow could not be run (${unreachable[0]!.status})`, {
      details: { replaysRequested: proof.replaysRequested, unreachableReplays: unreachable.map((replay) => replay.index) },
    });
  }
  const called = proof.replays.filter((replay) => replay.modelCalled || replay.harnessActivations > 0 || (replay.providerCalls !== null && replay.providerCalls > 0));
  if (called.length) {
    throw new RunnerFailure("runtime.behavior", `The ${subject} is not deterministic: ${called.length} of ${proof.replays.length} replay(s) called the model`, {
      details: { calledReplays: called.map((replay) => ({ index: replay.index, providerCalls: replay.providerCalls, harnessActivations: replay.harnessActivations })) },
    });
  }
  const reproduced = proof.replays.filter((replay) => replay.datasetsReproduced === false);
  if (reproduced.length) {
    throw new RunnerFailure("runtime.behavior", `The ${unchangedCreation ? "saved" : "repaired"} Flow is not deterministic: ${reproduced.length} of ${proof.replays.length} replay(s) stored other rows than the run that was judged right`, {
      details: { unreproducedReplays: reproduced.map((replay) => ({ index: replay.index, runId: replay.runId, status: replay.status })) },
    });
  }
  // Two separate questions, each named in the message: whether the fixture's
  // final state held, and whether the Flow itself did all it was written to do
  // (`replay-repair.ts`, `flowShortfallOf`). R4b's replay reached the state and
  // was failed on a retry it had recovered from, under a message that said the
  // state was not reached.
  const failed = proof.replays.filter((replay) => !replay.goalPassed || !replay.flowSucceeded);
  if (failed.length) {
    const missedGoal = failed.filter((replay) => !replay.goalPassed).length;
    const unsucceeded = failed.filter((replay) => !replay.flowSucceeded);
    const shortfalls = [...new Set(unsucceeded.map((replay) => replay.flowShortfall ?? "unreported"))];
    const total = proof.replays.length;
    const reasons = [
      ...(missedGoal ? [`${missedGoal} of ${total} replay(s) did not reach the fixture's expected final state`] : []),
      ...(unsucceeded.length ? [`${unsucceeded.length} of ${total} replay(s) ran a Flow that did not succeed (${shortfalls.join(", ")})`] : []),
    ];
    throw new RunnerFailure("runtime.behavior", `The ${subject} did not hold: ${reasons.join("; ")}`, {
      details: { failedReplays: failed.map((replay) => ({ index: replay.index, status: replay.status, goalPassed: replay.goalPassed, flowSucceeded: replay.flowSucceeded, ...(replay.flowShortfall ? { flowShortfall: replay.flowShortfall } : {}) })) },
    });
  }
}
