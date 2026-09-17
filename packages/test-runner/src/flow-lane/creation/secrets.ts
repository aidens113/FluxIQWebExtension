// The values a created Flow asks the run for, answered the way the recorded
// Flow lane answers them: a declared secret, read from the environment, handed
// to Core as a run input under the path the node asks for, and added to the
// run's redaction list by the runner. The instruction never carries one.

import { webAutomationUnresolvedSecretParameters, webAutomationUploadBindingPath } from "@fluxiq-web-extension/domain/node";
import type { ResolvedScenarioWorkflow, WebScenario } from "@fluxiq-web-extension/test-contracts";
import { RunnerFailure } from "../../failure.js";
import { declaredSecretBindingInputs, resolveDeclaredSecrets, type DeclaredSecret, type FlowSecretRequest } from "../declared-secrets.js";
import type { FlowNodeRecord } from "../flow-action-types.js";

/**
 * The scenario's declared secrets a created-Flow run can need: those whose
 * step is in the task's workflow. Each value comes from its environment
 * variable and an unset one refuses the run (`resolveDeclaredSecrets`); a
 * declaration for another workflow's step is not this task's to supply.
 */
export function resolveCreatedFlowSecrets(scenario: WebScenario, workflow: Pick<ResolvedScenarioWorkflow, "recordingScript">, environment: NodeJS.ProcessEnv): DeclaredSecret[] {
  const steps = new Set(workflow.recordingScript.map((step) => step.id));
  const secrets = (scenario.secrets ?? []).filter((secret) => steps.has(secret.step));
  return secrets.length ? resolveDeclaredSecrets({ ...scenario, secrets }, environment) : [];
}

/**
 * The run inputs that answer the created Flow's secret requests, paired
 * one-to-one with the declared secrets by the control each was declared on
 * (`declaredSecretBindingInputs`). A created Flow that asks for a file, asks
 * for a value nothing declares, or never asks for a declared one could not do
 * the task honestly, and fails before it runs, naming paths and secret ids and
 * never a value.
 */
export function createdFlowSecretInputs(input: {
  scenarioId: string;
  secrets: readonly DeclaredSecret[];
  workflow: Pick<ResolvedScenarioWorkflow, "recordingScript">;
  nodes: readonly FlowNodeRecord[];
}): Record<string, string> {
  const uploads = input.nodes.filter((node) => Object.values(nodeParameters(node) ?? {}).some((value) => webAutomationUploadBindingPath(value) !== undefined)).length;
  if (uploads > 0) throw new RunnerFailure("fixture.invalid", `The created Flow asks the run for files on ${uploads} node(s), which the created-Flow lane does not supply`, { details: { uploadNodes: uploads } });
  const requests = input.nodes.flatMap((node): FlowSecretRequest[] => {
    const parameters = nodeParameters(node);
    if (!parameters) return [];
    const element = isRecord(parameters.element) ? parameters.element : undefined;
    const selector = typeof parameters.selector === "string" ? parameters.selector : undefined;
    return webAutomationUnresolvedSecretParameters(parameters as Parameters<typeof webAutomationUnresolvedSecretParameters>[0])
      .map(({ parameter, path }) => ({ nodeId: node.id, parameter, path, selector, element }));
  });
  if (requests.length === 0 && input.secrets.length === 0) return {};
  try {
    return declaredSecretBindingInputs({ scenarioId: input.scenarioId, secrets: input.secrets, steps: input.workflow.recordingScript, requests });
  } catch (error) {
    if (!(error instanceof RunnerFailure)) throw error;
    // The same refusal, filed as what it is here: the Flow FluxIQ built did not ask for the scenario's secrets as declared.
    throw new RunnerFailure("runtime.behavior", `The created Flow could not be given its secret values. ${error.message}`, { cause: error, ...(error.details ? { details: error.details } : {}) });
  }
}

/**
 * A node's action parameters, in either shape a Flow carries them: nested
 * under `parameters` on a policy action node, which is how a recorded node
 * stores its output payload, or flat on a domain output node, whose definition
 * fixes its output and declares each parameter itself.
 */
function nodeParameters(node: FlowNodeRecord): Record<string, unknown> | undefined {
  const values = node.parameterValues;
  if (!values) return undefined;
  return isRecord(values.parameters) ? values.parameters : values;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
