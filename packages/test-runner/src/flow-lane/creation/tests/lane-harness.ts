// The created-Flow lane run against a fake Core, as the lane's tests drive it:
// the Scenario Lab reset answered in its producer's shape, a settlement that
// keeps what the build answered unless a test replaces it, and every snapshot
// the lane publishes kept for the test to read. Shared by `lane.test.ts` and
// `lane-candidate.test.ts`.

import type { AutomationStudioAuthoringMode } from "fluxiq/automation-studio";
import { resolveScenarioWorkflow, type LlmActionConsequence, type ResolvedScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import type { DeclaredSecret } from "../../declared-secrets.js";
import type { PersistedFlowLlmExecution } from "../../persisted-flow-run.js";
import type { LabResetFetch } from "../../reset-scenario-lab.js";
import type { CreatedFlowBuild } from "../build-proposal.js";
import { runCreatedFlowLane, type CreatedFlowLaneEntry, type CreatedFlowLaneEvidence, type CreatedFlowLaneIncomplete, type CreatedFlowSettledBuild } from "../lane.js";
import { resolveCreatedFlowRequest, type CreatedFlowRequest } from "../request.js";
import type { UnheldFact } from "../final-state-facts.js";
import { PROJECT_ID, fakeCreationCore } from "./fake-creation-core.js";
import { catalogScenario, datasetTask } from "./scenario-fixture.js";

/** A Scenario Lab reset generation, in the producer's own shape (`../../reset-scenario-lab.ts`). */
const RESET_PROVENANCE = { schemaVersion: "fixture.state.v1", ownerEpoch: "12345678-1234-4123-8123-123456789abc", resetGeneration: 2, mutationSequence: 1 };

export type LaneOptions = {
  request?: CreatedFlowRequest;
  workflow?: ResolvedScenarioWorkflow;
  finalStateHolds?: boolean;
  /** What the oracle names when the final state did not hold. */
  unheldFacts?: readonly UnheldFact[];
  secrets?: readonly DeclaredSecret[];
  /** The settlement's own work; what it answers replaces the build, as a live run's settlement does. */
  settle?: (build: CreatedFlowBuild) => Promise<CreatedFlowSettledBuild | void>;
  authorizeRun?: (flowId: string) => Promise<PersistedFlowLlmExecution>;
  settleRun?: (runId: string | undefined) => Promise<void>;
  /** What the operator permitted the build (`--llm-permit`). */
  permitted?: readonly LlmActionConsequence[];
  /** How the build starts; the direct build unless a test says otherwise. */
  entry?: CreatedFlowLaneEntry;
  /** The mode the run's Core authors in; `legacy` unless a test says otherwise. */
  authoringMode?: AutomationStudioAuthoringMode;
};

export async function runLane(core: ReturnType<typeof fakeCreationCore>, options: LaneOptions = {}) {
  const request = options.request ?? resolveCreatedFlowRequest(catalogScenario, datasetTask());
  const workflow = options.workflow ?? resolveScenarioWorkflow(catalogScenario, { ...(request.workflowId === undefined ? {} : { workflowId: request.workflowId }), ...(request.variantId === undefined ? {} : { variantId: request.variantId }) });
  const settled: CreatedFlowBuild[] = [];
  const evidence: CreatedFlowLaneEvidence[] = [];
  const incomplete: CreatedFlowLaneIncomplete[] = [];
  // The Scenario Lab's reset producer as it answers since t336: the reset packet, then a fresh health read of the same generation. Only the reset is a call the lane makes on purpose.
  const fetchLab: LabResetFetch = async (url, init) => {
    if (init.method === "POST") core.calls.push(`reset:${new URL(url).pathname}`);
    return new Response(JSON.stringify(init.method === "POST" ? { status: "reset", seed: 12, provenance: RESET_PROVENANCE } : { status: "ready", seed: 12, scenarios: ["catalog"], provenance: RESET_PROVENANCE }), { status: 200 });
  };
  const raw = runCreatedFlowLane({
    control: core.control,
    projectId: PROJECT_ID,
    authorizationPin: "test-pin",
    authoringMode: options.authoringMode ?? "legacy",
    request,
    workflow,
    facilityRunId: "run-lab-1",
    scenarioOrigin: "http://127.0.0.1:4100",
    startLocation: "http://127.0.0.1:4100/scenarios/catalog/",
    runToken: "run-token",
    secrets: options.secrets ?? [],
    entry: options.entry ?? { kind: "direct-api" },
    authorizeBuild: async () => { core.calls.push("authorize"); return { permittedConsequences: options.permitted ?? [] }; },
    settleBuild: async (build) => {
      core.calls.push("settle");
      settled.push(build);
      return await options.settle?.(build) ?? { build, instructedConsequencesFrom: build.instructedConsequences === null ? null : "proposal" };
    },
    ...(options.authorizeRun ? { authorizeRun: options.authorizeRun } : {}),
    ...(options.settleRun ? { settleRun: options.settleRun } : {}),
    prepareFlowPage: async () => { core.calls.push("prepare"); },
    recordEvidence: async (published) => { core.calls.push("publish"); evidence.push(published); },
    recordIncompleteEvidence: async (published) => { core.calls.push("publish-incomplete"); incomplete.push(published); },
    judgeFinalState: async () => { core.calls.push("oracle"); return options.finalStateHolds ?? true ? { held: true, unheldFacts: [] } : { held: false, unheldFacts: options.unheldFacts ?? [] }; },
    fetchLab,
  });
  // Every test but the permission-point ones reads a lane that ran a Flow; a stop reaching them is a failure of its own.
  const run = raw.then((lane) => {
    if ("permissionStop" in lane) throw new Error("the lane stopped at a permission point instead of running a Flow");
    return lane;
  });
  void run.catch(() => undefined);
  return { raw, run, settled, evidence, incomplete };
}
