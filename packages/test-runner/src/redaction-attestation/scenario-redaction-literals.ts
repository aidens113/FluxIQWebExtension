import type { WebScenario } from "@fluxiq-web-extension/test-contracts";
import { RunnerFailure } from "../failure.js";

/**
 * The shortest literal the workspace scan accepts: `attestWorkspaceSecretAbsence`
 * refuses anything shorter, because a short literal matches ordinary text and a
 * scan for it would report noise rather than a leak.
 */
const MINIMUM_LITERAL_LENGTH = 8;

/** What the literals are read from: the declarations, and every recording script a declaration can name a step in. */
export type RedactionLiteralScenario = Pick<WebScenario, "id" | "secrets" | "recordingScript" | "workflows">;

/**
 * The synthetic values a scenario declares sensitive: the recorded `value` of
 * each step its `secrets[]` names, across the primary script and every
 * workflow's. These are the values the recorder must withhold at the source, so
 * none of them may appear in anything a run persists.
 *
 * The declaration is `secrets[]` and nothing else. A `redaction` tag says what a
 * fixture is about, not which of its typed values are secret, and a realistic
 * fixture types values that are deliberately not withheld (`storefront-checkout`'s
 * unmarked security code): scanning for every typed value would fail such a
 * fixture for the asymmetry it exists to expose.
 *
 * A declaration the scan cannot use fails the run as `fixture.invalid` rather
 * than attesting less than was declared: a step no script contains, or one whose
 * value is too short to scan for. The failure names the secret and the step,
 * never the value.
 */
export function scenarioRedactionLiterals(scenario: RedactionLiteralScenario): string[] {
  const steps = [scenario.recordingScript, ...(scenario.workflows ?? []).map(workflow => workflow.recordingScript)].flat();
  const literals = new Set<string>();
  for (const secret of scenario.secrets ?? []) {
    const details = { scenarioId: scenario.id, secretId: secret.id, step: secret.step };
    const named = steps.filter(step => step.id === secret.step);
    if (!named.length) {
      throw new RunnerFailure("fixture.invalid", `Scenario ${scenario.id} declares the secret ${secret.id} for the step ${secret.step}, which none of its recording scripts contains`, { details });
    }
    for (const step of named) {
      const value = typeof step.value === "string" || typeof step.value === "number" ? String(step.value) : undefined;
      if (value === undefined || value.length < MINIMUM_LITERAL_LENGTH) {
        throw new RunnerFailure("fixture.invalid", `Scenario ${scenario.id} declares the secret ${secret.id}, but the step ${secret.step} records no value of at least ${MINIMUM_LITERAL_LENGTH} characters for the redaction attestation to scan for`, { details });
      }
      literals.add(value);
    }
  }
  return [...literals];
}
