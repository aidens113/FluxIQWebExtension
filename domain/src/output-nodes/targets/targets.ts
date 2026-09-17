import type { JsonObject } from "fluxiq/core";
import type { WebAutomationElementContext, WebAutomationElementFingerprint } from "../../actions/types";

export type WebAutomationOutputTarget = JsonObject;

export function outputTargetFromPayload(payload: JsonObject): WebAutomationOutputTarget | undefined {
  const adaptedTarget = objectValue(payload.target);
  const adaptedFingerprint = objectValue(adaptedTarget?.fingerprint);
  const selectedCandidate = selectedTargetCandidate(adaptedTarget);
  const explicitVisualTarget = objectValue(adaptedTarget?.visualTarget) ?? objectValue(payload.visualTarget);
  const chosen = firstElementFingerprint(elementFingerprintSources(payload, adaptedTarget, adaptedFingerprint, selectedCandidate));
  const element = withRecordedRecord(chosen, payload);
  // The selector keeps the order it always had, adapted first. What changed is
  // that the identity now follows it whenever the adaptation names another
  // element, so the page judges the selector's match by the same description.
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
 * The dispatched element, carrying the record the *recording* named whatever
 * else superseded it.
 *
 * **Why this is not just another signal in the chain above.** That chain picks
 * one source for the whole identity, and on an applied repair the adapted
 * target wins it. A repair's target is normalized by Core from
 * `parameters.target` alone and never sees `parameters.element`
 * (`runtime/io-policy.ts`), so it carries no `context` at all -- and Core's
 * `normalizeFingerprint` has no `context` key either
 * (`model/action-element-target.ts`). Measured on the real path: a renamed
 * control inside a list dispatched with `context.record: null`, so the page's
 * record gate was off for exactly the steps a repair had touched
 * (reports/w2-wrong-row-acted-on.md §8).
 *
 * **Why carrying it is right rather than a patch.** The rule above compares
 * *descriptive* signals only, and its own documentation says why `selector` and
 * `xpath` are exempt: a target that merely locates the recorded control
 * somewhere else keeps the recorded identity. The record is in that same
 * category, and more strongly. A repair says what the control is now called; it
 * has no standing to say which of 240 rows it belongs to, and the shape it
 * arrives in proves the point -- `runtime/llm-evidence/target-override.ts`
 * writes `listIndex` and `listTotal`, a position in the list, which is exactly
 * the signal a departed member invalidates.
 *
 * So: the adapted source keeps the identity it won, and the record comes from
 * the recording. An adapted source that somehow names a record of its own keeps
 * it, because then it is describing a record and not merely inheriting one.
 */
function withRecordedRecord(element: WebAutomationElementFingerprint | undefined, payload: JsonObject): WebAutomationElementFingerprint | undefined {
  if (!element || element.context?.record) return element;
  const record = elementRecord(objectValue(objectValue(payload.element)?.context)?.record);
  if (!record) return element;
  return { ...element, context: { ...element.context, record } };
}

/**
 * Where the dispatched target's element identity comes from: the adapted
 * target when it names another element, the recording otherwise.
 * `adaptedTargetSupersedesRecording` decides which, and
 * `client/gateway-mapping.ts` asks it the same question for the declared
 * `command.element`, so the two ends of one dispatch cannot disagree about
 * which element is being acted on.
 *
 * The adapted sources are read the way Core reads a target: its own
 * `element`, the runtime candidate it selected, its `fingerprint`, and the
 * target itself when it is flat. The flat form is how the domain's repair
 * resolution is stored on a node before Core rewrites it. A Core-shaped target
 * has no fingerprint key at its top level, so it normalizes to nothing and is
 * skipped.
 */
function elementFingerprintSources(
  payload: JsonObject,
  adaptedTarget: JsonObject | undefined,
  adaptedFingerprint: JsonObject | undefined,
  selectedCandidate: JsonObject | undefined
): unknown[] {
  const adapted = [adaptedTarget?.element, selectedCandidate, adaptedFingerprint, adaptedTarget];
  return adaptedTargetSupersedesRecording(payload) ? [...adapted, payload.element] : [payload.element, ...adapted];
}

/**
 * Whether a node's `target` names the element to act on in place of the one
 * its `element` recorded.
 *
 * The recorded description is the richer one, so it wins by default: Core has
 * no `context`, `checked`, `name`, `href`, `inputType` or `value`, and it folds
 * `implicitRole` into `role`. That default is right only while the target
 * describes the *same* element. Three things say it describes another one:
 *
 * - **Core matched a runtime candidate** (`selectedCandidate`). The target then
 *   describes the element the page really has, which is drift correction.
 * - **It is the domain's own repair resolution**, as an applied repair stores
 *   it (`runtime/llm-evidence/target-override.ts`: `handles` beside
 *   `handleResolution`).
 * - **It names a descriptive value the node's parameters do not hold.** This is
 *   the same repair once it is dispatched, and it is the case that matters.
 *   Core's `prepareElementTargetAction` runs on every policy output dispatch and
 *   rewrites `parameters.target` through its element-target normalizer, which
 *   drops `handles` and `handleResolution`. The repair arrives here as
 *   `{ kind, fingerprint, source: "runtime" }`, indistinguishable by shape from
 *   Core's re-derivation of an unrepaired node. It is told apart by content. A
 *   re-derivation reads nothing but the node's own parameters, its `element`,
 *   and their `metadata`, `visualTarget` and `attributes`. So every value it
 *   names is one of their strings, trimmed and cut at Core's length bound. A
 *   repair to a renamed control names a label the recording never held.
 *
 * Only descriptive signals are compared, never `selector` or `xpath`. A target
 * that only *locates* the recorded control somewhere else keeps the recorded
 * identity, and the page still checks the new location against it. The
 * selector itself comes from the adapted target either way.
 *
 * Before this rule only the first case counted. An applied repair on a
 * recorded Flow therefore dispatched the repaired selector with the stale
 * recorded identity, and the page's veto refused the control the repair named
 * (D-1, reports/w2-back-half-design.md). The measurement is in
 * reports/w2-w1-repair-precedence.md.
 *
 * What it costs, named: a repair that happens to name only values the recording
 * already holds keeps the recorded identity. That is the pre-D-1 behaviour, and
 * the page then judges the repair by the recording.
 */
export function adaptedTargetSupersedesRecording(parameters: JsonObject): boolean {
  const adaptedTarget = objectValue(parameters.target);
  if (!adaptedTarget) return false;
  if (adaptedTarget.selectedCandidate !== undefined) return true;
  if (isRepairResolution(adaptedTarget)) return true;
  const named = firstElementFingerprint([adaptedTarget.element, adaptedTarget.fingerprint, adaptedTarget]);
  if (!named) return false;
  const recorded = recordedStrings(parameters);
  return DESCRIPTIVE_SIGNALS.some((signal) => {
    const value = named[signal];
    return typeof value === "string" && value.trim() !== "" && !recorded.has(comparableText(value));
  });
}

/** The signals that say what an element is, as `elementFingerprint` names them. Where it sits is not among them. */
const DESCRIPTIVE_SIGNALS = ["visibleText", "text", "accessibleName", "label", "id", "testId", "tagName", "role", "implicitRole"] as const satisfies readonly (keyof WebAutomationElementFingerprint)[];

/** Core's `truncate` bound on every string its element-target normalizer keeps (`model/action-element-target.ts`). */
const CORE_SIGNAL_LENGTH = 1_000;

/** The shape `validateWebRuntimeTargetOverrideEvidence` resolves a repair to, before Core has rewritten it. */
function isRepairResolution(target: JsonObject): boolean {
  return objectValue(target.handles) !== undefined && (target.handleResolution === "named" || target.handleResolution === "inferred");
}

/**
 * Every string Core's re-derivation of this node could have copied. It reads
 * the node's parameters and their `element`, each with its `metadata` and
 * `visualTarget`, and the `attributes` of any of those. Keys are ignored on
 * purpose: Core folds `text` into `visibleText`, `implicitRole` into `role` and
 * `elementId` into `id`, and whatever it folds, it folds from these values.
 */
function recordedStrings(parameters: JsonObject): Set<string> {
  const element = objectValue(parameters.element);
  const described = [parameters, element].flatMap((source) => source ? [source, objectValue(source.metadata), objectValue(source.visualTarget)] : []);
  const strings = new Set<string>();
  for (const source of described) {
    for (const value of [...Object.values(source ?? {}), ...Object.values(objectValue(source?.attributes) ?? {})]) {
      if (typeof value !== "string") continue;
      strings.add(comparableText(value));
      strings.add(comparableText(value.trim().slice(0, CORE_SIGNAL_LENGTH)));
    }
  }
  return strings;
}

/** A value as the comparison sees it. Core trims but keeps case; ignoring case only makes a re-derivation easier to recognise. */
function comparableText(value: string): string {
  return value.trim().toLowerCase();
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
    tablePosition: tablePosition(context.tablePosition),
    record: elementRecord(context.record)
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

/**
 * Which record the element sat in. The one field of `context` the page acts on
 * rather than merely carries: `content/action-runtime/resolve-target.ts` refuses
 * a match in another record, so dropping it here would not lose a hint, it would
 * put the wrong-record click back.
 *
 * A record with nothing in it is `undefined`, for the reason the context around
 * it is: an empty object reads as "asked, and the page said nothing", and the
 * recorder emits no record at all for a control that sits in none.
 */
function elementRecord(value: unknown): WebAutomationElementContext["record"] {
  const record = objectValue(value);
  if (!record) return undefined;
  const fields = compact({
    keyAttribute: stringValue(record.keyAttribute),
    key: stringValue(record.key),
    text: stringValue(record.text)
  } satisfies ContractFields<NonNullable<WebAutomationElementContext["record"]>>);
  return Object.keys(fields).length > 0 ? fields as NonNullable<WebAutomationElementContext["record"]> : undefined;
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
