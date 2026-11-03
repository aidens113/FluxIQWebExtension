import type { ActionTarget, AutomationStudioRecordingEntryTargetPreparer } from "fluxiq/automation-studio";
import type { JsonObject } from "fluxiq/core";
import { normalizeWebElementTarget } from "../normalize";

function compactDefined(value: Record<string, unknown>): JsonObject {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as JsonObject;
}

/** Only the target projection moves; Core keeps the entry and everything else about it. */
export const prepareWebRecordingEntryTarget: AutomationStudioRecordingEntryTargetPreparer = (_domainId, entry) => {
  const parameters = entry.parameters && typeof entry.parameters === "object" && !Array.isArray(entry.parameters) ? entry.parameters as Record<string, unknown> : {};
  const target = entry.target && typeof entry.target === "object" && !Array.isArray(entry.target) ? entry.target as Record<string, unknown> : undefined;
  const targetForNormalization = target || entry.visualTarget ? { ...(target ?? {}), ...(entry.visualTarget ? { visualTarget: entry.visualTarget } : {}) } : undefined;
  const elementTarget = normalizeWebElementTarget(target && "elementTarget" in target ? target.elementTarget : undefined, { source: "recording" })
    ?? normalizeWebElementTarget(parameters.target, { source: "recording" })
    ?? normalizeWebElementTarget(targetForNormalization, { source: "recording" });
  if (!elementTarget) return null;
  return {
    parameters: compactDefined({ ...parameters, target: elementTarget }),
    target: compactDefined({
      type: typeof target?.type === "string" && target.type.trim() ? target.type : "ui_element",
      ...(target?.id ? { id: target.id } : {}),
      ...(target?.label ? { label: target.label } : {}),
      ...(target?.selector ? { selector: target.selector } : {}),
      ...(target?.bounds ? { bounds: target.bounds } : {}),
      ...(target?.relativePosition ? { relativePosition: target.relativePosition } : {}),
      ...(target?.visualTarget ? { visualTarget: target.visualTarget } : {}),
      elementTarget,
      ...(target?.metadata ? { metadata: target.metadata } : {})
    }) as unknown as ActionTarget
  };
};
