import type { ScenarioSecret, WebScenario } from "@fluxiq-web-extension/test-contracts";
import { RunnerFailure } from "../failure.js";

export type DeclaredSecret = ScenarioSecret & { value: string };

/** The environment variable a declared secret's value is read from. */
export function declaredSecretEnvironmentName(id: string): string {
  return `FLUXIQ_TEST_SECRET_${id.replaceAll("-", "_").toUpperCase()}`;
}

/**
 * The secrets a scenario declares, with their values taken from the
 * environment rather than from the recording. The recorder captures a typed
 * password verbatim today (`describe-element.ts`; Phase 1.4 redacts it at the
 * source), so a Flow built from a recording would otherwise replay the real
 * value. A declared secret whose variable is unset fails the run closed: a
 * silent fallback to the recorded value is exactly what this prevents.
 */
export function resolveDeclaredSecrets(scenario: Pick<WebScenario, "id" | "secrets">, environment: NodeJS.ProcessEnv): DeclaredSecret[] {
  return (scenario.secrets ?? []).map((secret) => {
    const name = declaredSecretEnvironmentName(secret.id);
    const value = environment[name];
    if (typeof value !== "string" || !value) {
      throw new RunnerFailure("environment.missing", `Scenario ${scenario.id} declares the replay secret ${secret.id}, so ${name} must be set`, { details: { scenarioId: scenario.id, secretId: secret.id, variable: name } });
    }
    return { ...secret, value };
  });
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
