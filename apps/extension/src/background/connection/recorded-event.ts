// What a recorded browser event is: whether it maps to an executable action,
// whether it needs state evidence, how it is identified, and how it reads in
// the activity log.

import type { RecordingEventPayload } from "../../shared/protocol";
import { recordedInputId } from "./gateway-payloads";
import { rectValue } from "./value-readers";

export function isExecutableRecordedAction(payload: RecordingEventPayload): boolean {
  return recordedInputId(payload) !== undefined;
}

export function shouldRequireStateForEvidence(payload: RecordingEventPayload): boolean {
  return isExecutableRecordedAction(payload) ||
    payload.kind === "action.result" ||
    payload.kind === "browser.navigation" ||
    payload.kind === "dom.click" ||
    payload.kind === "dom.input" ||
    payload.kind === "dom.change" ||
    payload.kind === "dom.submit" ||
    payload.kind === "dom.keydown";
}

export function isNavigationExplanation(payload: RecordingEventPayload): boolean {
  return payload.kind === "dom.click" || payload.kind === "dom.submit";
}

export function stateScreenshotEventKey(payload: RecordingEventPayload): string {
  return `${payload.kind}:${payload.sequence}:${payload.eventTimestampMs}`;
}

export function stateSnapshotIdFromPayload(payload: RecordingEventPayload): string {
  const kind = payload.kind.replace(/[^a-z0-9_.-]+/gi, "-");
  return `state.${kind}.${payload.sequence}.${payload.eventTimestampMs}`;
}

// A pointerdown and the click that follows it describe one user action. The
// signature is what lets the second be dropped.
export function clickEventSignature(payload: RecordingEventPayload, tabId?: number, frameId?: number): string | undefined {
  const element = payload.element;
  if (!element) return undefined;
  const bounds = rectValue(element.bounds);
  return [
    tabId ?? "tab",
    frameId ?? "frame",
    element.selector,
    bounds ? Math.round(bounds.x) : "",
    bounds ? Math.round(bounds.y) : "",
    bounds ? Math.round(bounds.width) : "",
    bounds ? Math.round(bounds.height) : ""
  ].join("|");
}

export function activityLabel(payload: RecordingEventPayload): string {
  if (payload.kind === "dom.click") return "Click";
  if (payload.kind === "dom.input") return "Input changed";
  if (payload.kind === "dom.change") return "Field changed";
  if (payload.kind === "dom.submit") return "Form submitted";
  if (payload.kind === "dom.keydown") return `Key ${payload.key ?? ""}`.trim();
  if (payload.kind === "dom.wheel") return "Mouse wheel";
  if (payload.kind === "dom.scroll") return "Page scrolled";
  if (payload.kind === "dom.mutation") return "DOM changed";
  if (payload.kind === "browser.navigation") return "Navigation";
  if (payload.kind === "action.result") return "Action result";
  return payload.kind;
}

export function activityDetail(payload: RecordingEventPayload): string | undefined {
  if (payload.element?.name) return payload.element.name;
  if (payload.element?.text) return payload.element.text;
  if (payload.element?.selector) return payload.element.selector;
  if (payload.scroll) return `${payload.scroll.x}, ${payload.scroll.y}`;
  if (payload.mutation) return `${payload.mutation.added} added, ${payload.mutation.removed} removed`;
  if (payload.url) return payload.url;
  return undefined;
}
