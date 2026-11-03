import type { AutomationStudioImporterImplementationBundle } from "fluxiq/components/automation/importer";
import { compactDefinedJsonObject as compactJsonObject } from "fluxiq/core";
import { normalizeWebElementTarget } from "../normalize";

/** Only the target projection moves; Core retains the original entry and its authority. */
export const prepareWebRecordingEntryTarget: NonNullable<AutomationStudioImporterImplementationBundle["recordingEntryTargetPreparer"]> = (_domainId, entry) => {
  if (entry.type !== "action") return null;
  const parameters = entry.parameters && typeof entry.parameters === "object" && !Array.isArray(entry.parameters) ? entry.parameters as Record<string, unknown> : {};
  const target = entry.target && typeof entry.target === "object" && !Array.isArray(entry.target) ? entry.target as Record<string, unknown> : undefined;
  const targetForNormalization = target || entry.visualTarget ? { ...(target ?? {}), ...(entry.visualTarget ? { visualTarget: entry.visualTarget } : {}) } : undefined;
  const elementTarget = normalizeWebElementTarget(target && "elementTarget" in target ? target.elementTarget : undefined, { source: "recording" })
    ?? normalizeWebElementTarget(parameters.target, { source: "recording" })
    ?? normalizeWebElementTarget(targetForNormalization, { source: "recording" });
  if (!elementTarget) return null;
  const originalTarget = entry.target as Record<string, unknown> | undefined;
  return {
    parameters: compactJsonObject({ ...parameters, target: elementTarget }),
    target: compactJsonObject({
      type: typeof originalTarget?.type === "string" && originalTarget.type.trim() ? originalTarget.type : "ui_element",
      ...(originalTarget?.id ? { id: originalTarget.id } : {}),
      ...(originalTarget?.label ? { label: originalTarget.label } : {}),
      ...(originalTarget?.selector ? { selector: originalTarget.selector } : {}),
      ...(originalTarget?.bounds ? { bounds: originalTarget.bounds } : {}),
      ...(originalTarget?.relativePosition ? { relativePosition: originalTarget.relativePosition } : {}),
      ...(originalTarget?.visualTarget ? { visualTarget: originalTarget.visualTarget } : {}),
      elementTarget,
      ...(originalTarget?.metadata ? { metadata: originalTarget.metadata } : {})
    })
  };
};
