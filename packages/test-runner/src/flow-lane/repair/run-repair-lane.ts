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

import type { ScenarioStep } from "@fluxiq-web-extension/test-contracts";
import type { FluxIQHttpOptions } from "../../http-control/index.js";
import { declaredSecretBindingInputs, flowSecretRequests, type DeclaredSecret } from "../declared-secrets.js";
import { declaredUploadInputs, flowUploadRequests } from "../declared-uploads.js";
import { readFlowNodes } from "../flow-action-types.js";
import type { PersistedFlowRunOutcome } from "../persisted-flow-run.js";
import { resetScenarioLab } from "../reset-scenario-lab.js";
import { assertLiveRepairProof, proveLiveRepair, type LiveRepairProof, type ProveLiveRepairControl } from "./prove-repair.js";

/** What the lane needs of the live run: whether its grant repairs a Flow, and how to name it. */
export type LiveRepairRun = { repairsFlow: boolean; describe(): { task: string; purpose: string } };

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
  projectId: string;
  facilityRunId: string;
  projectDomainId?: string;
  scenarioId: string;
  /** The scenario's resolved secrets and the script the Flow was recorded from, to rebuild the run's inputs. */
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
 * grant.
 */
export async function runLiveRepairLane(
  control: ProveLiveRepairControl,
  input: LiveRepairLaneInput,
  bounds: FluxIQHttpOptions = {},
): Promise<LiveRepairProof | undefined> {
  if (input.replays === undefined || !input.live?.repairsFlow) return undefined;
  const described = input.live.describe();
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
    inputs: {
      ...declaredSecretBindingInputs({ scenarioId: input.scenarioId, secrets: input.secrets, steps: input.steps, requests: flowSecretRequests(nodes) }),
      ...declaredUploadInputs({ scenarioId: input.scenarioId, steps: input.steps, requests: flowUploadRequests(nodes) }),
      scenarioId: input.scenarioId,
      facilityRunId: input.facilityRunId,
    },
    // The reset comes first, as it does in the Flow lane: it would otherwise discard the arm.
    prepare: async () => { await resetScenarioLab(input.scenarioOrigin, input.runToken); await input.prepare(); },
    checkGoal: input.checkGoal,
  }, bounds);
  await input.bundle.writeStructured("snapshots/repair-lane.json", proof);
  await input.publish({
    application: proof.application.outcome,
    adaptations: proof.adaptationIds.length,
    replaysRequested: proof.replaysRequested,
    replays: proof.replays.map((replay) => ({ index: replay.index, outcome: replay.outcome, providerCalls: replay.providerCalls, goalPassed: replay.goalPassed })),
  });
  assertLiveRepairProof(proof);
  return proof;
}
