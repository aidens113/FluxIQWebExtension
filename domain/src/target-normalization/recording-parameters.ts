import type { AutomationStudioRecordingCandidateParameterNormalizer } from "fluxiq/components/automation/importer";
import type { JsonObject } from "fluxiq/core";
import { normalizeWebElementTarget } from "./normalize";

export const normalizeWebRecordingCandidateParameters: AutomationStudioRecordingCandidateParameterNormalizer = (_domainId, parameters, _context) => {
  const target = normalizeWebElementTarget(parameters.element ? parameters : parameters.target, { source: "mapper" })
    ?? normalizeWebElementTarget(parameters, { source: "mapper" });
  if (!target) return { ...parameters };
  return Object.fromEntries(Object.entries({ ...parameters, target }).filter(([, value]) => value !== undefined)) as JsonObject;
};
