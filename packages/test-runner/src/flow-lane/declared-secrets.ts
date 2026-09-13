import type { ScenarioSecret, WebScenario } from "@fluxiq-web-extension/test-contracts";
import { RunnerFailure } from "../failure.js";

export type DeclaredSecret = ScenarioSecret & { value: string };

/**
 * What resolving a declaration reads: the scenario's id, its declarations, and
 * the recording scripts a declaration names a step in. The scripts are part of
 * the input because a declaration is only meaningful against the step it
 * replaces.
 */
export type SecretDeclaringScenario = Pick<WebScenario, "id" | "secrets" | "recordingScript" | "workflows">;

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
