import type { ClientGatewayActionCommand, ClientGatewayRecordingEvent, ClientGatewaySnapshot, ClientGatewayStateUpdate } from "@fluxiq/client-gateway-websocket";
import type { JsonObject } from "fluxiq/core";
import { WEB_AUTOMATION_DOMAIN_ID, WEB_AUTOMATION_EVENTS, type WebAutomationEventType } from "../constants";
import {
  WEB_AUTOMATION_ACTION_TO_LEGACY_BROWSER,
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
  snapshot?: JsonObject | undefined;
  inputValue?: string | undefined;
  key?: string | undefined;
  scroll?: JsonObject | undefined;
  mutation?: JsonObject | undefined;
  actionResult?: JsonObject | undefined;
  metadata?: JsonObject | undefined;
};

export function webAutomationEventTypeForClientKind(kind: string): WebAutomationEventType {
  if (kind === "content.ready") return WEB_AUTOMATION_EVENTS.clientReady;
  if (kind === "browser.tab") return WEB_AUTOMATION_EVENTS.tabStateChanged;
  if (kind === "browser.navigation") return WEB_AUTOMATION_EVENTS.pageNavigated;
  if (kind === "dom.click") return WEB_AUTOMATION_EVENTS.elementClicked;
  if (kind === "dom.input") return WEB_AUTOMATION_EVENTS.elementInputChanged;
  if (kind === "dom.change") return WEB_AUTOMATION_EVENTS.elementChanged;
  if (kind === "dom.submit") return WEB_AUTOMATION_EVENTS.formSubmitted;
  if (kind === "dom.focus") return WEB_AUTOMATION_EVENTS.elementFocused;
  if (kind === "dom.blur") return WEB_AUTOMATION_EVENTS.elementBlurred;
  if (kind === "dom.keydown") return WEB_AUTOMATION_EVENTS.keyboardPressed;
  if (kind === "dom.wheel") return WEB_AUTOMATION_EVENTS.mouseWheel;
  if (kind === "dom.scroll") return WEB_AUTOMATION_EVENTS.scrollChanged;
  if (kind === "dom.mutation") return WEB_AUTOMATION_EVENTS.domMutated;
  if (kind === "dom.snapshot") return WEB_AUTOMATION_EVENTS.snapshotCaptured;
  if (kind === "action.result") return WEB_AUTOMATION_EVENTS.actionExecuted;
  return WEB_AUTOMATION_EVENTS.clientError;
}

export function createWebAutomationRecordingEvent(payload: WebAutomationRecordedPayload, input: { tabId?: number; frameId?: number } = {}): ClientGatewayRecordingEvent {
  const eventType = webAutomationEventTypeForClientKind(payload.kind);
  const target = payload.element;
  return {
    eventId: `web.${payload.sequence}.${payload.eventTimestampMs}`,
    domainId: WEB_AUTOMATION_DOMAIN_ID,
    eventType,
    timestamp: payload.eventTimestampMs,
    ...(input.tabId === undefined ? {} : { sourceId: `tab:${input.tabId}${input.frameId === undefined ? "" : `:frame:${input.frameId}`}` }),
    ...(target !== undefined ? { target } : {}),
    payload: compactJsonObject({
      url: payload.url,
      title: payload.title,
      sequence: payload.sequence,
      element: payload.element,
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

export function createWebAutomationStructuredSnapshot(input: { snapshotId?: string; timestamp?: number; state?: JsonObject; payload?: JsonObject; metadata?: JsonObject }): ClientGatewaySnapshot {
  return {
    ...(input.snapshotId !== undefined ? { snapshotId: input.snapshotId } : {}),
    ...(input.timestamp !== undefined ? { timestamp: input.timestamp } : {}),
    kind: "structured",
    ...(input.state !== undefined ? { state: input.state } : {}),
    ...(input.payload !== undefined ? { payload: input.payload } : {}),
    metadata: compactJsonObject({
      domainId: WEB_AUTOMATION_DOMAIN_ID,
      ...(input.metadata ?? {})
    })
  };
}

export function webAutomationActionFromGatewayCommand(command: ClientGatewayActionCommand & { commandId: string }): WebAutomationActionCommand {
  const parameters = command.parameters ?? {};
  const target = command.target ?? {};
  const actionType = normalizeWebAutomationActionType(command.actionType);
  return compactJsonObject({
    commandId: command.commandId,
    actionType,
    selector: stringValue(target.selector) ?? stringValue(parameters.selector),
    text: stringValue(parameters.text),
    value: stringValue(parameters.value),
    key: stringValue(parameters.key),
    url: stringValue(parameters.url),
    timeoutMs: numberValue(command.timeoutMs ?? parameters.timeoutMs),
    coordinates: pointValue(target.coordinates ?? parameters.coordinates),
    options: parameters
  }) as unknown as WebAutomationActionCommand;
}

export function legacyBrowserActionType(actionType: WebAutomationActionType): string {
  return WEB_AUTOMATION_ACTION_TO_LEGACY_BROWSER[actionType];
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
    snapshot: result.snapshot,
    extracted: result.extracted,
    startedAt: result.startedAt,
    finishedAt: result.finishedAt
  });
}

function normalizeWebAutomationActionType(actionType: string): WebAutomationActionType {
  if (actionType.startsWith("web.")) return actionType as WebAutomationActionType;
  const legacy = {
    "browser.navigate": "web.browser.navigate",
    "dom.click": "web.dom.click",
    "dom.type": "web.dom.type",
    "dom.clear": "web.dom.clear",
    "dom.select": "web.dom.select",
    "dom.scroll": "web.dom.scroll",
    "dom.keypress": "web.dom.keypress",
    "dom.wait_for_selector": "web.dom.wait_for_selector",
    "dom.wait_for_text": "web.dom.wait_for_text",
    "dom.extract": "web.dom.extract",
    "dom.capture_snapshot": "web.dom.capture_snapshot"
  } as Record<string, WebAutomationActionType>;
  return legacy[actionType] ?? "web.dom.extract";
}

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

function compactJsonObject(value: Record<string, unknown>): JsonObject {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as JsonObject;
}
