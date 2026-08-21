import type { FluxIQ } from "fluxiq";
import type { JsonObject } from "fluxiq/core";
import { WEB_AUTOMATION_DOMAIN_ID } from "../constants";
import { registerWebAutomationRuntime } from "./service";

export type RunWebAutomationFlowInput = {
  projectId: string;
  flowId: string;
  inputs?: JsonObject;
  maxSteps?: number;
};

export async function runWebAutomationFlow(fluxiq: FluxIQ, input: RunWebAutomationFlowInput) {
  registerWebAutomationRuntime(fluxiq);
  return await fluxiq.programs.automationStudio.runRuntimeSession({
    projectId: input.projectId,
    flowId: input.flowId,
    ...(input.inputs !== undefined ? { inputs: input.inputs } : {}),
    ...(input.maxSteps !== undefined ? { maxSteps: input.maxSteps } : {}),
    authorizedDomainIds: [WEB_AUTOMATION_DOMAIN_ID]
  });
}
