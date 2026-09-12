// Recorded browser events, folded into the `web` state namespace.
//
// One of those values is durable and secret-bearing: `forms.<selector>` is the
// text a user typed, and a recording is persisted, replayed and shown. The
// extension redacts a sensitive control at the reader, so `inputValue` for a
// password, a one-time code or a card field never reaches this file -- but that
// is the producer's guard, on the far side of a wire, and a regression there
// would silently repopulate secrets into state nobody re-reads. So the reducer
// asks the same question again from the descriptor the event carries, and drops
// the value rather than trusting the answer it was given. Presence is not a
// secret and is unaffected: the event, its target and its element still land.
//
// The question is `isSensitiveElementDescriptor`, the one rule in
// `domain/src/sensitivity/`. This file used to carry its own copy, written
// only because the extension's copy was unreachable from here; the rule now
// lives in this package, so the copy is gone.
//
// An event with no descriptor cannot be judged and is treated as ordinary: the
// recorder always sends one for an input event, and refusing every value on a
// missing field would empty `forms.*` on the strength of a shape change.

import type { RecordingDomainEventReducer, StateSnapshot } from "fluxiq/automation-studio";
import { isSensitiveElementDescriptor } from "../sensitivity";
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
  if (typeof payload.inputValue === "string" && event.target?.selector && !isSensitiveElementDescriptor(payload.element)) {
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
