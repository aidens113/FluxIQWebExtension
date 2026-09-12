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

/**
 * The element identity a target carries. `testId`, `accessibleName` and
 * `label` are Core's element-fingerprint signals by name
 * (`fingerprinting/element-fingerprint.ts`), and among its highest weighted:
 * a target without them can only be matched on its selector and text. Each is
 * read from the descriptor's own field first, then from the attributes the
 * recorder captured, so a recording made before the producer emitted the field
 * still resolves one.
 */
export function elementFingerprint(value: unknown): JsonObject | undefined {
  const element = objectValue(value);
  if (!element) return undefined;
  const attributes = objectValue(element.attributes);
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
    testId: elementTestId(element, attributes),
    accessibleName: stringValue(element.accessibleName) ?? stringValue(attributes?.["aria-label"]),
    label: stringValue(element.label),
    attributes
  });
}

/** The author-supplied identifier, in the order `describe-element.ts` prefers it for a selector. */
function elementTestId(element: JsonObject, attributes: JsonObject | undefined): string | undefined {
  return stringValue(element.testId)
    ?? stringValue(attributes?.["data-testid"])
    ?? stringValue(attributes?.["data-test"])
    ?? stringValue(attributes?.["data-cy"]);
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
