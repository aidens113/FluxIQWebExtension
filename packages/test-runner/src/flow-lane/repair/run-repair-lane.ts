// The repair lane: `--replays N`, from a finished Flow run to a proven repair.
//
// The Flow lane builds a Flow, runs it, and lets Core's recovery repair the
// run that failed. What it leaves behind is a proposal, and a proposal is not a
// repair. This is the rest of the loop -- approve it, apply it to the Flow,
// then run that Flow again with no execution grant -- and it lives beside the
// repair's own judgement rather than in the runner, because every step of it is
// a statement about the repair and none of it is about browsers or bundles.
//
// The lane returns the proof and publishes it before it judges it, for the same
// reason the Flow lane publishes its observation first: evidence that is only
// written once the assertions pass cannot explain the run that failed them.
//
// A Flow FluxIQ built from an instruction takes the same lane. Its playback ran
// under a proposal-only repair grant, so what it leaves is the same kind of
// proposal; two things differ. Its nodes ask for values the way the created
// lane answered them, so its caller hands in that lane's rule to rebuild its
// inputs, which keeps this lane free of the creation module. And its
// lane judged no declared repair, so this one judges it before anything is
// applied, as `runFlowLane` does for a recorded Flow: a proposal that is
// missing or names the wrong control is never approved onto the Flow.

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

/** What the lane needs of the live run: whether its grant repairs a Flow, and the task and grant purpose that produced the repair. */
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
  /** The Flow the lane built and the run it made, which names what the recovery saved. */
  lane: { flowId: string; run: Pick<PersistedFlowRunOutcome, "harnessRecovery"> };
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
 * grant. With an `expectation`, a proposal judged anything but `repaired` is
 * recorded with `application: null` and fails the run before it is applied.
 */
export async function runLiveRepairLane(
  control: ProveLiveRepairControl,
  input: LiveRepairLaneInput,
  bounds: FluxIQHttpOptions = {},
): Promise<LiveRepairProof | undefined> {
  if (input.replays === undefined || !input.live?.repairsFlow) return undefined;
  const described = input.live.describeRepair();
  const declaredRepair = input.expectation
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
    recovery: input.lane.run.harnessRecovery,
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
    replays: proof.replays.map((replay) => ({ index: replay.index, outcome: replay.outcome, providerCalls: replay.providerCalls, goalPassed: replay.goalPassed })),
  });
  assertLiveRepairProof(proof);
  return proof;
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
