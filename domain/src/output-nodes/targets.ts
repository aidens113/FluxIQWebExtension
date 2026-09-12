import type { JsonObject } from "fluxiq/core";

export type WebAutomationOutputTarget = JsonObject;

export function outputTargetFromPayload(payload: JsonObject): WebAutomationOutputTarget | undefined {
  const adaptedTarget = objectValue(payload.target);
  const adaptedFingerprint = objectValue(adaptedTarget?.fingerprint);
  const selectedCandidate = selectedTargetCandidate(adaptedTarget);
  const explicitVisualTarget = objectValue(adaptedTarget?.visualTarget) ?? objectValue(payload.visualTarget);
  const element = firstElementFingerprint(elementFingerprintSources(payload, adaptedTarget, adaptedFingerprint, selectedCandidate));
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

/**
 * Where the dispatched target's element identity comes from, richest
 * trustworthy source first — which is not always the adapted target.
 *
 * Core's `prepareElementTargetAction` runs on **every** policy output dispatch
 * (`runtime/io-policy.ts`). It normalizes an element target out of the
 * parameters and writes it back as `parameters.target`, which is the
 * `adaptedTarget` read above. Whether that copy is better than the recorded
 * `payload.element` depends entirely on whether Core matched anything, and
 * `selectedCandidate` on the adapted target is what says so:
 *
 * - **Core matched a runtime candidate.** The adapted target then describes the
 *   element the page really has — this is drift correction — and it wins over
 *   the recorded description, which may name an element that has since moved or
 *   been renamed. Discarding it in favour of a stale `payload.element` would
 *   silently undo the correction.
 * - **Core matched nothing**, which is every dispatch today, because nothing
 *   populates `candidates` yet. `normalizeFingerprint` reads only the
 *   parameters' own top-level keys and never looks inside `parameters.element`,
 *   so `adaptedTarget.fingerprint` comes back as `{ selector, statePath }` and
 *   `adaptedTarget.element` does not come back at all. That is a lossy
 *   re-derivation of the same recorded element, not a newer one, so the
 *   recording wins. Measured on the executed path: 12 identity signals recorded,
 *   1 on the wire before this ordering, 12 after.
 *
 * The rule is the one `client/gateway-mapping.ts` `elementFingerprintSources`
 * already applies to the declared `command.element`, deliberately stated the
 * same way here so the two ends of the same dispatch cannot disagree about
 * which element is being acted on.
 */
function elementFingerprintSources(
  payload: JsonObject,
  adaptedTarget: JsonObject | undefined,
  adaptedFingerprint: JsonObject | undefined,
  selectedCandidate: JsonObject | undefined
): unknown[] {
  const adapted = [adaptedTarget?.element, selectedCandidate, adaptedFingerprint];
  return adaptedTarget?.selectedCandidate !== undefined ? [...adapted, payload.element] : [payload.element, ...adapted];
}

/**
 * The first source that yields an identity. A source that normalizes to an
 * empty object carries no signal at all, so it is skipped rather than allowed
 * to shadow a later source that does — the same guard the declared
 * `command.element` uses, and the reason reordering the chain is safe.
 */
function firstElementFingerprint(sources: unknown[]): JsonObject | undefined {
  for (const source of sources) {
    const fingerprint = elementFingerprint(source);
    if (fingerprint && Object.keys(fingerprint).length > 0) return fingerprint;
  }
  return undefined;
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
 *
 * `implicitRole` is the role a page that writes no ARIA still has. The recorder
 * derives it (`content/describe-element.ts`), and `role` is absent whenever no
 * `role` attribute was authored, so without this field such a target reaches
 * the page with no semantic signal at all: `resolve-target.ts` falls back to
 * `role ?? implicitRole` when it counts the same-family controls a not-found
 * failure reports, and a scorer would weigh it where Core weighs `role`.
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
    implicitRole: stringValue(element.implicitRole),
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
