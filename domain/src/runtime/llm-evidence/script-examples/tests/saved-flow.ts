import {
  createBlankAutomationStudioFlowArtifact,
  normalizeAutomationStudioFlowBuildPlan,
  validateAutomationStudioFlow,
  validateAutomationStudioFlowBootstrapPlan,
  type AutomationStudioFlowBootstrapPlan
} from "fluxiq/automation-studio";
import { exampleSupport } from "./support";
import { resolveExampleEvidence } from "./resolve-evidence";

// Exercise the public save pipeline, including each graph's role and every
// external checkpoint, rather than treating successful parsing as a saved Flow.
export async function savedFlowValidation(plan: AutomationStudioFlowBootstrapPlan, exampleName: string) {
  const { registry, resolution } = exampleSupport;
  const resolved = await resolveExampleEvidence(plan, exampleName);
  if (!resolved.ok) return { errors: resolved.issues, topology: undefined };
  const validation = validateAutomationStudioFlowBootstrapPlan({ plan: resolved.plan, registry, resolution });
  const planErrors = validation.issues.filter((issue) => issue.severity === "error");
  if (!validation.validated) return { errors: planErrors, topology: undefined };
  const parentFlow = createBlankAutomationStudioFlowArtifact({ flowId: "flow.examples", projectId: "project.examples", name: "Web examples", now: 1 });
  const topology = normalizeAutomationStudioFlowBuildPlan({ adaptationId: "adaptation.examples", parentFlow, buildPlan: validation.validated, sourceInstructionIds: [], now: 1 });
  const checkpointIds = topology.subflows.flatMap(({ graphFlow }) => graphFlow.nodes.flatMap(({ metadata }) => {
    const checkpoint = metadata?.["fluxiq.checkpoint"];
    return checkpoint && typeof checkpoint === "object" && !Array.isArray(checkpoint) && typeof checkpoint.id === "string" ? [checkpoint.id] : [];
  }));
  const errors = topology.subflows.flatMap(({ graphFlow, subflow }) =>
    validateAutomationStudioFlow(graphFlow, { subflowRole: subflow.role, externalCheckpointIds: checkpointIds }).issues
      .filter((issue) => issue.severity === "error")
      .map((issue) => ({ ...issue, graph: String(subflow.metadata?.bootstrapSymbolicKey ?? subflow.subflowId) })));
  return { errors: [...planErrors, ...errors], topology };
}
