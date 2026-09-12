import type { JsonObject } from "fluxiq/core";
import { WEB_AUTOMATION_ACTION_SAFETY } from "../actions/safety";
import { webAutomationActionDefinitions } from "../actions/schemas";
import { actionInputDefinitions, stateInputDefinitions } from "./input-model";

/** Static domain contract shared by the host module and the runtime IO adapters. */
export const webAutomationManifestInputs = [
  ...stateInputDefinitions,
  ...actionInputDefinitions.map(([id, title, outputId]) => ({ id, title, role: "action" as const, outputId }))
];

export const webAutomationManifestOutputs = webAutomationActionDefinitions.map((action) => ({
  id: action.actionType,
  title: action.label,
  description: action.description,
  schema: action.parameterSchema,
  capabilities: ["web.actions"],
  safety: {
    level: WEB_AUTOMATION_ACTION_SAFETY[action.actionType],
    requiresApproval: WEB_AUTOMATION_ACTION_SAFETY[action.actionType] !== "safe"
  },
  // This is the registration Core's element-target preparation actually reads.
  // `runtime/io-policy.ts` takes both `metadata.elementTarget` and
  // `safety.level` off `io.getOutput(domainId, outputId).definition` — the
  // `DomainOutputDefinition` registered here through `defineOutput` — and not
  // off the authoring node definition, whose only runtime-read field is
  // `metadata.timeoutMs`. Without the flag `resolveElementTarget` never runs
  // and `elementTargetMinimumConfidence` never applies, so a drifted target is
  // dispatched at whatever confidence it happens to have.
  ...(requiresElementTarget(action.parameterSchema) ? { metadata: { elementTarget: true } } : {})
}));

/**
 * Which outputs cannot run without an element, read off the action's own schema
 * row — the same rule, from the same source, that `output-nodes/definitions.ts`
 * applies on the authoring side, so the two registrations cannot disagree.
 * `io/tests/manifest-definitions.test.ts` proves they do not, and restates the
 * resulting list independently so an unintended change to either side fails.
 *
 * It must stay per-action. Core fails an action outright with
 * `element_target.missing_fingerprint` when the flag is set and the parameters
 * carry no fingerprint, so declaring it on a delta scroll, a URL assertion or a
 * tab operation would break every one of them.
 */
function requiresElementTarget(parameterSchema: JsonObject): boolean {
  return Array.isArray(parameterSchema.required) && parameterSchema.required.includes("selector");
}
