// The repair lane: `--replays N`, from a finished Flow run to a proven repair.
//
// The Flow lane builds a Flow, runs it, and lets Core's recovery repair the
// run that failed. What it leaves behind is a proposal, and a proposal is not a
// repair. This is the rest of the loop -- approve it, apply it to the Flow,
// then run that Flow again with no model -- and it lives beside the
// repair's own judgement rather than in the runner, because every step of it is
// a statement about the repair and none of it is about browsers or bundles.
//
// The lane returns the proof and publishes it before it judges it, for the same
// reason the Flow lane publishes its observation first: evidence that is only
// written once the assertions pass cannot explain the run that failed them.
//
// A Flow FluxIQ built from an instruction takes the same lane. Its playback ran
// with the model taking part, so what it leaves is the same kind of
// proposal. Its nodes ask for values the way the created lane answered them,
// so its caller hands in that lane's rule to rebuild its inputs, which keeps
// this lane free of the creation module. (A scenario's declared repair, which
// held a proposal-only run to its proposal, is retired with the proposal-only
// `--llm-task adapt` it served: a launchable run's repair is always tried.)
//
// A re-author Core made and applied inside the run takes it too. Core reaches
// one by two routes -- a wrong answer, and a failed step the patch ladder could
// not adapt -- and both leave the same run marker (`resultRepairOf`). It leaves
// no proposal, so nothing is approved; its replays reproduce the rows the run
// stored when it stored any, and a run that stored none, such as a form task, is
// replayed on its goal alone.
//
// A re-author that was made and *not* kept is the opposite case, and is never
// a proven repair (`unkeptReauthorOf`). Core holds each re-author unapplied for
// the run's judged whole run and then applies it or rejects it with a closed
// reason; one it rejected, or left held and unsettled, changed nothing. The
// lane writes and publishes that, replays nothing, and fails the run.
//
// What the proof must show beyond Core's word (adaptation plan G1, gate P4 and
// P5): the saved Flow's hashes before and after the apply, failing an applied
// repair whose steps did not move (`assertRepairPersisted`); and a known 0
// provider calls on every replay that ran, an unpublished count failing as
// unknown (`assertReplaysAccounted`). From the same reads it writes the run's
// adaptation measurements (`snapshots/adaptation.json`): persistence from the
// run that made the repair, reuse from its first replay.
//
// Every record it writes, and every publish, also says whether the run counts
// toward the adaptation gate (`adaptationGate`, `run-evaluation/adaptation/gate.ts`):
// a `no_proposal` run whose drift was absorbed or never met passes, but never
// quietly as a gate pass (run-mv6v2g3l-a865ead7, t512).
//
// A created Flow whose own judgement failed still reaches this lane: the
// caller hands in `laneFailure` and rethrows its failure afterwards. Nothing is
// approved onto a Flow whose result was judged wrong, so nothing is applied or
// replayed; the lane records what the run saved beside the failure, and the
// run's own adaptations are still measured (run-mv6v2hx5-f448e662, where the
// failure threw before this lane and left no record at all).

import type { RunAdaptationMeasurements, RunHarnessResultReauthor, ScenarioStep } from "@fluxiq-web-extension/test-contracts";
import { RunnerFailure } from "../../failure.js";
import type { FluxIQHttpOptions } from "../../http-control/index.js";
import { adaptationGateLaneFailure, classifyAdaptationGate, measureRepairedRunAdaptations, readRunAdaptationFacts, RUN_ADAPTATION_SNAPSHOT, type AdaptationGateInput } from "../../run-evaluation/adaptation/index.js";
import { writeFlowLaneAdaptationSnapshot } from "../adaptation-snapshot.js";
import { declaredSecretBindingInputs, flowSecretRequests, type DeclaredSecret } from "../declared-secrets.js";
import { declaredUploadInputs, flowUploadRequests } from "../declared-uploads.js";
import { readFlowNodes, type FlowNodeRecord } from "../flow-action-types.js";
import type { RunLaneObservation } from "../lane-observation.js";
import type { PersistedFlowRunOutcome } from "../persisted-flow-run.js";
import { resetScenarioLab } from "../reset-scenario-lab.js";
import { assertRepairPersisted } from "./apply-repair.js";
import { assertLiveRepairProof, proveLiveRepair, type LiveRepairProof, type ProveLiveRepairControl } from "./prove-repair.js";
import { assertReplaysAccounted } from "./replay-repair.js";

/**
 * Why the created Flow's own judgement failed, in closed words only: the
 * runner's failure category, and the failure's code where it names one. Never
 * the message, which may quote page text.
 */
export type LiveRepairLaneFailure = Readonly<{ category: string; code: string | null }>;

/** What the lane needs of the live run: whether it repairs a Flow, and the task and run intent that produced the repair. */
export type LiveRepairRun = { repairsFlow: boolean; describeRepair(): { task: string; purpose: string } };

export type LiveRepairLaneInput = {
  /**
   * `--replays N`, or absent. Absent means the operator asked for none of this,
   * and the lane does nothing at all -- an existing repair run keeps behaving
   * exactly as it did before the option existed.
   */
  replays?: number;
  /** Absent on a provider-free run, which has no repair to apply. */
  live?: LiveRepairRun;
  /**
   * The Flow the lane built and the run it made, which names what the recovery
   * saved. `extracted` is what that run stored, which a re-author's replays
   * must reproduce when it holds at least one dataset (`resultRepairOf`).
   * `runId` is Core's id for that run, from which the adaptation
   * measurements are read; absent, none are written.
   */
  lane: { flowId: string; run: Pick<PersistedFlowRunOutcome, "harnessRecovery"> & Partial<Pick<PersistedFlowRunOutcome, "extracted" | "runId">>; observation?: Pick<RunLaneObservation, "oracleVerdict" | "reportedVerdict"> };
  /**
   * The rule of the lane that built the Flow, for rebuilding the run's inputs
   * from its nodes: a created Flow's (`createdFlowSecretInputs`), whose nodes
   * may carry their parameters flat and which supplies no uploads. Absent, the
   * recorded Flow lane's declared secrets and uploads.
   */
  rebuildInputs?: (nodes: readonly FlowNodeRecord[]) => Record<string, unknown>;
  /**
   * The created Flow ran and its own judgement then failed (its oracle, or a
   * judgement before it). The lane records the run beside it and applies
   * nothing; the caller rethrows its failure. Absent for a run that passed.
   */
  laneFailure?: LiveRepairLaneFailure;
  projectId: string;
  facilityRunId: string;
  projectDomainId?: string;
  scenarioId: string;
  /** The scenario's resolved secrets and the workflow's script, which a recorded Flow was recorded from, to rebuild the run's inputs. */
  secrets: readonly DeclaredSecret[];
  steps: readonly ScenarioStep[];
  scenarioOrigin: string;
  runToken: string;
  /** Arms the variant and loads the start page, as the Flow lane's own hook does. The reset before it is this lane's. */
  prepare: () => Promise<void>;
  /** The fixture oracle for the *repaired* run: the state the scenario declares, never an `adapt` run's proposal-only one. */
  checkGoal: () => Promise<boolean>;
  bundle: { writeStructured(bundlePath: string, value: unknown): Promise<unknown> };
  publish: (details: Record<string, unknown>) => Promise<unknown>;
};

/**
 * Applies and replays the repair, writes `snapshots/repair-lane.json`, and then
 * fails the run if the repair was not reusable. Returns the proof, or
 * `undefined` when the run asked for no replays or produced no repairable
 * proposal. A re-author the run made and did not keep is recorded the same way, with
 * its closed reason, and fails the run before anything is judged or applied.
 */
export async function runLiveRepairLane(
  control: ProveLiveRepairControl,
  input: LiveRepairLaneInput,
  bounds: FluxIQHttpOptions = {},
): Promise<LiveRepairProof | undefined> {
  if (input.replays === undefined || !input.live?.repairsFlow) return undefined;
  const described = input.live.describeRepair();
  if (input.laneFailure) {
    await recordFailedLane(control, { ...input, replays: input.replays, laneFailure: input.laneFailure }, described);
    return undefined;
  }
  const gate = (facts: Pick<AdaptationGateInput, "application" | "replays"> & { unkeptReauthor?: boolean }) =>
    classifyAdaptationGate({ laneFailure: null, recovery: input.lane.run.harnessRecovery, unkeptReauthor: false, ...facts });
  const unkept = unkeptReauthorOf(input.lane.run);
  if (unkept) {
    // Checked before anything else: a proposal or an approval beside it would be judged against a Flow the run's own repair
    // did not change. The record is written and published first, as below.
    const stated = { kept: false, held: unkept.held ?? null, notAppliedReason: unkept.notAppliedReason ?? null };
    const adaptationGate = gate({ unkeptReauthor: true, application: null, replays: [] });
    await input.bundle.writeStructured("snapshots/repair-lane.json", { task: described.task, purpose: described.purpose, repair: "result_reauthor", resultReauthor: { adaptationId: unkept.adaptationId, ...stated }, application: null, replaysRequested: input.replays, replays: [], adaptationGate });
    await input.publish({ repair: "result_reauthor", ...stated, application: null, replaysRequested: input.replays, replays: [], adaptationGate });
    throw new RunnerFailure("runtime.behavior", unkeptMessage(unkept), {
      details: { repair: "result_reauthor", ...stated, ...(unkept.failureCode ? { failureCode: unkept.failureCode } : {}), replaysRequested: input.replays, replays: 0 },
    });
  }
  const resultRepair = resultRepairOf(input.lane.run);
  // Everything the Flow lane's own run was given, rebuilt here because the lane
  // returns its Flow but not the inputs it resolved for it: the same secret
  // bindings and the same uploaded files, keyed by the paths this Flow's nodes
  // ask for. A replay short of them would fail on a missing value, and read as
  // a repair that did not hold.
  //
  // The nodes are read for that and nothing else. A replay needs no action-type
  // map: it judges Core's run status and each attempt's status, and never names
  // an action, so mapping every attempt to the output its node dispatches would
  // be a Core call spent on a label nothing reads.
  const nodes = await readFlowNodes(control, { projectId: input.projectId, flowId: input.lane.flowId }, bounds);
  const proof = await proveLiveRepair(control, {
    projectId: input.projectId,
    flowId: input.lane.flowId,
    facilityRunId: input.facilityRunId,
    ...(input.projectDomainId === undefined ? {} : { domainId: input.projectDomainId }),
    task: described.task,
    purpose: described.purpose,
    recovery: resultRepair ? { ...input.lane.run.harnessRecovery, adaptationIds: [...new Set([...input.lane.run.harnessRecovery.adaptationIds, resultRepair.adaptationId])] } : input.lane.run.harnessRecovery,
    ...(resultRepair?.datasets ? { expectedDatasets: resultRepair.datasets } : {}),
    replays: input.replays,
    inputs: { ...rebuiltInputs(input, nodes), scenarioId: input.scenarioId, facilityRunId: input.facilityRunId },
    // The reset comes first, as it does in the Flow lane: it would otherwise discard the arm.
    prepare: async () => { await resetScenarioLab(input.scenarioOrigin, input.runToken); await input.prepare(); },
    checkGoal: input.checkGoal,
  }, bounds);
  const adaptationGate = gate({ application: proof.application, replays: proof.replays });
  await input.bundle.writeStructured("snapshots/repair-lane.json", { ...proof, adaptationGate });
  const laneRunId = input.lane.run.runId;
  if (laneRunId) {
    // Best effort, like every lane's snapshot: a failed read writes nothing, which reads as unmeasured.
    await writeFlowLaneAdaptationSnapshot({ bundle: input.bundle, path: RUN_ADAPTATION_SNAPSHOT, measure: () => measureRepairLane(control, { projectId: input.projectId, flowId: input.lane.flowId, laneRunId, proof }) });
  }
  await input.publish({
    application: proof.application.outcome,
    adaptations: proof.adaptationIds.length,
    ...(proof.application.flow ? { flowChange: proof.application.flow.change } : {}),
    replaysRequested: proof.replaysRequested,
    ...(resultRepair ? { repair: "result_reauthor" } : {}),
    replays: proof.replays.map((replay) => ({ index: replay.index, outcome: replay.outcome, providerCalls: replay.providerCalls, goalPassed: replay.goalPassed, datasetsReproduced: replay.datasetsReproduced })),
    adaptationGate,
  });
  // Persistence first: a repair that was not kept explains whatever its replays did.
  assertRepairPersisted(proof.application);
  assertLiveRepairProof(proof);
  assertReplaysAccounted(proof.replays);
  return proof;
}

/**
 * The lane of a created Flow whose own judgement failed: what the run saved,
 * beside the failure, with nothing approved, applied or replayed, and the run's
 * own adaptation measurements with no replay to measure reuse from. Written and
 * published, never thrown: the caller's failure is the run's finding.
 */
async function recordFailedLane(
  control: ProveLiveRepairControl,
  input: LiveRepairLaneInput & { replays: number; laneFailure: LiveRepairLaneFailure },
  described: { task: string; purpose: string },
): Promise<void> {
  const recovery = input.lane.run.harnessRecovery;
  const reauthored = resultRepairOf(input.lane.run)?.adaptationId;
  const adaptationIds = [...new Set([...recovery.adaptationIds, ...(reauthored ? [reauthored] : [])])];
  const adaptationGate = classifyAdaptationGate({ laneFailure: adaptationGateLaneFailure(input.lane.observation), recovery, unkeptReauthor: unkeptReauthorOf(input.lane.run) !== undefined, application: null, replays: [] });
  await input.bundle.writeStructured("snapshots/repair-lane.json", {
    task: described.task, purpose: described.purpose, laneFailure: input.laneFailure,
    recoveryAttempted: recovery.attempted, adaptationIds, changeProposalIds: [...recovery.changeProposalIds],
    application: null, replaysRequested: input.replays, replays: [], adaptationGate,
  });
  const laneRunId = input.lane.run.runId;
  if (laneRunId) {
    // Best effort, like the passing lane's: a failed read writes nothing, which reads as unmeasured.
    await writeFlowLaneAdaptationSnapshot({
      bundle: input.bundle, path: RUN_ADAPTATION_SNAPSHOT,
      measure: async () => measureRepairedRunAdaptations({ lane: await readRunAdaptationFacts(control, { projectId: input.projectId, flowId: input.lane.flowId, runId: laneRunId }), replay: null, repairAdaptationIds: adaptationIds }),
    });
  }
  await input.publish({ laneFailure: input.laneFailure, application: null, adaptations: adaptationIds.length, replaysRequested: input.replays, replays: [], adaptationGate });
}

/**
 * The run's adaptation measurements, from the run that made the repair, read
 * now that the repair is applied, and the first replay that ran. Every repair
 * adaptation is read, including one the run did not list as created. Any read
 * that fails throws, and nothing is written.
 */
async function measureRepairLane(
  control: ProveLiveRepairControl,
  input: { projectId: string; flowId: string; laneRunId: string; proof: LiveRepairProof },
  bounds: FluxIQHttpOptions = {},
): Promise<RunAdaptationMeasurements> {
  const lane = await readRunAdaptationFacts(control, { projectId: input.projectId, flowId: input.flowId, runId: input.laneRunId });
  const adaptations = new Map(lane.adaptations);
  for (const adaptationId of input.proof.adaptationIds) {
    if (adaptations.has(adaptationId)) continue;
    const payload = await control.automationStudioCall("get-flow-adaptation", { projectId: input.projectId, flowId: input.flowId, adaptationId }, bounds);
    const adaptation = (payload as { adaptation?: unknown } | null)?.adaptation;
    if (adaptation === null || typeof adaptation !== "object" || Array.isArray(adaptation)) throw new RunnerFailure("runtime.behavior", "Core's payload carried no adaptation record", { details: { reasonCode: "adaptation.payload_malformed" } });
    adaptations.set(adaptationId, adaptation as Record<string, unknown>);
  }
  const replayRunId = input.proof.replays.find((replay) => replay.outcome === "ran" && replay.runId)?.runId;
  const replay = replayRunId ? await readRunAdaptationFacts(control, { projectId: input.projectId, flowId: input.flowId, runId: replayRunId }) : null;
  return measureRepairedRunAdaptations({ lane: { ...lane, adaptations }, replay, repairAdaptationIds: input.proof.adaptationIds });
}

/**
 * The re-author Core made and applied inside the run: its adaptation, and the
 * datasets the repaired run stored, which the lane that built the Flow has
 * already judged.
 *
 * Core re-authors a Flow by two routes, a wrong answer and a failed step the
 * patch ladder made no adaptation for, and both record the same marker
 * (`resultReauthor`, Core `recovery/refuted-result/`): it applies the edit
 * itself and re-runs the same run id, so it leaves no proposal for this lane to
 * approve. Without this the lane found no proposal, replayed nothing and passed
 * -- a repair that had never been replayed read as a proven one. The
 * adaptation is `applied` already, which the application step counts as done;
 * what is left to prove is that the Flow now holds with no model, every time.
 *
 * `datasets` is present only when the run stored at least one dataset, and
 * then each replay must reproduce it. A run that stored none -- a form task, or
 * a run with no extraction recorded -- is not a dataset repair: its replays are
 * judged on zero provider calls, the run succeeding and the fixture goal.
 */
function resultRepairOf(run: LiveRepairLaneInput["lane"]["run"]): { adaptationId: string; datasets?: NonNullable<LiveRepairLaneInput["lane"]["run"]["extracted"]> } | undefined {
  const reauthor = run.harnessRecovery.resultReauthor;
  if (reauthor?.applied !== true || !reauthor.adaptationId) return undefined;
  return { adaptationId: reauthor.adaptationId, ...(run.extracted && run.extracted.length > 0 ? { datasets: run.extracted } : {}) };
}

/**
 * The re-author Core made inside the run and did not keep: the marker names an
 * adaptation on a taken route, and it is not `applied`. Core holds every
 * re-author (`held: true`) until the run's judged whole run settles it, then
 * applies it or records `notAppliedReason`; a held one with neither was never
 * settled. Any of these changed nothing, so it is never a repair to replay --
 * and without this the lane found no proposal and passed with 0 replays.
 *
 * A route that built no adaptation is not this case: there is no re-write to
 * have kept, and it is read as before.
 */
function unkeptReauthorOf(run: LiveRepairLaneInput["lane"]["run"]): (RunHarnessResultReauthor & { adaptationId: string }) | undefined {
  const reauthor = run.harnessRecovery.resultReauthor;
  if (!reauthor?.routed || !reauthor.adaptationId || reauthor.applied === true) return undefined;
  return reauthor as RunHarnessResultReauthor & { adaptationId: string };
}

/** Why there is no repair to replay, in plain words and Core's closed codes only. */
function unkeptMessage(reauthor: RunHarnessResultReauthor): string {
  if (reauthor.notAppliedReason) return `The run re-wrote the Flow, but the re-write was not kept (${reauthor.notAppliedReason}), so there is no repair to replay`;
  if (reauthor.held) return "The run re-wrote the Flow and held the re-write for its judged run, but it was never settled, so it was not kept and there is no repair to replay";
  return `The run re-wrote the Flow, but the re-write was not applied${reauthor.failureCode ? ` (${reauthor.failureCode})` : ""}, so there is no repair to replay`;
}

/**
 * The declared secrets and uploads the Flow's own run was given, keyed by the
 * paths its nodes ask for, by the rule of the lane that built it: the one the
 * caller handed in, or else the recorded lane's secrets and uploads.
 */
function rebuiltInputs(input: LiveRepairLaneInput, nodes: readonly FlowNodeRecord[]): Record<string, unknown> {
  if (input.rebuildInputs) return input.rebuildInputs(nodes);
  return {
    ...declaredSecretBindingInputs({ scenarioId: input.scenarioId, secrets: input.secrets, steps: input.steps, requests: flowSecretRequests(nodes) }),
    ...declaredUploadInputs({ scenarioId: input.scenarioId, steps: input.steps, requests: flowUploadRequests(nodes) }),
  };
}
