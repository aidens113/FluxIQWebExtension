import type { ScenarioStep } from "@fluxiq-web-extension/test-contracts";
import { cssSelectorForTarget, parseScenarioTarget } from "../scenario-steps/index.js";

/** Why the Core action probe typed into nothing. */
export type CoreProbeSkipReason = "no-css-type-step" | "not-on-start-page";

/** The step the probe types into and its selector, or why it is skipped and which `type` steps were considered. */
export type CoreProbeChoice =
  | { kind: "probe"; step: ScenarioStep; selector: string }
  | { kind: "skipped"; reason: CoreProbeSkipReason; stepIds: string[] };

/**
 * The step the Core action probe types into: the first `type` step, in script
 * order, whose target is a CSS selector that is on the page the recording
 * starts on, as `onStartPage` reports for that selector. The probe runs before
 * the recording, on the start page, so a field only an earlier step reveals
 * cannot take its text: W12's `enter-email` sits in a dialog `open-invite`
 * opens, the probe's type was rejected for a zero-size box, and both lanes
 * failed before anything was recorded. Otherwise the probe is skipped, with the
 * reason and the step ids considered, never a value.
 */
export async function selectCoreProbeStep(steps: readonly ScenarioStep[], onStartPage: (selector: string) => Promise<boolean>): Promise<CoreProbeChoice> {
  const candidates = steps.flatMap((step) => {
    if (step.operation !== "type" || !step.target) return [];
    const selector = cssSelectorForTarget(parseScenarioTarget(step.target));
    return selector ? [{ step, selector }] : [];
  });
  if (!candidates.length) return { kind: "skipped", reason: "no-css-type-step", stepIds: [] };
  for (const candidate of candidates) {
    if (await onStartPage(candidate.selector)) return { kind: "probe", ...candidate };
  }
  return { kind: "skipped", reason: "not-on-start-page", stepIds: candidates.map((candidate) => candidate.step.id) };
}
