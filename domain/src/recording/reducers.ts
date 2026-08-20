import type { RecordingDomainEventReducer, StateSnapshot } from "fluxiq/automation-studio";
import { withWebStateValue } from "./state";
import { createWebAutomationStateFromSnapshot, type WebAutomationDomSnapshotInput } from "./web-state";

export const webAutomationStateReducer: RecordingDomainEventReducer = ({ event, previousState }) => {
  const payload = event.payload ?? {};
  const timestamp = event.timestamp ?? Date.now();
  let next = previousState;
  const source = {
    observedAt: timestamp,
    ...(event.sourceId !== undefined ? { sourceId: event.sourceId } : {}),
    metadata: { eventType: event.eventType }
  };

  if (typeof payload.url === "string") next = withWebStateValue(next, "page.url", payload.url, source);
  if (typeof payload.title === "string") next = withWebStateValue(next, "page.title", payload.title, source);
  if (payload.element && typeof payload.element === "object") next = withWebStateValue(next, "focus.target", payload.element, source);
  if (typeof payload.inputValue === "string" && event.target?.selector) {
    next = withWebStateValue(next, `forms.${String(event.target.selector)}`, payload.inputValue, source);
  }
  if (payload.scroll && typeof payload.scroll === "object") next = withWebStateValue(next, "scroll.position", payload.scroll, source);
  if (isSnapshotPayload(payload.snapshot)) {
    const snapshotOptions: { timestamp?: number; sourceId?: string } = { timestamp };
    if (event.sourceId !== undefined) snapshotOptions.sourceId = event.sourceId;
    next = mergeWebState(next, createWebAutomationStateFromSnapshot(payload.snapshot, snapshotOptions));
  }
  if (payload.actionResult && typeof payload.actionResult === "object") next = withWebStateValue(next, "runtime.lastActionResult", payload.actionResult, source);
  if (payload.visualTarget && typeof payload.visualTarget === "object") next = withWebStateValue(next, "runtime.lastActionVisualTarget", payload.visualTarget, source);
  if (event.eventType === "web.client.error") next = withWebStateValue(next, "runtime.lastError", payload, source);

  return next;
};

function isSnapshotPayload(value: unknown): value is WebAutomationDomSnapshotInput {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Partial<WebAutomationDomSnapshotInput>;
  return typeof snapshot.url === "string" &&
    typeof snapshot.title === "string" &&
    Boolean(snapshot.viewport && typeof snapshot.viewport === "object") &&
    Array.isArray(snapshot.interactiveElements);
}

function mergeWebState(previous: StateSnapshot, incoming: StateSnapshot): StateSnapshot {
  const previousWeb = previous.namespaces.web;
  const incomingWeb = incoming.namespaces.web;
  if (!incomingWeb) return previous;
  const metadata = incomingWeb.metadata ?? previousWeb?.metadata;
  return {
    ...previous,
    timestamp: incoming.timestamp,
    namespaces: {
      ...previous.namespaces,
      web: {
        schemaId: incomingWeb.schemaId,
        schemaVersion: incomingWeb.schemaVersion,
        ...(metadata !== undefined ? { metadata } : {}),
        values: {
          ...(previousWeb?.values ?? {}),
          ...incomingWeb.values
        }
      }
    }
  };
}
