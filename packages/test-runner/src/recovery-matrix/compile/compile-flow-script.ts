// Turns a matrix case's candidate script into a saved Flow, through Core's own
// path and nothing else.
//
// A model's script reaches a saved Flow in four steps, and so does this one:
// `acceptAutomationStudioFlowBootstrapResult` assembles it (the one acceptor
// every reply goes through), `validateAutomationStudioFlowBootstrapPlan`
// validates it against the web node library, `createFlowBootstrapAdaptation`
// normalises it into the Flow's Router, Subflows and graphs, and an approve and
// an apply save them. No graph, node or edge is written here. What differs from
// a build is only who wrote the script and that no evidence was gathered, so the
// script names elements by literal selectors (`./evidence-handles.ts`).
//
// It runs in this process against the workspace's FluxIQ root while that
// workspace's Core is stopped, as the coordinator already does to create the
// workspace's identity (`coordinator.ts`, `ensureBootstrapIdentity`). The Core
// started afterwards reads the saved Flow from its own storage.

import { FluxIQ } from "fluxiq";
import { acceptAutomationStudioFlowBootstrapResult, automationStudioFlowBootstrapSizeLimitsOf, validateAutomationStudioFlowBootstrapPlan } from "fluxiq/automation-studio";
import { WEB_AUTOMATION_DOMAIN_ID, webAutomationDomain } from "@fluxiq-web-extension/domain/node";
import { RunnerFailure } from "../../failure.js";
import { planEvidenceHandles, type PlanEvidenceHandle } from "./evidence-handles.js";
import { webNodeRuntime } from "./web-node-runtime.js";

export type CompiledMatrixFlow = Readonly<{
  flowId: string;
  adaptationId: string;
  /** Node count per saved Subflow, in plan order, with the Subflow's role. */
  subflows: readonly Readonly<{ key: string; role: string; nodes: number }>[];
  /**
   * Every step as the plan placed it, in plan order: its Subflow and node key
   * (the saved node id ends `.<subflowKey>.<nodeKey>`), its node definition,
   * whether it declared a lasting consequence, and an End's result. What a
   * check needs to read a run's attempts against the Flow, and nothing the
   * page showed.
   */
  steps: readonly MatrixFlowStep[];
  /** The capabilities the saved Flow declares it needs (`metadata.requires`, Core C10). */
  requires: readonly string[];
  /** Core's warnings about the script, by code; a refused script throws instead. */
  warnings: readonly string[];
}>;

export type MatrixFlowStep = Readonly<{ subflowKey: string; nodeKey: string; definitionId: string; lasting: boolean; endStatus?: string }>;

export type CompileMatrixFlowInput = {
  /** The workspace's FluxIQ root: the directory holding `.fluxiq`. */
  fluxiqRoot: string;
  projectId: string;
  flowId: string;
  flowName: string;
  script: string;
};

/** Thrown when the script names an evidence handle: the row cannot be hand-authored as written. */
export class MatrixAuthoringGap extends RunnerFailure {
  readonly handles: readonly PlanEvidenceHandle[];
  constructor(handles: readonly PlanEvidenceHandle[]) {
    super("fixture.invalid", `The script names ${handles.length} element(s) by an evidence handle (${handles.map(item => item.handle).join(", ")}), which a hand-authored Flow has no exploration to resolve`, { details: { handles: handles.map(item => item.path) } });
    this.handles = handles;
  }
}

/** Saves the script as a Flow in `projectId` and answers what was saved. Throws when Core refuses it. */
export async function compileMatrixFlow(input: CompileMatrixFlowInput): Promise<CompiledMatrixFlow> {
  const native = webNodeRuntime();
  const fluxiq = FluxIQ.create({ rootDir: input.fluxiqRoot, loadEnv: false, domainId: WEB_AUTOMATION_DOMAIN_ID, modelProvidersEnabled: false, domains: [webAutomationDomain] });
  try {
    if (fluxiq.inspectStorage().layout !== "v2") throw new RunnerFailure("environment.missing", "The workspace's FluxIQ storage was not set up by its Core before the Flow was compiled");
    fluxiq.bindAutomationStudioNativeNodeRuntime(native);
    const service = fluxiq.programs.automationStudio;
    const flow = await service.createFlow({ projectId: input.projectId, flowId: input.flowId, name: input.flowName });
    const registry = native.sdk.nodes;
    const resolution = native.getRegistryResolution(flow.scope);
    const accepted = acceptAutomationStudioFlowBootstrapResult({ result: input.script, registry, resolution });
    if (!accepted.ok) throw refusal("assemble", accepted.issues);
    const handles = planEvidenceHandles(accepted.plan);
    if (handles.length) throw new MatrixAuthoringGap(handles);
    const validation = validateAutomationStudioFlowBootstrapPlan({ plan: accepted.plan, registry, resolution, size: automationStudioFlowBootstrapSizeLimitsOf(flow) });
    if (!validation.ok || !validation.validated) throw refusal("validate", validation.issues);
    const now = Date.now();
    const instructionId = `instruction.${input.flowId}`;
    await service.saveFlowInstruction(input.projectId, {
      schemaVersion: "0.1", instructionId, title: input.flowName, body: input.flowName,
      scope: { kind: "flow", projectId: input.projectId, flowId: input.flowId },
      priority: 100, status: "active", requirement: "required", createdAt: now, updatedAt: now,
    });
    const adaptation = await service.createFlowBootstrapAdaptation({
      projectId: input.projectId,
      flowId: input.flowId,
      baseDependencyDigest: await service.getLlmExecutionDependencyDigest(input.projectId, input.flowId),
      sourceInstructionIds: [instructionId],
      summary: accepted.summary,
      buildPlan: validation.validated,
      actorId: "recovery-matrix",
    });
    const review = { projectId: input.projectId, flowId: input.flowId, adaptationId: adaptation.adaptationId, actorId: "recovery-matrix" };
    await service.reviewFlowBootstrapAdaptation({ ...review, action: "approve" });
    const applied = await service.reviewFlowBootstrapAdaptation({ ...review, action: "apply" });
    if (applied.status !== "applied") throw new RunnerFailure("recording.persistence", `Core left the matrix Flow's adaptation ${applied.status}, not applied`);
    return Object.freeze({
      flowId: input.flowId,
      adaptationId: applied.adaptationId,
      subflows: validation.validated.plan.subflows.map(subflow => ({ key: subflow.key, role: subflow.role, nodes: subflow.nodes.length })),
      steps: validation.validated.plan.subflows.flatMap(subflow => subflow.nodes.map(node => matrixFlowStep(subflow.key, node))),
      requires: [...(applied.topology.requires ?? [])],
      warnings: [...new Set([...accepted.issues, ...validation.issues].map(issue => issue.code))],
    });
  } finally {
    await fluxiq.close();
  }
}

/** A plan node as a step: a declared consequence other than none is a lasting act, and an End says how it ends the run. */
function matrixFlowStep(subflowKey: string, node: { key: string; definitionId: string; consequences?: readonly string[] | undefined; parameters?: Readonly<Record<string, unknown>> | undefined }): MatrixFlowStep {
  const endStatus = node.definitionId === "builtin.control.end" ? node.parameters?.resultStatus : undefined;
  return {
    subflowKey,
    nodeKey: node.key,
    definitionId: node.definitionId,
    lasting: (node.consequences ?? []).length > 0,
    ...(typeof endStatus === "string" ? { endStatus } : {}),
  };
}

function refusal(stage: "assemble" | "validate", issues: readonly { code: string; message: string; path?: string | undefined }[]): RunnerFailure {
  const listed = issues.map(issue => `${issue.code} at ${issue.path ?? "plan"}: ${issue.message}`);
  return new RunnerFailure("fixture.invalid", `Core refused the matrix script at ${stage}: ${listed.join("; ")}`, { details: { codes: issues.map(issue => issue.code) } });
}
