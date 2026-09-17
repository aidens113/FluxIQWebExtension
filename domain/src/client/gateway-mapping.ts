import type { ClientGatewayActionCommand, ClientGatewayRecordingEvent, ClientGatewayStateUpdate } from "@fluxiq/client-gateway-websocket";
import type { AutomationStudioFailureRecord } from "fluxiq/automation-studio";
import type { JsonObject, JsonValue } from "fluxiq/core";
import { WEB_AUTOMATION_DOMAIN_ID } from "../constants";
import { webAutomationEventTypeForClientKind } from "../io/input-model";
import { webAutomationActionTargetFromElement, webAutomationActionVisualTargetFromElement, type WebAutomationElementStateInput } from "../recording/web-state";
import {
  WEB_AUTOMATION_ACTION_TO_LEGACY_BROWSER,
  WEB_AUTOMATION_ACTION_TYPES,
  type WebAutomationActionVisualTarget,
  type WebAutomationActionCommand,
  type WebAutomationActionResult,
  type WebAutomationActionType,
  type WebAutomationActionValidation,
  type WebAutomationDialogKind,
  type WebAutomationElementFingerprint,
  type WebAutomationObservedDialog
} from "../actions/types";
import { webAutomationExtractionSummaryValue, webAutomationRecordedExtraction, type WebAutomationExtractListRequest } from "../actions/extraction";
import { webAutomationStructureDetectionValue } from "../extraction";
import { webAutomationActionDefinitions } from "../actions/schemas";
import { elementFingerprint, webAutomationUnresolvedSecretParameters, webAutomationUploadBindingPath } from "../output-nodes";
import { WEB_AUTOMATION_FAILURE_CODES, webAutomationFailureRecord } from "../runtime/failure";
import { WEB_AUTOMATION_WITHHELD_COMPARISON_TEXT, isProducerRedactedComparison, isSensitiveElementDescriptor } from "../sensitivity";
import { webAutomationReadActionParameters } from "./gateway-action-parameters";

export type WebAutomationRecordedPayload = {
  kind: string;
  sequence: number;
  url: string;
  title: string;
  eventTimestampMs: number;
  element?: JsonObject | undefined;
  visualTarget?: JsonObject | undefined;
  snapshot?: JsonObject | undefined;
  inputValue?: string | undefined;
  key?: string | undefined;
  scroll?: JsonObject | undefined;
  mutation?: JsonObject | undefined;
  actionResult?: JsonObject | undefined;
  /** Only on a recorded tab switch or close. The recording-start marker carries none, which is what keeps it evidence. */
  tab?: WebAutomationRecordedTab | undefined;
  /** Only on a recorded extraction: the definition the picker produced, stored as the reader rebuilds it. */
  extraction?: JsonObject | undefined;
  metadata?: JsonObject | undefined;
};

/**
 * A tab change the user made while recording. A switch names the tab it went
 * to by the exact pathname of its URL: tab ids do not survive to a replay,
 * origins differ run to run, and a query may carry tokens. A close names
 * nothing, because replay closes the tab it is driving.
 */
export type WebAutomationRecordedTab = { operation: "switch" | "close"; urlPath?: string | undefined };

/**
 * A gateway command nothing is dispatched for: its action type is not a web
 * automation action, it still asks for a value the run never supplied, or a
 * field its action requires was sent in a shape that cannot be read.
 */
export type WebAutomationActionRejection = {
  commandId: string;
  status: "rejected";
  /** The action type as requested, unaltered. */
  actionType: string;
  message: string;
  /** Core's structured failure for the rejection; the extension reports it on the wire as `failure`. */
  failure: AutomationStudioFailureRecord;
};

export type WebAutomationActionTypeNormalization =
  | { ok: true; actionType: WebAutomationActionType }
  | { ok: false; failure: AutomationStudioFailureRecord; message: string };

export function createWebAutomationRecordingEvent(payload: WebAutomationRecordedPayload, input: { tabId?: number; frameId?: number; recordingId?: string } = {}): ClientGatewayRecordingEvent {
  const eventType = webAutomationEventTypeForClientKind(payload.kind);
  const target = payload.element;
  const visualTarget = payload.visualTarget ?? (target !== undefined
    ? webAutomationActionVisualTargetFromElement(target as unknown as WebAutomationElementStateInput) as unknown as JsonObject
    : undefined);
  return {
    eventId: `web.${payload.sequence}.${payload.eventTimestampMs}`,
    ...(input.recordingId !== undefined ? { recordingId: input.recordingId } : {}),
    domainId: WEB_AUTOMATION_DOMAIN_ID,
    eventType,
    timestamp: payload.eventTimestampMs,
    ...(input.tabId === undefined ? {} : { sourceId: `tab:${input.tabId}${input.frameId === undefined ? "" : `:frame:${input.frameId}`}` }),
    ...(target !== undefined ? { target: webAutomationActionTargetFromElement(target as unknown as WebAutomationElementStateInput) as unknown as JsonObject } : {}),
    payload: compactJsonObject({
      url: payload.url,
      title: payload.title,
      sequence: payload.sequence,
      // The frame the interaction happened in, under the name the parameter
      // lift reads (`gateway-action-parameters.ts` maps `browserFrameId` onto
      // `action.frameId`). `sourceId` above names the same frame, but only as
      // text nothing downstream parses, and `webAutomationOutputPayload` reads
      // this payload rather than the envelope: without the field here, a click
      // recorded inside an iframe replays against the top document. Frame 0 is
      // the top frame and survives `compactJsonObject`, which drops only
      // `undefined`.
      browserFrameId: input.frameId,
      element: payload.element,
      visualTarget,
      inputValue: payload.inputValue,
      key: payload.key,
      scroll: payload.scroll,
      mutation: payload.mutation,
      snapshot: payload.snapshot,
      actionResult: payload.actionResult,
      // Only the two declared fields are copied, so nothing else a caller put on
      // the tab change -- a tab id, a full URL -- reaches the stored recording.
      tab: payload.tab === undefined ? undefined : { operation: payload.tab.operation, ...(payload.tab.urlPath !== undefined ? { urlPath: payload.tab.urlPath } : {}) },
      // Rebuilt field by field rather than passed through, so no sample value
      // and no unknown key the picker put beside the definition is stored (D3).
      extraction: webAutomationRecordedExtraction(payload.extraction),
      ...(payload.metadata?.recordingState !== undefined ? { recordingState: payload.metadata.recordingState } : {})
    }),
    metadata: compactJsonObject({
      clientKind: payload.kind,
      ...(visualTarget !== undefined ? { visualTarget } : {}),
      ...(payload.metadata ?? {})
    })
  };
}

export function createWebAutomationStateUpdate(input: { activeContextId?: string; contexts?: JsonObject[]; recording?: boolean; state?: JsonObject; metadata?: JsonObject }): ClientGatewayStateUpdate {
  return {
    ...(input.activeContextId !== undefined ? { activeContextId: input.activeContextId } : {}),
    ...(input.contexts !== undefined ? { contexts: input.contexts } : {}),
    ...(input.state !== undefined ? { state: input.state } : {}),
    ...(input.recording !== undefined ? { recording: input.recording } : {}),
    metadata: compactJsonObject({
      domainId: WEB_AUTOMATION_DOMAIN_ID,
      ...(input.metadata ?? {})
    })
  };
}

/**
 * Maps a gateway action command to the browser command the extension runs, or
 * to a rejection carrying Core's failure record. Three things refuse a command,
 * checked in this order: an unknown action type, which is never rewritten into
 * some other action; a value the run never supplied; and a field the action
 * requires that was sent in a shape nothing can read.
 *
 * The flat fields below come from the command's target and envelope. Every
 * structured parameter is read by `gateway-action-parameters.ts` onto the
 * command field the verb running the action reads, and a value it refuses is
 * left absent rather than coerced. The raw parameters still travel in
 * `options`, so nothing a Flow sent is lost on the way to the page.
 */
export function webAutomationActionFromGatewayCommand(command: ClientGatewayActionCommand & { commandId: string }): WebAutomationActionCommand | WebAutomationActionRejection {
  const normalized = normalizeWebAutomationActionType(command.actionType);
  if (!normalized.ok) {
    return { commandId: command.commandId, status: "rejected", actionType: command.actionType, message: normalized.message, failure: normalized.failure };
  }
  const parameters = command.parameters ?? {};
  // A request the run never answered would otherwise read as absent text and
  // type nothing, reporting success. Refused instead, by name and path only.
  // An unanswered upload request is named the same way: read as an upload it is
  // no file list, and would be refused as an unreadable parameter instead.
  const uploadPath = webAutomationUploadBindingPath(parameters.upload);
  const unmet = [...webAutomationUnresolvedSecretParameters(parameters), ...(uploadPath !== undefined ? [{ parameter: "upload", path: uploadPath }] : [])];
  if (unmet.length > 0) {
    return { commandId: command.commandId, status: "rejected", actionType: command.actionType, message: unsuppliedValueMessage(unmet), failure: unsuppliedValueFailure(unmet) };
  }
  // A required field the reader refused would reach the verb as half a request.
  // Refused whole instead, naming the action and the fields, never their values.
  const { lifted, refused } = webAutomationReadActionParameters(parameters);
  const required = requiredParameters(normalized.actionType);
  const unreadable = refused.filter((field) => required.includes(field));
  if (unreadable.length > 0) {
    return { commandId: command.commandId, status: "rejected", actionType: command.actionType, message: unreadableFieldMessage(normalized.actionType, unreadable), failure: unreadableFieldFailure(normalized.actionType, unreadable) };
  }
  // A well-formed request for the Encrypt column, which is not built yet (D13,
  // D14). Read as `include` it would send the values in clear; read as `exclude`
  // it would drop a column the Flow asked to keep. Refused, by field key only.
  const encrypted = normalized.actionType === "web.dom.extract_list" ? encryptedFieldKeys(lifted.extractList) : [];
  if (encrypted.length > 0) {
    return { commandId: command.commandId, status: "rejected", actionType: command.actionType, message: encryptedFieldMessage(encrypted), failure: encryptedFieldFailure(encrypted) };
  }
  const target = command.target ?? {};
  return compactJsonObject({
    commandId: command.commandId,
    actionType: normalized.actionType,
    selector: stringValue(target.selector) ?? stringValue(parameters.selector),
    text: stringValue(parameters.text),
    value: stringValue(parameters.value),
    key: stringValue(parameters.key),
    url: stringValue(parameters.url),
    timeoutMs: numberValue(command.timeoutMs ?? parameters.timeoutMs),
    coordinates: pointValue(target.coordinates ?? parameters.coordinates),
    visualTarget: jsonObject(target.visualTarget ?? parameters.visualTarget) as unknown as WebAutomationActionVisualTarget | undefined,
    element: commandElementFingerprint(target, parameters),
    ...lifted,
    options: parameters
  }) as unknown as WebAutomationActionCommand;
}

/**
 * The recorded element's identity, promoted from the wire onto a field the
 * compiler knows about.
 *
 * `options` keeps carrying the raw `parameters.element` unchanged, so the
 * resolver that reads it there keeps working; this field is the declared
 * contract beside it, not a replacement for it. `elementFingerprint` is the
 * same normalizer that put the value on the wire, imported rather than restated
 * so the two ends cannot drift, and an input with no recognized signal
 * normalizes to an empty object, which is not an identity and is dropped rather
 * than dispatched as one.
 */
function commandElementFingerprint(target: JsonObject, parameters: JsonObject): WebAutomationElementFingerprint | undefined {
  for (const source of elementFingerprintSources(target, parameters)) {
    const fingerprint = elementFingerprint(source);
    if (fingerprint && Object.keys(fingerprint).length > 0) return fingerprint as unknown as WebAutomationElementFingerprint;
  }
  return undefined;
}

/**
 * Where to look for that identity, richest description first — which is not
 * always the dispatched target.
 *
 * Core's `prepareElementTargetAction` runs on every policy output dispatch. It
 * normalizes an element target out of the parameters and writes it back as
 * `parameters.target`, and `output-nodes/targets.ts` `outputTargetFromPayload`
 * builds the wire `target.element` from that. Which of the two is better
 * depends on whether Core actually matched anything:
 *
 * - **It matched a runtime candidate** (`selectedCandidate` is set). The wire
 *   target then describes the element the page really has, and it wins over the
 *   recorded one, which may be stale.
 * - **It matched nothing**, which is every dispatch today, because nothing
 *   populates `candidates` yet. Core's normalization now reads
 *   `parameters.element` too, but into Core's fingerprint, which has no
 *   `context`, `checked`, `name`, `href`, `inputType` or `value`, so the target
 *   it writes back is still a lossy copy of the same recorded element (before
 *   that, `{ selector, statePath }`: 11 identity signals measured before Core
 *   prepared the target, 1 after). Taking the target first there would hand the
 *   page less than the untyped `options.element` beside it, which is the whole
 *   reason a declared field is worth having.
 */
function elementFingerprintSources(target: JsonObject, parameters: JsonObject): unknown[] {
  const adaptedTarget = jsonObject(parameters.target);
  return adaptedTarget?.selectedCandidate !== undefined
    ? [target.element, target.fingerprint, parameters.element]
    : [parameters.element, target.element, target.fingerprint];
}

/**
 * The action result as the gateway carries it.
 *
 * `validation` is the post-condition the action checked after it ran, and it is
 * the only place the evidence for a failure lives: `OUTPUT_NOT_OBSERVED` is
 * defined as carrying `expected` and `actual`, and the classifier in
 * `runtime/failure/classify.ts` reads them off the outcome's validation. Until
 * it was carried here the domain could name a failure and never show why, so a
 * Flow saw "the action did not take effect" with nothing behind it.
 *
 * The values are *not* passed through unconditionally. The producer in
 * `content/actions/` redacts them for a sensitive control and that redaction is
 * the one that keeps the phrasing useful, but a security property may not rest
 * on a rule in another package that nothing here can see: this function is the
 * seam that put `validation` on the wire in the first place, so it is where the
 * withholding has to be provable on its own. `webAutomationSecretSafeValidation`
 * below asks the one sensitivity rule about the descriptor riding on the result
 * and withholds both comparison strings when it says yes. Nothing in this
 * function logs a validation value.
 *
 * `resolution` travels beside it, and the two are opposites in the one respect
 * that matters here. A validation is prose a verb built out of the control's
 * own value, so it needs the guard above; `WebAutomationTargetResolution` is a
 * closed six-value `strategy` enum and four numbers, holds nothing derived from
 * the page, and so needs none. It was dropped here until 2026-09-12, correctly,
 * because nothing produced it on a successful action and carrying a field
 * nothing fills is the defect this plan has spent a wave removing. What changed
 * is the producer: `content/action-runtime/resolve-target.ts` now returns the
 * measurement with the element and every verb passes it on, so a Flow can tell
 * a target matched outright from one a scored candidate won by a margin -- D1's
 * promise, and the half of it that a signature returning a bare `Element` had
 * quietly withheld. The candidate *labels* an ambiguous failure names are page
 * text; they ride on the failure record, which `result-mapping.ts` puts on the
 * gateway result rather than in this payload, and they are bounded and filtered
 * where they are built.
 *
 * `extraction` and `dialog` are copied field by field, never passed through.
 * The summary admits only counts, a flag and well-formed field keys
 * (`actions/extraction/summary.ts`), so a producer that put page text beside
 * them sends none of it. The dialog keeps its five declared fields and nothing
 * else a producer added. `structure` is copied the same way
 * (`extraction/structure-detection.ts`): selectors, structural labels, counts
 * and coverage, and nothing else a producer put beside them.
 */
export function webAutomationActionResultPayload(result: WebAutomationActionResult): JsonObject {
  return compactJsonObject({
    commandId: result.commandId,
    actionType: result.actionType,
    status: result.status,
    validation: webAutomationSecretSafeValidation(result.validation, result.element),
    message: result.message,
    url: result.url,
    title: result.title,
    element: result.element,
    visualTarget: result.visualTarget,
    snapshot: result.snapshot,
    extracted: secretSafeExtracted(result.extracted, result.element),
    extraction: webAutomationExtractionSummaryValue(result.extraction),
    dialog: observedDialogValue(result.dialog),
    structure: webAutomationStructureDetectionValue(result.structure),
    resolution: result.resolution,
    startedAt: result.startedAt,
    finishedAt: result.finishedAt
  });
}

/**
 * What a read took off the page, as it may leave the browser: carried for an
 * ordinary element and never for one the sensitivity rule marks (D2).
 *
 * The page refuses every read of a sensitive control, so a sensitive element
 * arriving here with a value is a page-side regression, and this is the wire's
 * own check of it: the same descriptor and the same rule the comparison guard
 * below asks. Unlike a comparison, a read value has no declaration that buys
 * it back. `extracted` is the control's contents rather than prose about them,
 * so there is nothing a producer could have withheld and still sent, and the
 * validation's `redacted` flag and status are not consulted.
 *
 * The reach is the descriptor's, as it is for the comparison: a result with no
 * `element` cannot be judged here and carries what the page sent.
 */
function secretSafeExtracted(extracted: JsonValue | undefined, element: unknown): JsonValue | undefined {
  return isSensitiveElementDescriptor(element) ? undefined : extracted;
}

/**
 * The post-condition as it may leave the browser: unchanged for an ordinary
 * control, kept for a sensitive one the producer declared it already withheld,
 * and stripped of both comparison strings otherwise.
 *
 * The rule is `isSensitiveElementDescriptor` from `domain/src/sensitivity/`,
 * asked of the element descriptor the result already carries -- the same
 * question `recording/reducers.ts` and `runtime/llm-evidence/elements.ts` ask
 * of the same shape. No text is inspected: a predicate over free text would
 * both miss and misfire, and the descriptor is the only thing here that knows
 * which control produced the strings.
 *
 * What the descriptor cannot say is whether the strings are already safe, and
 * withholding a redaction is as lossy as withholding a leak: it costs the
 * producer's phrasing (`the field holds a withheld value of 12 characters`) on
 * every sensitive-control failure. `redacted` on the validation is the
 * producer's declaration that it named a length rather than a value, and it is
 * honoured here. It fails safe when absent -- see
 * `isProducerRedactedComparison` -- so an older client, or a verb nobody taught
 * the flag, is withheld exactly as before. `status`, which is what says whether
 * the post-condition held, is kept either way, and a withheld comparison leaves
 * carrying no flag, deliberately. The flag means "the producer named a length
 * rather than a value", not "this text is safe". Stamping it here conflated the
 * two: this function runs in the extension before the result crosses the wire,
 * so its own stamp was read downstream as the producer's declaration and
 * disarmed the adapter's guard for every extension result. Leaving it off costs
 * nothing -- a second pass withholds already-withheld text and yields the same
 * constant -- and keeps each layer judging the producer, not the layer above.
 *
 * The guard reaches exactly as far as the descriptor does: a result carrying a
 * text-bearing validation and no `element` cannot be judged here, and passes
 * through as the producer wrote it.
 */
export function webAutomationSecretSafeValidation(validation: WebAutomationActionValidation | undefined, element: unknown): WebAutomationActionValidation | undefined {
  if (validation === undefined || validation.status === "none") return validation;
  if (isProducerRedactedComparison(validation)) return validation;
  if (!isSensitiveElementDescriptor(element)) return validation;
  return { status: validation.status, expected: WEB_AUTOMATION_WITHHELD_COMPARISON_TEXT, actual: WEB_AUTOMATION_WITHHELD_COMPARISON_TEXT };
}

/**
 * The one place a requested action type is resolved. A canonical type passes,
 * a legacy dotted alias ("dom.click") becomes its canonical type, and anything
 * else is rejected with Core's failure record rather than guessed at.
 */
export function normalizeWebAutomationActionType(actionType: string): WebAutomationActionTypeNormalization {
  if (CANONICAL_ACTION_TYPES.has(actionType)) return { ok: true, actionType: actionType as WebAutomationActionType };
  const canonical = LEGACY_ACTION_TYPE_ALIASES.get(actionType);
  if (canonical !== undefined) return { ok: true, actionType: canonical };
  const requested = typeof actionType === "string" && actionType.length > 0 ? actionType : "(missing)";
  return { ok: false, failure: UNSUPPORTED_ACTION_TYPE_FAILURE, message: `Unsupported web automation action type: ${requested}` };
}

/**
 * Every rejection's failure, in Core's taxonomy: a client refusing an action
 * type it does not implement is a capability refusal, decided before anything
 * is dispatched, and retrying the same command unchanged can never succeed —
 * which is why Core forbids this category from being retryable. The requested
 * type travels in the result's `metadata`, not in the record, whose text
 * fields are bounded.
 *
 * Built by `webAutomationFailureRecord` rather than written out, which is what
 * holds the code to the closed set. Annotated with Core's
 * `AutomationStudioFailureRecord`, whose `code` is a bare `string` because Core
 * does not own the codes, this was the last record in the tree an invented code
 * could be written into and still compile. The builder emits this row's four
 * fields exactly, so nothing about the wire changed; what changed is that the
 * compiler, rather than a comment, is now what keeps the code correct.
 */
const UNSUPPORTED_ACTION_TYPE_FAILURE = Object.freeze(webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.UNSUPPORTED_TYPE));

/**
 * The refusal of a command that still asks for a value the run never supplied.
 * Only an operator can fix it, by supplying the value, and retrying the command
 * unchanged can never succeed, so it is the closed set's user-intervention code.
 * The text names paths, which identify a control, and never a value.
 */
function unsuppliedValueFailure(unmet: readonly { parameter: string; path: string }[]): AutomationStudioFailureRecord {
  return webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.USER_INTERVENTION_REQUIRED, {
    expected: `values supplied at run time for ${unmet.map((entry) => entry.path).join(", ")}`,
    actual: "the run supplied none, so the action was not dispatched"
  });
}

function unsuppliedValueMessage(unmet: readonly { parameter: string; path: string }[]): string {
  return `Not dispatched: these parameters need values supplied at run time that this run did not supply: ${unmet.map((entry) => `${entry.parameter} (${entry.path})`).join(", ")}`;
}

/**
 * The refusal of a command whose action requires a field that arrived in a
 * shape nothing can read. The node is authored wrong: retrying it unchanged
 * cannot succeed, and Core answers `graph_validation_or_unknown_node` with a
 * structural edit rather than a policy change. The text names the action and
 * the fields, never what was sent in them.
 */
function unreadableFieldFailure(actionType: WebAutomationActionType, fields: readonly string[]): AutomationStudioFailureRecord {
  return webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.INVALID_PARAMETER, {
    expected: `${actionType} with a well-formed ${fields.join(", ")}`,
    actual: `${fields.join(", ")} could not be read, so the action was not dispatched`
  });
}

function unreadableFieldMessage(actionType: WebAutomationActionType, fields: readonly string[]): string {
  return `Not dispatched: ${actionType} requires ${fields.join(", ")}, and what was sent could not be read.`;
}

/** The keys of the fields a list extraction asks to encrypt. A key is a well-formed field key (D16), never a selector or a value. */
function encryptedFieldKeys(request: WebAutomationExtractListRequest | undefined): string[] {
  if (request === undefined) return [];
  return Object.entries(request.fields).filter(([, field]) => typeof field !== "string" && field.handling === "encrypt").map(([key]) => key);
}

/**
 * The refusal of a well-formed request for the Encrypt column. The client does
 * not implement it yet, so it is the closed set's capability refusal, decided at
 * dispatch; retrying unchanged cannot succeed. The text names field keys only.
 */
function encryptedFieldFailure(keys: readonly string[]): AutomationStudioFailureRecord {
  return webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.NOT_IMPLEMENTED, {
    expected: "web.dom.extract_list fields whose column is included or excluded",
    actual: `${namedFieldKeys(keys)} asked to be encrypted, which is not implemented yet, so the action was not dispatched`
  });
}

function encryptedFieldMessage(keys: readonly string[]): string {
  return `Not dispatched: web.dom.extract_list asks to encrypt ${namedFieldKeys(keys)}, and the Encrypt column is not implemented yet.`;
}

/** At most five keys by name, so a wide field map cannot make a refusal unbounded. */
function namedFieldKeys(keys: readonly string[]): string {
  const named = keys.slice(0, 5).join(", ");
  return keys.length > 5 ? `${named} and ${keys.length - 5} more` : named;
}

/**
 * A handled dialog copied field by field, or `undefined` when it is not one.
 * `message` is the page's own text and `promptText` the reply the Flow
 * supplied; both travel as they did when this evidence rode on `extracted`.
 */
function observedDialogValue(value: unknown): WebAutomationObservedDialog | undefined {
  const dialog = jsonObject(value);
  if (!dialog) return undefined;
  const kind = DIALOG_KINDS.find((candidate) => candidate === dialog.kind);
  const response = dialog.response === "accept" || dialog.response === "dismiss" ? dialog.response : undefined;
  if (kind === undefined || response === undefined || typeof dialog.message !== "string") return undefined;
  if (typeof dialog.at !== "number" || !Number.isFinite(dialog.at)) return undefined;
  if (dialog.promptText !== undefined && typeof dialog.promptText !== "string") return undefined;
  return { kind, message: dialog.message, response, at: dialog.at, ...(typeof dialog.promptText === "string" ? { promptText: dialog.promptText } : {}) };
}

const DIALOG_KINDS: readonly WebAutomationDialogKind[] = ["alert", "confirm", "prompt", "beforeunload"];

/** The parameters an action's schema requires, read from the one schema table the way `io/input-model.ts` reads it. */
function requiredParameters(actionType: WebAutomationActionType): string[] {
  const schema = webAutomationActionDefinitions.find((definition) => definition.actionType === actionType)?.parameterSchema;
  return Array.isArray(schema?.required) ? schema.required.filter((key): key is string => typeof key === "string") : [];
}

const CANONICAL_ACTION_TYPES: ReadonlySet<string> = new Set(WEB_AUTOMATION_ACTION_TYPES);

/** Legacy dotted names, derived from the exported canonical -> legacy map so the two cannot drift. */
const LEGACY_ACTION_TYPE_ALIASES: ReadonlyMap<string, WebAutomationActionType> = new Map(
  Object.entries(WEB_AUTOMATION_ACTION_TO_LEGACY_BROWSER).map(([canonical, legacy]): [string, WebAutomationActionType] => [legacy, canonical as WebAutomationActionType])
);

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function pointValue(value: unknown): { x: number; y: number } | undefined {
  if (!value || typeof value !== "object") return undefined;
  const point = value as { x?: unknown; y?: unknown };
  return typeof point.x === "number" && typeof point.y === "number" ? { x: point.x, y: point.y } : undefined;
}

function jsonObject(value: unknown): JsonObject | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : undefined;
}

function compactJsonObject(value: Record<string, unknown>): JsonObject {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as JsonObject;
}

