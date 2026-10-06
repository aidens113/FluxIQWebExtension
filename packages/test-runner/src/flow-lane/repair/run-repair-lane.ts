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
// proposal; two things differ. Its nodes ask for values the way the created
// lane answered them, so its caller hands in that lane's rule to rebuild its
// inputs, which keeps this lane free of the creation module. And its
// lane judged no declared repair, so this one judges it before anything is
// applied, as `runFlowLane` does for a recorded Flow: a proposal that is
// missing or names the wrong control is never approved onto the Flow.
//
// A re-author Core made and applied inside the run takes it too. Core reaches
// one by two routes -- a wrong answer, and a failed step the patch ladder could
// not adapt -- and both leave the same run marker (`resultRepairOf`). It leaves
// no proposal, so nothing is approved; its replays reproduce the rows the run
// stored when it stored any, and a run that stored none, such as a form task, is
// replayed on its goal alone.

import type { ScenarioStep } from "@fluxiq-web-extension/test-contracts";
import type { FluxIQHttpOptions } from "../../http-control/index.js";
import { declaredSecretBindingInputs, flowSecretRequests, type DeclaredSecret } from "../declared-secrets.js";
import { declaredUploadInputs, flowUploadRequests } from "../declared-uploads.js";
import { readFlowNodes, type FlowNodeRecord } from "../flow-action-types.js";
import type { PersistedFlowRunOutcome } from "../persisted-flow-run.js";
import { resetScenarioLab } from "../reset-scenario-lab.js";
import type { FlowRepairExpectation } from "./declared-repair.js";
import { assertFlowRepair, judgeFlowRepair } from "./judge-repair.js";
import { assertLiveRepairProof, proveLiveRepair, type LiveRepairProof, type ProveLiveRepairControl } from "./prove-repair.js";

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
   */
  lane: { flowId: string; run: Pick<PersistedFlowRunOutcome, "harnessRecovery"> & Partial<Pick<PersistedFlowRunOutcome, "extracted">> };
  /**
   * The rule of the lane that built the Flow, for rebuilding the run's inputs
   * from its nodes: a created Flow's (`createdFlowSecretInputs`), whose nodes
   * may carry their parameters flat and which supplies no uploads. Absent, the
   * recorded Flow lane's declared secrets and uploads.
   */
  rebuildInputs?: (nodes: readonly FlowNodeRecord[]) => Record<string, unknown>;
  /**
   * The repair the scenario declares for this variant, for a Flow whose own
   * lane judged none: judged before anything is applied, and anything but
   * `repaired` fails the run with nothing applied. Absent, nothing is judged
   * here, as for a recorded Flow, whose lane already judged it.
   */
  expectation?: FlowRepairExpectation;
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
 * proposal. With an `expectation`, a proposal judged anything but `repaired` is
 * recorded with `application: null` and fails the run before it is applied.
 */
export async function runLiveRepairLane(
  control: ProveLiveRepairControl,
  input: LiveRepairLaneInput,
  bounds: FluxIQHttpOptions = {},
): Promise<LiveRepairProof | undefined> {
  if (input.replays === undefined || !input.live?.repairsFlow) return undefined;
  const described = input.live.describeRepair();
  const resultRepair = resultRepairOf(input.lane.run);
  // A declared repair describes a runtime patch -- the control a target
  // override should land on -- and says nothing about an answer the re-author
  // rewrote, so it is judged only where the run repaired a step.
  const declaredRepair = input.expectation && !resultRepair
    ? await judgeFlowRepair(control, { projectId: input.projectId, flowId: input.lane.flowId, run: input.lane.run, expectation: input.expectation }, bounds)
    : undefined;
  if (declaredRepair && declaredRepair.verdict !== "repaired") {
    // `application: null`: nothing was approved or applied, because the proposal was not the one to apply.
    await input.bundle.writeStructured("snapshots/repair-lane.json", { task: described.task, purpose: described.purpose, declaredRepair, application: null, replaysRequested: input.replays, replays: [] });
    await input.publish({ declaredRepair: declaredRepair.verdict, application: null });
    assertFlowRepair(declaredRepair);
    return undefined;
  }
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
  await input.bundle.writeStructured("snapshots/repair-lane.json", declaredRepair ? { ...proof, declaredRepair } : proof);
  await input.publish({
    ...(declaredRepair ? { declaredRepair: declaredRepair.verdict } : {}),
    application: proof.application.outcome,
    adaptations: proof.adaptationIds.length,
    replaysRequested: proof.replaysRequested,
    ...(resultRepair ? { repair: "result_reauthor" } : {}),
    replays: proof.replays.map((replay) => ({ index: replay.index, outcome: replay.outcome, providerCalls: replay.providerCalls, goalPassed: replay.goalPassed, datasetsReproduced: replay.datasetsReproduced })),
  });
  assertLiveRepairProof(proof);
  return proof;
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
