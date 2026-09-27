import type { ResolvedScenarioWorkflow, WebScenario } from "@fluxiq-web-extension/test-contracts";
import { declaredSecretValues, resolveCreatedFlowSecrets, resolveDeclaredSecrets, type DeclaredSecret } from "../flow-lane/index.js";
import { scenarioRedactionLiterals } from "../redaction-attestation/index.js";
import type { FluxIQTargetConfiguration } from "../target-config.js";

/** What a run must supply to its Flow, what its bundle must scrub, and what its redaction attestation must hunt for. */
export type RunSecrets = {
  /** The scenario's declared replay secrets, resolved to their values; empty on a lane that supplies none. */
  declaredSecrets: DeclaredSecret[];
  /** Every value the bundle's redactor scrubs on write. */
  secrets: string[];
  /**
   * What the redaction attestation scans the finished run for, or `undefined`
   * when this target cannot be attested at all.
   */
  redactionLiterals: string[] | undefined;
};

export type RunSecretsInput = {
  scenario: WebScenario;
  workflow: ResolvedScenarioWorkflow;
  environment: NodeJS.ProcessEnv;
  target: FluxIQTargetConfiguration;
  /** The recording-built Flow lane (`--flow`), whose declared secrets come from the scenario's own script. */
  recordedFlowLane: boolean;
  /** The instruction-built Flow lane, whose secrets are narrowed to the steps the resolved workflow holds. */
  createdFlowLane: boolean;
  live?: { redactionLiterals: readonly string[] };
};

/**
 * Resolves, before the evidence bundle exists, every secret value this run will
 * handle and every literal its redaction attestation will hunt for.
 *
 * The ordering is the point. Declared replay secrets resolve first so their
 * values can join the redaction list the bundle is constructed with; a
 * declaration the environment cannot satisfy therefore fails the run before a
 * bundle has been written rather than in the middle of a Flow. Only the two Flow
 * lanes supply them, so a recording-lane run of the same scenario does not
 * require them to be configured.
 *
 * `redactionLiterals` is deliberately *not* added to `secrets`. The bundle's
 * redactor would scrub them as it wrote, and the attestation's whole job is to
 * scan the finished run for a literal that escaped -- scrubbing them first would
 * hide exactly the leak it looks for. The existing target's FluxIQ is remote and
 * its storage cannot be scanned, so a scenario declaring literals there gets
 * `undefined`, which the attestation reads as `pending` rather than as verified.
 */
export function resolveRunSecrets(input: RunSecretsInput): RunSecrets {
  const { scenario, workflow, environment, target } = input;
  const declaredSecrets: DeclaredSecret[] = input.recordedFlowLane
    ? resolveDeclaredSecrets(scenario, environment)
    : input.createdFlowLane ? resolveCreatedFlowSecrets(scenario, workflow, environment) : [];
  const secrets = [environment.FLUXIQ_TEST_PASSWORD, environment.FLUXIQ_TEST_PIN, environment.FLUXIQ_TEST_TOTP, ...declaredSecretValues(declaredSecrets)].filter((value): value is string => Boolean(value));
  const redactionLiterals = target.mode === "existing" && scenario.secrets?.length
    ? undefined
    : [...scenarioRedactionLiterals(scenario), ...(input.live?.redactionLiterals ?? [])];
  return { declaredSecrets, secrets, redactionLiterals };
}
