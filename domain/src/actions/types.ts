import type { JsonObject, JsonValue } from "fluxiq/core";

export type WebAutomationActionType =
  | "web.browser.navigate"
  | "web.dom.click"
  | "web.dom.type"
  | "web.dom.clear"
  | "web.dom.select"
  | "web.dom.scroll"
  | "web.dom.keypress"
  | "web.dom.wait_for_selector"
  | "web.dom.wait_for_text"
  | "web.dom.extract"
  | "web.dom.capture_snapshot";

export type WebAutomationPoint = { x: number; y: number };

export type WebAutomationActionVisualTarget = {
  namespace: "web";
  statePath: string;
  selector?: string | undefined;
  frameId?: string | undefined;
  layerId?: string | undefined;
  documentLayerId?: string | undefined;
  bounds?: { x: number; y: number; width: number; height: number } | undefined;
  documentBounds?: { x: number; y: number; width: number; height: number } | undefined;
  anchor?: { type: "bounds"; bounds: { x: number; y: number; width: number; height: number } } | undefined;
  confidence?: number | undefined;
  metadata?: JsonObject | undefined;
};

export type WebAutomationActionCommand = {
  commandId: string;
  actionType: WebAutomationActionType;
  tabId?: number | undefined;
  frameId?: number | undefined;
  selector?: string | undefined;
  text?: string | undefined;
  value?: string | undefined;
  key?: string | undefined;
  url?: string | undefined;
  timeoutMs?: number | undefined;
  coordinates?: WebAutomationPoint | undefined;
  visualTarget?: WebAutomationActionVisualTarget | undefined;
  options?: JsonObject | undefined;
};

export type WebAutomationActionResult = {
  commandId: string;
  actionType: WebAutomationActionType;
  status: "succeeded" | "failed" | "timed_out" | "cancelled";
  message?: string | undefined;
  url?: string | undefined;
  title?: string | undefined;
  element?: JsonObject | undefined;
  visualTarget?: WebAutomationActionVisualTarget | undefined;
  snapshot?: JsonObject | undefined;
  extracted?: JsonValue | undefined;
  startedAt: number;
  finishedAt: number;
};

export const WEB_AUTOMATION_ACTION_TYPES: WebAutomationActionType[] = [
  "web.browser.navigate",
  "web.dom.click",
  "web.dom.type",
  "web.dom.clear",
  "web.dom.select",
  "web.dom.scroll",
  "web.dom.keypress",
  "web.dom.wait_for_selector",
  "web.dom.wait_for_text",
  "web.dom.extract",
  "web.dom.capture_snapshot"
];

export const LEGACY_BROWSER_ACTION_TO_WEB_AUTOMATION = {
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
} as const;

export const WEB_AUTOMATION_ACTION_TO_LEGACY_BROWSER = Object.fromEntries(
  Object.entries(LEGACY_BROWSER_ACTION_TO_WEB_AUTOMATION).map(([legacy, canonical]) => [canonical, legacy])
) as Record<WebAutomationActionType, keyof typeof LEGACY_BROWSER_ACTION_TO_WEB_AUTOMATION>;
