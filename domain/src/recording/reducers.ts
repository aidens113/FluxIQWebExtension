import type { RecordingDomainEventReducer } from "fluxiq/automation-studio";
import { withWebStateValue } from "./state";

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
  if (payload.viewport && typeof payload.viewport === "object") next = withWebStateValue(next, "page.viewport", payload.viewport, source);
  if (payload.element && typeof payload.element === "object") next = withWebStateValue(next, "page.lastInteraction", payload.element, source);
  if (typeof payload.inputValue === "string" && event.target?.selector) {
    next = withWebStateValue(next, `forms.${String(event.target.selector)}`, payload.inputValue, source);
  }
  if (payload.scroll && typeof payload.scroll === "object") next = withWebStateValue(next, "page.scroll", payload.scroll, source);
  if (payload.snapshot && typeof payload.snapshot === "object") next = withWebStateValue(next, "page.latestSnapshot", payload.snapshot, source);
  if (payload.actionResult && typeof payload.actionResult === "object") next = withWebStateValue(next, "runtime.lastActionResult", payload.actionResult, source);
  if (event.eventType === "web.client.error") next = withWebStateValue(next, "runtime.lastError", payload, source);

  return next;
};
