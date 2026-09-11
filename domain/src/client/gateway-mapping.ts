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
  type WebAutomationActionType
} from "../actions/types";

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
    options: parameters
  }) as unknown as WebAutomationActionCommand;
}

export function webAutomationActionResultPayload(result: WebAutomationActionResult): JsonObject {
  return compactJsonObject({
    commandId: result.commandId,
    actionType: result.actionType,
    status: result.status,
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
 */
const UNSUPPORTED_ACTION_TYPE_FAILURE: AutomationStudioFailureRecord = Object.freeze({
  category: "blocked_by_capability_or_policy",
  code: "web.action.unsupported_type",
  retryable: false,
  stage: "dispatch"
});

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
