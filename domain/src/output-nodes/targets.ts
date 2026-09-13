import type { JsonObject } from "fluxiq/core";
import type { WebAutomationElementContext, WebAutomationElementFingerprint } from "../actions/types";

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
 *   recording wins. Measured on the executed path against the `identity-drift`
 *   Save button: 11 identity signals on the recorded element (the twelfth,
 *   `label`, is one a `<button>` does not have), 1 on the adapted target, 11
 *   after this ordering. An earlier revision of this comment claimed 12/1/12;
 *   it was written before the live replay measured the executed path and found
 *   the wire itself dropping five of the signals.
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
function firstElementFingerprint(sources: unknown[]): WebAutomationElementFingerprint | undefined {
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
 *
 * `context` is where the element sat. It reached the wire on 2026-09-12 and
 * died here: this function had no `context` key, so the signal was captured,
 * carried across the boundary that had been blocking it, and thrown away one
 * layer later -- which looked fixed from both ends. It is carried now.
 * **Nothing scores it yet**: Core's `ElementFingerprintWeights` names nineteen
 * signals and none is a form, a landmark or a position, and
 * `content/identity/score.ts` `comparableFingerprint` sends Core only the
 * signals a candidate can answer, which does not include this one. So this
 * moves no score today; it makes the signal reachable by the consumer that
 * would.
 *
 * `checked` is a checkbox's or radio's state as it was recorded, and
 * `context.landmarkName` is the name of the landmark the element sat in (B5):
 * the first is what a replayed toggle has to reproduce, the second is what
 * separates two `region`s whose role is the same. Each is read as its own type
 * only, so `false` survives and a string `"true"` does not. Neither is scored:
 * Core's matcher has no state or landmark signal.
 */
export function elementFingerprint(value: unknown): WebAutomationElementFingerprint | undefined {
  const element = objectValue(value);
  if (!element) return undefined;
  const attributes = elementAttributes(element.attributes);
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
    checked: booleanValue(element.checked),
    testId: elementTestId(element, attributes),
    accessibleName: stringValue(element.accessibleName) ?? stringValue(attributes?.["aria-label"]),
    label: stringValue(element.label),
    attributes,
    context: elementContext(element.context),
    // Core's remaining fingerprint signals, named so their absence is a
    // decision and so a signal Core adds stops this producer compiling. A
    // browser recording has no source for any of them: the first four are a
    // host application's own identifiers and a Core state path, `url` names
    // the page rather than the control, `bounds` are the capture's viewport
    // and not this instant's (which is why `content/identity/score.ts` refuses
    // to compare them), and `metadata` is Core's own passthrough slot, which
    // this normalizer must not start writing into behind the declared fields.
    automationId: undefined,
    entityId: undefined,
    entityKind: undefined,
    statePath: undefined,
    queryPath: undefined,
    url: undefined,
    bounds: undefined,
    metadata: undefined
  } satisfies ElementFingerprintFields) as WebAutomationElementFingerprint;
}

/**
 * Every key of a contract type, written out.
 *
 * `-?` is deliberately not used: it would strip `undefined` from the value as
 * well as the modifier, and the whole point is that an optional field must be
 * *mentioned* while still being allowed to be absent. Mapping over
 * `keyof Required<T>` removes the modifier and leaves `T[K]` alone, so a
 * deleted field fails to compile, a renamed field fails to compile, a required
 * field may not be written `undefined`, and an optional one may.
 *
 * This is `present<T>()` (`domain/src/runtime/llm-evidence/present.ts`)
 * expressed as a type rather than imported as a function. The helper itself is
 * unreachable from here: it is not on that directory's barrel, and reaching
 * past a barrel into another directory's files is a `structure-audit` failure.
 * Promoting it to a barrel-exported home is the supervisor's call, not this
 * change's.
 */
type ContractFields<T> = { [K in keyof Required<T>]: T[K] };

type ElementFingerprintFields = ContractFields<WebAutomationElementFingerprint>;

type ElementContextFields = ContractFields<WebAutomationElementContext>;

/**
 * Where the element sat on the page, read from the wire with the same closed
 * vocabulary as the fingerprint around it: a key this reader does not know is
 * a signal the page never sees, whatever the recorder called it.
 *
 * A context with nothing in it is `undefined` rather than `{}`, because the
 * recorder emits no `context` at all for an element inside no form, list,
 * table or landmark, and an empty object on the Flow node would read as
 * "asked, and the page said nothing" when in fact nothing was asked.
 */
function elementContext(value: unknown): WebAutomationElementContext | undefined {
  const context = objectValue(value);
  if (!context) return undefined;
  const fields = compact({
    formId: stringValue(context.formId),
    formName: stringValue(context.formName),
    formAction: stringValue(context.formAction),
    fieldsetLegend: stringValue(context.fieldsetLegend),
    landmark: stringValue(context.landmark),
    landmarkName: stringValue(context.landmarkName),
    heading: stringValue(context.heading),
    listPosition: listPosition(context.listPosition),
    tablePosition: tablePosition(context.tablePosition)
  } satisfies ElementContextFields);
  return Object.keys(fields).length > 0 ? fields as WebAutomationElementContext : undefined;
}

/** A place in a list, or nothing: an index with no total says how far along nothing. */
function listPosition(value: unknown): WebAutomationElementContext["listPosition"] {
  const position = objectValue(value);
  const index = numberValue(position?.index);
  const total = numberValue(position?.total);
  return index === undefined || total === undefined ? undefined : { index, total };
}

/** A cell in a table. The column header is the part a person reads, and is absent where the table has none. */
function tablePosition(value: unknown): WebAutomationElementContext["tablePosition"] {
  const position = objectValue(value);
  const row = numberValue(position?.row);
  const column = numberValue(position?.column);
  if (row === undefined || column === undefined) return undefined;
  const columnHeader = stringValue(position?.columnHeader);
  return columnHeader === undefined ? { row, column } : { row, column, columnHeader };
}

/**
 * The attribute map, narrowed to what the contract declares it to be.
 *
 * Core types `attributes` as `Record<string, string>` and its matcher compares
 * the values as strings. This reader used to hand it a raw `JsonObject`, so a
 * recording carrying a number or a nested object under an attribute name
 * reached the comparison as one -- typing the projection is what surfaced it.
 * An element that carried an attribute map keeps one even when nothing in it
 * survives, because "the recorder looked and found no usable attribute" is a
 * different fact from "the recorder did not look".
 */
function elementAttributes(value: unknown): Record<string, string> | undefined {
  const attributes = objectValue(value);
  if (!attributes) return undefined;
  const strings: Record<string, string> = {};
  for (const [name, item] of Object.entries(attributes)) {
    if (typeof item === "string") strings[name] = item;
  }
  return strings;
}

/** The author-supplied identifier, in the order `describe-element.ts` prefers it for a selector. */
function elementTestId(element: JsonObject, attributes: Record<string, string> | undefined): string | undefined {
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

/** A boolean, or nothing: `false` is a reading, and the string `"false"` is not one. */
function booleanValue(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}
