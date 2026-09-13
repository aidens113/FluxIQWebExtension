import { webAutomationUnresolvedSecretParameters } from "@fluxiq-web-extension/domain/node";
import type { ScenarioSecret, ScenarioStep, WebScenario } from "@fluxiq-web-extension/test-contracts";
import { RunnerFailure } from "../failure.js";
import type { FluxIQHttpOptions } from "../http-control.js";
import { parseScenarioTarget, type ScenarioTarget } from "../scenario-steps/index.js";
import { readFlowNodes, type FlowNodeRecord } from "./flow-action-types.js";
import type { RecordingProposalControl } from "./recording-flow-proposal.js";

export type DeclaredSecret = ScenarioSecret & { value: string };

/**
 * What resolving a declaration reads: the scenario's id, its declarations, and
 * the recording scripts a declaration names a step in. The scripts are part of
 * the input because a declaration is only meaningful against the step it
 * replaces.
 */
export type SecretDeclaringScenario = Pick<WebScenario, "id" | "secrets" | "recordingScript" | "workflows">;

/**
 * A value a node of the approved Flow asks the run to supply, read off the node
 * itself: which node, which parameter, the run-input path it asks under, and the
 * recorded identity of the control it acts on. It never holds a value -- the
 * request is what the recorder wrote in place of one.
 */
export type FlowSecretRequest = {
  nodeId: string;
  parameter: string;
  path: string;
  selector: string | undefined;
  element: Readonly<Record<string, unknown>> | undefined;
};

/** The environment variable a declared secret's value is read from. */
export function declaredSecretEnvironmentName(id: string): string {
  return `FLUXIQ_TEST_SECRET_${id.replaceAll("-", "_").toUpperCase()}`;
}

/**
 * The secrets a scenario declares, with their values taken from the
 * environment rather than from the recording. The recorder withholds a
 * sensitive control's value at the source -- `readElementValue` in
 * `apps/extension/src/content/describe-element.ts` returns nothing for one,
 * by the single rule in `domain/src/sensitivity` -- so the recording of a
 * typed password holds no password, and a Flow built from it has nothing to
 * replay. This is where the value comes from instead. A declared secret whose
 * variable is unset fails the run closed: a silent fallback to whatever the
 * recording captured is exactly what this prevents.
 */
export function resolveDeclaredSecrets(scenario: SecretDeclaringScenario, environment: NodeJS.ProcessEnv): DeclaredSecret[] {
  const declarations = scenario.secrets ?? [];
  if (!declarations.length) return [];
  const recordedSteps = recordedStepIds(scenario);
  return declarations.map((secret) => {
    // A declaration that names no recorded step is inert: the run would carry
    // an input nothing recorded, and the step whose value was meant to be
    // supplied would keep replaying whatever the recording holds. That is the
    // silent fallback this module exists to prevent, so it fails the run.
    if (!recordedSteps.has(secret.step)) {
      throw new RunnerFailure("fixture.invalid", `Scenario ${scenario.id} declares the replay secret ${secret.id} for the step ${secret.step}, which none of its recording scripts contains`, { details: { scenarioId: scenario.id, secretId: secret.id, step: secret.step } });
    }
    const name = declaredSecretEnvironmentName(secret.id);
    const value = environment[name];
    if (typeof value !== "string" || !value) {
      throw new RunnerFailure("environment.missing", `Scenario ${scenario.id} declares the replay secret ${secret.id}, so ${name} must be set`, { details: { scenarioId: scenario.id, secretId: secret.id, variable: name } });
    }
    return { ...secret, value };
  });
}

/** Every step id the scenario records, across its primary script and each further workflow's. */
function recordedStepIds(scenario: SecretDeclaringScenario): Set<string> {
  return new Set([scenario.recordingScript, ...(scenario.workflows ?? []).map((workflow) => workflow.recordingScript)].flat().map((step) => step.id));
}

/**
 * Declared secrets as Flow-run inputs, keyed by secret id. Core merges a run's
 * inputs into the graph's starting values, so this is the seam a Flow node can
 * read a secret from instead of carrying a literal.
 */
export function declaredSecretFlowInputs(secrets: readonly DeclaredSecret[]): Record<string, string> {
  return Object.fromEntries(secrets.map((secret) => [secret.id, secret.value]));
}

/** Secret values to redact from evidence, in addition to the run's configured credentials. */
export function declaredSecretValues(secrets: readonly DeclaredSecret[]): string[] {
  return secrets.map((secret) => secret.value);
}

/**
 * Every value the approved Flow's nodes ask the run to supply, from the nodes
 * `readFlowNodes` read -- the parent Flow and each Subflow graph, because
 * approval writes recorded nodes onto the primary Subflow's graph rather than
 * the parent. The lane derives these and the action types from one read of the
 * Flow, so the nodes are an argument rather than a second walk.
 *
 * A recorded node keeps its output payload under `parameterValues.parameters`
 * (Core's `recordingProposalGraphFlow`), and a sensitive control's `text` there
 * is `{ $state: { path: "web.secret.<key>" } }` rather than a value
 * (`domain/src/output-nodes/secret-binding.ts`). The domain's own reader finds
 * those requests, so this module never restates what a request looks like.
 */
export function flowSecretRequests(nodes: readonly FlowNodeRecord[]): FlowSecretRequest[] {
  return nodes.flatMap((node) => {
    const parameters = optionalRecord(node.parameterValues?.parameters);
    if (!parameters) return [];
    const element = optionalRecord(parameters.element);
    const selector = typeof parameters.selector === "string" ? parameters.selector : undefined;
    return webAutomationUnresolvedSecretParameters(parameters as Parameters<typeof webAutomationUnresolvedSecretParameters>[0])
      .map(({ parameter, path }) => ({ nodeId: node.id, parameter, path, selector, element }));
  });
}

/** `flowSecretRequests` over a fresh read, for a caller that needs nothing else from the Flow's nodes. */
export async function readFlowSecretRequests(
  control: RecordingProposalControl,
  input: { projectId: string; flowId: string },
  bounds: FluxIQHttpOptions = {},
): Promise<FlowSecretRequest[]> {
  return flowSecretRequests(await readFlowNodes(control, input, bounds));
}

/**
 * The run inputs that answer the Flow's requests: each declared secret's value
 * under the path its node asks for, which is the flat key Core resolves a
 * `$state` binding against.
 *
 * A declaration is paired with a request by the control, not by the path's
 * spelling: the declared step's `target` is matched against the recorded
 * identity the requesting node carries. Only declarations whose step this run
 * recorded take part; a declaration for another workflow's step has no node
 * here to pair with.
 *
 * The pairing must be exactly one-to-one or the run fails before the Flow is
 * started. A path no declaration answers would reach Core unanswered and fail
 * one node mid-run with nothing naming the scenario; a declaration that pairs
 * with nothing means the step the scenario meant to supply either never became
 * a request or matches several, and supplying a guess is the silent fallback
 * this module exists to prevent. The failure names secret ids, steps, node ids,
 * parameters and paths, never a value.
 */
export function declaredSecretBindingInputs(input: {
  scenarioId: string;
  secrets: readonly DeclaredSecret[];
  steps: readonly ScenarioStep[];
  requests: readonly FlowSecretRequest[];
}): Record<string, string> {
  const stepsById = new Map(input.steps.map((step) => [step.id, step]));
  const declared = input.secrets.flatMap((secret) => {
    const step = stepsById.get(secret.step);
    return step ? [{ secret, target: parseScenarioTarget(step.target) }] : [];
  });
  const pairs = [...new Set(input.requests.map((request) => request.path))].map((path) => {
    const asking = input.requests.filter((request) => request.path === path);
    return { path, asking, matched: declared.filter(({ target }) => asking.some((request) => targetMatchesRequest(target, request))) };
  });
  const unpairedPaths = pairs.filter((pair) => pair.matched.length !== 1);
  const unpairedSecrets = declared
    .map((entry) => ({ entry, paths: pairs.filter((pair) => pair.matched.includes(entry)).map((pair) => pair.path) }))
    .filter(({ paths }) => paths.length !== 1);
  if (unpairedPaths.length || unpairedSecrets.length) {
    const pathText = unpairedPaths.map((pair) => `${pair.path} (parameter ${unique(pair.asking.map((request) => request.parameter)).join(", ")}; answered by ${pair.matched.length} declarations)`);
    const secretText = unpairedSecrets.map(({ entry, paths }) => `${entry.secret.id} for the step ${entry.secret.step} (paired with ${paths.length} requests)`);
    throw new RunnerFailure("fixture.invalid", `Scenario ${input.scenarioId}: the Flow's requests for values supplied at run time and the scenario's declared secrets do not pair one-to-one. ${[...pathText.map((text) => `Request ${text}.`), ...secretText.map((text) => `Declaration ${text}.`)].join(" ")}`, {
      details: {
        scenarioId: input.scenarioId,
        unpairedPaths: unpairedPaths.map((pair) => ({ path: pair.path, parameters: unique(pair.asking.map((request) => request.parameter)), nodeIds: unique(pair.asking.map((request) => request.nodeId)), secretIds: pair.matched.map(({ secret }) => secret.id) })),
        unpairedSecrets: unpairedSecrets.map(({ entry, paths }) => ({ secretId: entry.secret.id, step: entry.secret.step, paths })),
      },
    });
  }
  return Object.fromEntries(pairs.map((pair) => [pair.path, pair.matched[0]!.secret.value]));
}

/**
 * Whether a manifest target names the control a request was recorded on. The
 * frame part of a target is not recorded on the node, so the inner target is
 * what is compared. A raw CSS target pairs only with the identical recorded
 * selector, which a recorder rarely writes; such a declaration fails to pair
 * loudly rather than guessing.
 */
function targetMatchesRequest(target: ScenarioTarget, request: FlowSecretRequest): boolean {
  const element = request.element ?? {};
  const attributes = optionalRecord(element.attributes) ?? {};
  switch (target.kind) {
    case "testid":
      return element.testId === target.id || attributes["data-testid"] === target.id;
    case "role":
      return (element.role === target.role || element.implicitRole === target.role)
        && (target.name === undefined || element.accessibleName === target.name || element.label === target.name);
    case "frame":
      return targetMatchesRequest(target.inner, request);
    case "css":
      return request.selector === target.selector || element.selector === target.selector;
  }
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function optionalRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}
