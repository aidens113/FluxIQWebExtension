import type { AutomationStudioElementTarget } from "fluxiq/automation-studio";
import { normalizeWebElementTarget } from "../../target-normalization";
import { compactJsonObject, matchOutputTarget, outputDispatchFailure, outputTargetMinimumConfidence, type OutputTargetPreparer } from "fluxiq/runtime/output-dispatch/preparation";
import type { ElementMatcher } from "fluxiq/runtime/target-matching";
/** Explicit legacy envelope adapter; generic dispatch never infers these fields. */
export function createWebOutputTargetPreparer(elementMatcher?: ElementMatcher): OutputTargetPreparer {
  return ({ action, output }) => {
    const outputId = action.outputId?.trim() ?? "";
    const parameters = action.parameters && typeof action.parameters === "object" && !Array.isArray(action.parameters) ? action.parameters : {};
    const target = normalizeWebElementTarget(parameters.target, { source: "runtime" })
      ?? normalizeWebElementTarget(parameters, { source: "runtime" });
    const required = output.metadata?.elementTarget === true || output.metadata?.targetKind === "element";
    if (!target) {
      if (!required)
        return { ok: true };
      return {
        ok: false,
        error: `Output ${outputId} declares element targeting but parameters.target does not contain an element fingerprint.`,
        failure: outputDispatchFailure("graph_validation_or_unknown_node", "element_target.missing_fingerprint", false, "target_resolution")
      };
    }
    const resolved = matchOutputTarget(target.fingerprint, target.candidates, outputTargetMinimumConfidence(output.metadata?.elementTargetMinConfidence, output.safety?.level), elementMatcher);
    if (!resolved.ok)
      return resolved;
    const preparedTarget = resolved.selectedCandidate
      ? compactJsonObject({ ...target, selectedCandidate: resolved.selectedCandidate }) as unknown as AutomationStudioElementTarget
      : target;
    return { ok: true, parameters: compactJsonObject({ ...parameters, target: preparedTarget }), diagnostics: resolved.diagnostics, resolution: resolved.resolution };
  };
}
