// The trial ports an offline trial runs with: the ports a live whole-candidate
// trial of a build gets, made from the host's own Automation Studio service.
//
// Core builds them inline, inside the build command, from the service's own
// collaborators (`runtime/service.ts`, the `trialEnvironment` of a candidate
// or project build, beside `project-build/whole-trials.ts`, which adds the
// build's trial reads and its judge). Nothing exports that construction, so it
// is mirrored here member by member over the very same objects: the flow and
// its dependency digest, the catalogue's publications, the runtime session
// store, the executor options (`automationStudioRunGraphOptions` with the
// service's IO, RuntimeService, native node runtime, host runtime, run
// datasets and conversation parking), dataset processing, the record sets, the
// run detail's action attempts, and the bound domain's trial reads. The
// service keeps those collaborators in TypeScript-private fields; they are
// read through the narrow view below and nothing on them is changed.
//
// Two members differ from a live build's, both by design:
// - `judge` is the experiment's (`../not-judged-judge.ts`): no model is called;
// - `prepareStart` is left out: the offline runner runs no start hook and no
//   site reset for a trace environment (Decision 6), and no hook is configured.
// `observedStateKeys` is the bound domain's declaration (its evidence runtime
// binding's), which is what a build's harness options carry for the web domain.

import type { AutomationStudioFlowArtifact, AutomationStudioOfflineCandidateTrialInput, AutomationStudioRuntimeSession, AutomationStudioService } from "fluxiq/automation-studio";
import { readRecordSets } from "fluxiq/automation-studio";
import type { CoreTrialSeams } from "../core-trial-seams.js";

/** The candidate trial's ports, which the package names only through the offline runner's input. */
export type OfflineTrialPorts = AutomationStudioOfflineCandidateTrialInput["ports"];
type AutomationStudioCandidateTrialPorts = OfflineTrialPorts;
type RecordSetReads = Parameters<typeof readRecordSets>[0];

/** The service collaborators the trial environment is made of, as Core's build command reads them (`service.ts`). */
type ServiceInternals = {
  ioRuntime?: unknown;
  runtimeService?: unknown;
  nativeNodeRuntime?: { sdk: { nodes: NonNullable<AutomationStudioCandidateTrialPorts["registry"]> }; getRegistryResolution(scope: AutomationStudioFlowArtifact["scope"]): AutomationStudioCandidateTrialPorts["resolution"] };
  hostRuntime?: unknown;
  llmEvidenceRuntime?: { observedStateKeys?: readonly string[] };
  catalogue: { listPublishedFlowSnapshots(): ReturnType<AutomationStudioCandidateTrialPorts["snapshots"]>; listFlowPublicationRecords(): Promise<Array<{ status: string; flowId: string; version: unknown }>> };
  runDatasets: {
    available: boolean;
    recordBatchHandler(projectId: string, runId: string): unknown;
    processEndedRunDatasets(input: { projectId: string; runId: string }): Promise<void>;
    listRunDatasets: NonNullable<RecordSetReads["listRunDatasets"]>;
    getRunDatasetPage: NonNullable<RecordSetReads["getRunDatasetPage"]>;
  };
  conversations: { available: boolean; parkingPort(input: { projectId: string; subject: { kind: "run"; id: string } }): unknown };
  getFlow(projectId: string, flowId: string): Promise<AutomationStudioFlowArtifact>;
  getLlmExecutionDependencyDigest(projectId: string, flowId: string): Promise<string>;
  startRuntimeSession(input: { projectId: string; flowId: string; runId: string; metadata: Record<string, unknown> }): Promise<AutomationStudioRuntimeSession>;
  writeRuntimeSession(projectId: string, session: AutomationStudioRuntimeSession): Promise<void>;
};

export async function offlineTrialPorts(input: {
  service: AutomationStudioService;
  seams: CoreTrialSeams;
  projectId: string;
  flowId: string;
  sourceInstructionIds: readonly string[];
  startLocation: string;
  judge: AutomationStudioCandidateTrialPorts["judge"];
}): Promise<AutomationStudioCandidateTrialPorts> {
  const { projectId, flowId, seams } = input;
  const service = input.service as unknown as ServiceInternals;
  const native = service.nativeNodeRuntime;
  if (!native) throw new Error("The host bound no native node runtime: the web domain's host entry did not run");
  const parent = await service.getFlow(projectId, flowId);
  const datasets = service.runDatasets;
  return {
    projectId, flowId, sourceInstructionIds: [...input.sourceInstructionIds], startLocation: input.startLocation,
    registry: native.sdk.nodes,
    resolution: native.getRegistryResolution(parent.scope),
    parentFlow: () => service.getFlow(projectId, flowId),
    currentBaseDigest: () => service.getLlmExecutionDependencyDigest(projectId, flowId),
    snapshots: () => service.catalogue.listPublishedFlowSnapshots(),
    deprecatedPublicationIds: async () => (await service.catalogue.listFlowPublicationRecords()).filter((record) => record.status === "deprecated").map((record) => `${record.flowId}@${String(record.version)}`),
    openSession: ({ runId, metadata }) => service.startRuntimeSession({ projectId, flowId, runId, metadata }),
    writeSession: (session) => service.writeRuntimeSession(projectId, session),
    graphOptions: ({ runId, signal }) => seams.runGraphOptions({
      signal, io: service.ioRuntime, runtimeService: service.runtimeService, authorizedDomainIds: [], nativeNodeRuntime: native, hostRuntime: service.hostRuntime,
      ...(datasets.available ? { onRecordBatch: datasets.recordBatchHandler(projectId, runId) } : {}),
      ...(service.conversations.available ? { parking: service.conversations.parkingPort({ projectId, subject: { kind: "run", id: runId } }) } : {}),
    }),
    processDatasets: (runId) => datasets.processEndedRunDatasets({ projectId, runId }),
    recordSets: (runId) => readRecordSets(datasets.available ? { listRunDatasets: (request) => datasets.listRunDatasets(request), getRunDatasetPage: (request) => datasets.getRunDatasetPage(request) } : {}, projectId, runId),
    actionAttempts: (session) => seams.runDetail(session, projectId).actionAttempts,
    ...(service.llmEvidenceRuntime?.observedStateKeys ? { observedStateKeys: service.llmEvidenceRuntime.observedStateKeys } : {}),
    ...seams.trialReads(service.llmEvidenceRuntime, projectId, flowId),
    judge: input.judge,
  };
}
