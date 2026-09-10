import type { ExistingFlowAdaptation, ExistingFlow, ExistingFlowSummary, ExistingFluxIQControlClient } from "./existing-fluxiq-control.js";
import { RunnerFailure } from "./failure.js";

export const EXPLORATION_CHECKPOINT_FLOW_PREFIX = "Website Exploration Checkpoint ";

type ExplorationDiscoveryControl = Pick<ExistingFluxIQControlClient,
  "listFlowSummaries" | "listFlowAdaptations" | "getFlowAdaptation"
>;
type ExplorationApplyControl = ExplorationDiscoveryControl & Pick<ExistingFluxIQControlClient,
  "getExactFlow" | "listFlowSubflows" | "getFlowRouter"
>;

export type PendingEvidenceGuidedCreation = Readonly<{
  projectId: string;
  flowId: string;
  flowName: string;
  adaptationId: string;
  blankContentHash: string;
  baseExecutionDigest: string;
}>;

export type AppliedEvidenceGuidedCreation = Readonly<{
  projectId: string;
  flowId: string;
  flowName: string;
  adaptationId: string;
  baseExecutionDigest: string;
  appliedExecutionDigest: string;
}>;

export type RecoverablePendingEvidenceGuidedCreation = PendingEvidenceGuidedCreation & Readonly<{
  checkpoint: Readonly<{
    adaptationId: string; status: "proposed"; provider: "deepseek"; model: "deepseek-chat";
    providerCallCount: number; toolCallCount: number; evidenceBytes: number; toolIds: string[];
    inputTokens: number; outputTokens: number; totalTokens: number; estimatedCostUsd: number;
  }>;
}>;

export async function findPendingEvidenceGuidedCreationForFlow(
  control: ExplorationApplyControl,
  projectId: string,
  summary: ExistingFlowSummary,
): Promise<RecoverablePendingEvidenceGuidedCreation | undefined> {
  const pending = await control.listFlowAdaptations(projectId, summary.flowId, "proposed");
  if (pending.length === 0) return undefined;
  if (pending.length !== 1) fail("Deterministic exploration Flow has ambiguous pending proposals", "exploration_apply.pending_candidate_count");
  const adaptation = await control.getFlowAdaptation(projectId, summary.flowId, pending[0]!.adaptationId);
  assertExactEvidenceGuidedProposal(adaptation);
  const flow = await control.getExactFlow(projectId, summary.flowId);
  await assertUnchangedBlankTopology(control, projectId, summary, flow);
  const binding = adaptation.bootstrapBinding!;
  const evidence = adaptation.evidenceLoop!;
  const accounting = adaptation.accounting!;
  if (evidence.providerCallCount === undefined || accounting.estimatedCostUsd === undefined) {
    fail("Deterministic exploration recovery lacks complete bounded accounting", "exploration_apply.recovery_accounting_invalid");
  }
  return Object.freeze({
    projectId, flowId: summary.flowId, flowName: summary.name, adaptationId: adaptation.adaptationId,
    blankContentHash: flow.contentHash, baseExecutionDigest: binding.baseExecutionDigest!,
    checkpoint: Object.freeze({
      adaptationId: adaptation.adaptationId, status: "proposed" as const, provider: "deepseek" as const, model: "deepseek-chat" as const,
      providerCallCount: evidence.providerCallCount!, toolCallCount: evidence.toolCallCount, evidenceBytes: evidence.evidenceBytes,
      toolIds: [...evidence.toolIds], inputTokens: accounting.inputTokens!, outputTokens: accounting.outputTokens!,
      totalTokens: accounting.totalTokens!, estimatedCostUsd: accounting.estimatedCostUsd!,
    }),
  });
}

export async function locateExactPendingEvidenceGuidedCreation(
  control: ExplorationApplyControl,
  projectId: string,
): Promise<PendingEvidenceGuidedCreation> {
  const checkpointFlows = (await control.listFlowSummaries(projectId))
    .filter(flow => flow.name.startsWith(EXPLORATION_CHECKPOINT_FLOW_PREFIX));
  const candidates: Array<{ summary: ExistingFlowSummary; adaptation: ExistingFlowAdaptation }> = [];
  for (const summary of checkpointFlows) {
    for (const pending of await control.listFlowAdaptations(projectId, summary.flowId, "proposed")) {
      const adaptation = await control.getFlowAdaptation(projectId, summary.flowId, pending.adaptationId);
      if (adaptation.adaptationKind === "flow_bootstrap" && adaptation.evidenceLoop) candidates.push({ summary, adaptation });
    }
  }
  if (candidates.length !== 1) fail("Expected exactly one pending evidence-guided Flow bootstrap proposal in the checkpoint scope", "exploration_apply.pending_candidate_count");
  const { summary, adaptation } = candidates[0]!;
  assertExactEvidenceGuidedProposal(adaptation);
  const flow = await control.getExactFlow(projectId, summary.flowId);
  await assertUnchangedBlankTopology(control, projectId, summary, flow);
  const binding = adaptation.bootstrapBinding!;
  return Object.freeze({
    projectId,
    flowId: summary.flowId,
    flowName: summary.name,
    adaptationId: adaptation.adaptationId,
    blankContentHash: flow.contentHash,
    baseExecutionDigest: binding.baseExecutionDigest!,
  });
}

export async function locateBoundPendingEvidenceGuidedCreation(
  control: ExplorationApplyControl,
  binding: Readonly<{ projectId: string; flowId: string; adaptationId: string }>,
): Promise<PendingEvidenceGuidedCreation> {
  const summary = (await control.listFlowSummaries(binding.projectId)).find(flow => flow.flowId === binding.flowId);
  if (!summary) fail("Bound exploration Flow is unavailable", "exploration_apply.bound_flow_missing");
  const pending = await control.listFlowAdaptations(binding.projectId, binding.flowId, "proposed");
  if (!pending.some(item => item.adaptationId === binding.adaptationId)) fail("Bound exploration proposal is not pending", "exploration_apply.bound_proposal_not_pending");
  const adaptation = await control.getFlowAdaptation(binding.projectId, binding.flowId, binding.adaptationId);
  assertExactEvidenceGuidedProposal(adaptation);
  const flow = await control.getExactFlow(binding.projectId, binding.flowId);
  await assertUnchangedBlankTopology(control, binding.projectId, summary, flow);
  return Object.freeze({
    projectId: binding.projectId,
    flowId: binding.flowId,
    flowName: summary.name,
    adaptationId: binding.adaptationId,
    blankContentHash: flow.contentHash,
    baseExecutionDigest: adaptation.bootstrapBinding!.baseExecutionDigest!,
  });
}

export async function locateLatestAppliedEvidenceGuidedCreation(
  control: ExplorationDiscoveryControl,
  projectId: string,
  options: Readonly<{ allowCurrentExecutionDrift?: boolean }> = {},
): Promise<AppliedEvidenceGuidedCreation> {
  const checkpointFlows = (await control.listFlowSummaries(projectId))
    .filter(flow => flow.name.startsWith(EXPLORATION_CHECKPOINT_FLOW_PREFIX))
    .sort((a, b) => b.updatedAt - a.updatedAt);
  const candidates: Array<{ summary: ExistingFlowSummary; adaptation: ExistingFlowAdaptation }> = [];
  let candidateTimestamp: number | undefined;
  for (const summary of checkpointFlows) {
    if (candidateTimestamp !== undefined && summary.updatedAt < candidateTimestamp) break;
    for (const applied of await control.listFlowAdaptations(projectId, summary.flowId, "applied")) {
      const adaptation = await control.getFlowAdaptation(projectId, summary.flowId, applied.adaptationId);
      if (adaptation.adaptationKind === "flow_bootstrap" && adaptation.evidenceLoop
        && adaptation.bootstrapBinding?.appliedExecutionDigest) {
        candidates.push({ summary, adaptation });
        candidateTimestamp = summary.updatedAt;
      }
    }
  }
  if (!candidates.length) fail("Expected an applied evidence-guided Flow bootstrap in the checkpoint scope", "exploration_apply.applied_candidate_missing");
  const latestTimestamp = Math.max(...candidates.map(candidate => candidate.summary.updatedAt));
  const latest = candidates.filter(candidate => candidate.summary.updatedAt === latestTimestamp);
  if (latest.length !== 1) fail("Latest applied evidence-guided checkpoint is ambiguous", "exploration_apply.applied_candidate_ambiguous");
  const { summary, adaptation } = latest[0]!;
  const binding = adaptation.bootstrapBinding!;
  if (adaptation.status !== "applied" || !binding.baseExecutionDigest || !binding.appliedExecutionDigest || !binding.currentExecutionDigest
    || !options.allowCurrentExecutionDrift && binding.currentExecutionDigest !== binding.appliedExecutionDigest
    || binding.appliedExecutionDigest === binding.baseExecutionDigest) {
    fail("Latest applied evidence-guided checkpoint has an invalid execution binding", "exploration_apply.applied_binding_invalid");
  }
  return Object.freeze({
    projectId,
    flowId: summary.flowId,
    flowName: summary.name,
    adaptationId: adaptation.adaptationId,
    baseExecutionDigest: binding.baseExecutionDigest,
    appliedExecutionDigest: binding.appliedExecutionDigest,
  });
}

export async function locateBoundAppliedEvidenceGuidedCreation(
  control: ExplorationDiscoveryControl,
  binding: Readonly<{ projectId: string; flowId: string; adaptationId: string }>,
  options: Readonly<{ allowCurrentExecutionDrift?: boolean }> = {},
): Promise<AppliedEvidenceGuidedCreation> {
  const summary = (await control.listFlowSummaries(binding.projectId)).find(flow => flow.flowId === binding.flowId);
  if (!summary) fail("Bound exploration Flow is unavailable", "exploration_apply.bound_flow_missing");
  const adaptation = await control.getFlowAdaptation(binding.projectId, binding.flowId, binding.adaptationId);
  const execution = adaptation.bootstrapBinding;
  if (adaptation.status !== "applied" || adaptation.adaptationKind !== "flow_bootstrap" || !adaptation.evidenceLoop
    || !execution?.baseExecutionDigest || !execution.appliedExecutionDigest
    || !options.allowCurrentExecutionDrift && execution.currentExecutionDigest !== execution.appliedExecutionDigest
    || execution.baseExecutionDigest === execution.appliedExecutionDigest) {
    fail("Bound exploration proposal is not the current applied evidence-guided Bootstrap", "exploration_apply.bound_applied_invalid");
  }
  return Object.freeze({
    projectId: binding.projectId,
    flowId: binding.flowId,
    flowName: summary.name,
    adaptationId: binding.adaptationId,
    baseExecutionDigest: execution.baseExecutionDigest,
    appliedExecutionDigest: execution.appliedExecutionDigest,
  });
}

function assertExactEvidenceGuidedProposal(adaptation: ExistingFlowAdaptation): void {
  const evidence = adaptation.evidenceLoop;
  const accounting = adaptation.accounting;
  const binding = adaptation.bootstrapBinding;
  if (adaptation.status !== "proposed" || adaptation.adaptationKind !== "flow_bootstrap" || !evidence) {
    fail("Pending checkpoint adaptation is not an evidence-guided Flow bootstrap proposal", "exploration_apply.wrong_adaptation");
  }
  if (evidence.providerCallCount !== undefined && evidence.providerCallCount < 1
    || evidence.toolCallCount < 1 || evidence.evidenceBytes < 1 || evidence.toolIds.length < 1) {
    fail("Pending checkpoint proposal has no bounded website-evidence audit", "exploration_apply.evidence_audit_invalid");
  }
  if ((adaptation.validationFailedCount ?? 0) !== 0
    || adaptation.validationSucceededCount !== undefined && adaptation.validationSucceededCount < 1) {
    fail("Pending checkpoint proposal did not retain successful validation", "exploration_apply.validation_invalid");
  }
  if (!accounting || accounting.provider !== "deepseek" || accounting.model !== "deepseek-chat"
    || accounting.inputTokens === undefined || accounting.outputTokens === undefined || accounting.totalTokens === undefined
    || accounting.inputTokens + accounting.outputTokens !== accounting.totalTokens) {
    fail("Pending checkpoint proposal has unexpected or inconsistent provider accounting", "exploration_apply.accounting_invalid");
  }
  if (!binding?.baseExecutionDigest || binding.currentExecutionDigest !== binding.baseExecutionDigest || binding.appliedExecutionDigest !== undefined) {
    fail("Pending checkpoint proposal is stale, already applied, or lacks an exact execution binding", "exploration_apply.binding_invalid");
  }
}

async function assertUnchangedBlankTopology(
  control: ExplorationApplyControl,
  projectId: string,
  summary: ExistingFlowSummary,
  flow: ExistingFlow,
): Promise<void> {
  const metadata = flow.document.metadata as Record<string, unknown> | undefined;
  const nodes = Array.isArray(flow.document.nodes) ? flow.document.nodes : undefined;
  const edges = Array.isArray(flow.document.edges) ? flow.document.edges : undefined;
  if (summary.nodeCount !== 0 || summary.edgeCount !== 0 || nodes?.length !== 0 || edges?.length !== 0
    || metadata?.flowRepresentationKind !== "orchestration" || metadata.lastRecordingId !== undefined
    || metadata.subflowGraph !== undefined || metadata.parentFlowId !== undefined || metadata.parentSubflowId !== undefined) {
    fail("Pending checkpoint Flow no longer has the exact blank orchestration topology", "exploration_apply.topology_not_blank");
  }
  if ((await control.listFlowSubflows(projectId, summary.flowId)).length !== 0 || await control.getFlowRouter(projectId, summary.flowId) !== null) {
    fail("Pending checkpoint Flow acquired a Subflow or Router before review", "exploration_apply.ownership_not_blank");
  }
}

function fail(message: string, reasonCode: string): never {
  throw new RunnerFailure("runtime.behavior", message, { details: { reasonCode } });
}
