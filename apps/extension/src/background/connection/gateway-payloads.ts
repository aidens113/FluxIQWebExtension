// Recorded browser events, shaped into the client-gateway payloads the FluxIQ
// web-automation domain expects. The wire-visible field names live here.

import {
  createWebAutomationRecordingEvent,
  webAutomationActionResultPayload,
  webAutomationActionVisualTargetFromElement,
  webAutomationInputIdForRecordedEvent
} from "@fluxiq-web-extension/domain/client";
import type { ClientGatewayRecordingEvent, JsonObject, RecordingEventPayload } from "../../shared/protocol";
import { compactObject } from "./value-readers";

// The registered web-automation input a recorded event maps to, or undefined
// when the event is passive evidence rather than an executable action.
export function recordedInputId(payload: RecordingEventPayload) {
  return webAutomationInputIdForRecordedEvent({
    kind: payload.kind,
    url: payload.url,
    title: payload.title,
    sequence: payload.sequence,
    ...(payload.element ? { element: elementTarget(payload.element) } : {}),
    ...(payload.visualTarget ? { visualTarget: payload.visualTarget as unknown as JsonObject } : {}),
    ...(payload.inputValue !== undefined ? { inputValue: payload.inputValue } : {}),
    ...(payload.key !== undefined ? { key: payload.key } : {}),
    ...(payload.scroll ? { scroll: payload.scroll } : {}),
    ...(payload.metadata ? { metadata: payload.metadata } : {})
  });
}

export function recordingEvidencePayload(payload: RecordingEventPayload): JsonObject {
  const visualTarget = visualTargetFromPayload(payload);
  return compactObject({
    kind: payload.kind,
    url: payload.url,
    title: payload.title,
    sequence: payload.sequence,
    timestamp: payload.eventTimestampMs,
    element: payload.element as unknown as JsonObject,
    visualTarget: visualTarget as unknown as JsonObject,
    snapshot: payload.snapshot as unknown as JsonObject,
    inputValue: payload.inputValue,
    key: payload.key,
    scroll: payload.scroll as unknown as JsonObject,
    mutation: payload.mutation as unknown as JsonObject,
    actionResult: payload.actionResult as unknown as JsonObject,
    metadata: payload.metadata
  }) as JsonObject;
}

export function gatewayRecordingEventFromPayload(payload: RecordingEventPayload, tabId?: number, frameId?: number, recordingId?: string): ClientGatewayRecordingEvent {
  const inputId = recordedInputId(payload);
  const visualTarget = visualTargetFromPayload(payload);
  return createWebAutomationRecordingEvent({
    kind: payload.kind,
    sequence: payload.sequence,
    url: payload.url,
    title: payload.title,
    eventTimestampMs: payload.eventTimestampMs,
    element: payload.element ? elementTarget(payload.element) : undefined,
    visualTarget: visualTarget as unknown as JsonObject | undefined,
    snapshot: payload.snapshot as unknown as JsonObject,
    inputValue: payload.inputValue,
    key: payload.key,
    scroll: payload.scroll as unknown as JsonObject,
    mutation: payload.mutation as unknown as JsonObject,
    actionResult: payload.actionResult ? webAutomationActionResultPayload(payload.actionResult as never) : undefined,
    metadata: inputId === undefined
      ? payload.metadata
      : { ...(payload.metadata ?? {}), inputId, ...(visualTarget ? { visualTarget: visualTarget as unknown as JsonObject } : {}) }
  }, {
    ...(recordingId !== undefined ? { recordingId } : {}),
    ...(tabId !== undefined ? { tabId } : {}),
    ...(frameId !== undefined ? { frameId } : {})
  });
}

function elementTarget(element: { selector: string; tagName: string; xpath?: string | undefined; id?: string | undefined; classNames?: string[] | undefined; visibleText?: string | undefined; text?: string | undefined; value?: string | undefined; role?: string | undefined; name?: string | undefined; href?: string | undefined; inputType?: string | undefined; bounds?: unknown; documentBounds?: unknown; isVisibleOnViewport?: boolean | undefined; hasClickHandler?: boolean | undefined; attributes?: Record<string, string> | undefined }): JsonObject {
  return compactObject({
    selector: element.selector,
    tagName: element.tagName,
    xpath: element.xpath,
    id: element.id,
    classNames: element.classNames,
    visibleText: element.visibleText,
    text: element.text,
    value: element.value,
    role: element.role,
    name: element.name,
    href: element.href,
    inputType: element.inputType,
    bounds: element.bounds as JsonObject,
    documentBounds: element.documentBounds as JsonObject,
    isVisibleOnViewport: element.isVisibleOnViewport,
    hasClickHandler: element.hasClickHandler,
    attributes: element.attributes as JsonObject
  }) as JsonObject;
}

function visualTargetFromPayload(payload: RecordingEventPayload) {
  return payload.visualTarget ?? (payload.element
    ? webAutomationActionVisualTargetFromElement(payload.element as never)
    : undefined);
}
