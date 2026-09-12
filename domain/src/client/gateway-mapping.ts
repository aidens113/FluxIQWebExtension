import type { ClientGatewayActionCommand, ClientGatewayRecordingEvent, ClientGatewayStateUpdate } from "@fluxiq/client-gateway-websocket";
import type { AutomationStudioFailureRecord } from "fluxiq/automation-studio";
import type { JsonObject } from "fluxiq/core";
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
  type WebAutomationElementFingerprint
} from "../actions/types";
import { elementFingerprint } from "../output-nodes";
import { WEB_AUTOMATION_FAILURE_CODES, webAutomationFailureRecord } from "../runtime/failure";
import { WEB_AUTOMATION_WITHHELD_COMPARISON_TEXT, isProducerRedactedComparison, isSensitiveElementDescriptor } from "../sensitivity";
import { webAutomationLiftedActionParameters } from "./gateway-action-parameters";

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
  metadata?: JsonObject | undefined;
};

/** A gateway command whose action type is not a web automation action. Nothing is dispatched for it. */
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
 * to a rejection carrying Core's failure record when its action type is
 * unknown. An unknown type is never rewritten into some other action.
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
    ...webAutomationLiftedActionParameters(parameters),
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
 *   populates `candidates` yet. Core's normalization reads only the parameters'
 *   own top-level keys and never looks inside `parameters.element`, so the
 *   fingerprint it writes back is `{ selector, statePath }` and the wire target
 *   is a lossy copy of the same recorded element. Measured on the real path: 11
 *   identity signals before Core prepares the target, 1 after. Taking the
 *   target first there would hand the page a selector and nothing else — worse
 *   than the untyped `options.element` beside it, which is the whole reason a
 *   declared field is worth having.
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
    extracted: result.extracted,
    startedAt: result.startedAt,
    finishedAt: result.finishedAt
  });
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

