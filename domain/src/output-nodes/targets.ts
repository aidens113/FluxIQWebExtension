import type { JsonObject } from "fluxiq/core";

export type WebAutomationOutputTarget = JsonObject;

export function outputTargetFromPayload(payload: JsonObject): WebAutomationOutputTarget | undefined {
  const adaptedTarget = objectValue(payload.target);
  const adaptedFingerprint = objectValue(adaptedTarget?.fingerprint);
  const selectedCandidate = selectedTargetCandidate(adaptedTarget);
  const explicitVisualTarget = objectValue(adaptedTarget?.visualTarget) ?? objectValue(payload.visualTarget);
  const element = elementFingerprint(adaptedTarget?.element)
    ?? elementFingerprint(selectedCandidate)
    ?? elementFingerprint(adaptedFingerprint)
    ?? elementFingerprint(payload.element);
  const selector = stringValue(selectedCandidate?.selector)
    ?? stringValue(adaptedFingerprint?.selector)
    ?? stringValue(adaptedTarget?.selector)
    ?? stringValue(payload.selector)
    ?? stringValue(element?.selector)
    ?? stringValue(explicitVisualTarget?.selector);
  if (!selector && !explicitVisualTarget) return undefined;
  return compact({
    selector,
    ...(element ? { element } : {}),
    ...(explicitVisualTarget ? { visualTarget: explicitVisualTarget } : {})
  });
}

function selectedTargetCandidate(target: JsonObject | undefined): JsonObject | undefined {
  const selectedCandidateId = stringValue(objectValue(target?.selectedCandidate)?.candidateId);
  if (!selectedCandidateId || !Array.isArray(target?.candidates)) return undefined;
  return target.candidates
    .map(objectValue)
    .find(candidate => stringValue(candidate?.candidateId) === selectedCandidateId);
}

export function elementFingerprint(value: unknown): JsonObject | undefined {
  const element = objectValue(value);
  if (!element) return undefined;
  return compact({
    selector: stringValue(element.selector),
    xpath: stringValue(element.xpath),
    id: stringValue(element.id),
    classNames: Array.isArray(element.classNames) ? element.classNames.filter((item): item is string => typeof item === "string") : undefined,
    visibleText: stringValue(element.visibleText),
    tagName: stringValue(element.tagName),
    text: stringValue(element.text),
    value: stringValue(element.value),
    role: stringValue(element.role),
    name: stringValue(element.name),
    href: stringValue(element.href),
    inputType: stringValue(element.inputType),
    attributes: objectValue(element.attributes)
  });
}

export function compact(value: Record<string, unknown>): JsonObject {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as JsonObject;
}

export function objectValue(value: unknown): JsonObject | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : undefined;
}

export function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
