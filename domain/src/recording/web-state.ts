import type { JsonObject } from "fluxiq/core";
import type { ActionTarget, StateSnapshot, StateValue, StateValueType } from "fluxiq/automation-studio";
import { WEB_AUTOMATION_DOMAIN_ID, WEB_AUTOMATION_SCHEMA_VERSION } from "../constants";
import { createWebAutomationInitialState, WEB_AUTOMATION_STATE_NAMESPACE } from "./state";

export type WebAutomationRect = { x: number; y: number; width: number; height: number };

export type WebAutomationElementStateInput = {
  tagName: string;
  selector: string;
  xpath?: string | undefined;
  id?: string | undefined;
  classNames?: string[] | undefined;
  visibleText?: string | undefined;
  text?: string | undefined;
  value?: string | undefined;
  role?: string | undefined;
  name?: string | undefined;
  href?: string | undefined;
  inputType?: string | undefined;
  bounds?: WebAutomationRect | undefined;
  attributes?: Record<string, string> | undefined;
};

export type WebAutomationDomSnapshotInput = {
  url: string;
  title: string;
  viewport: { width: number; height: number; scrollX: number; scrollY: number };
  focusedElement?: WebAutomationElementStateInput | undefined;
  selectedText?: string | undefined;
  interactiveElements: WebAutomationElementStateInput[];
};

export type WebAutomationTabStateInput = {
  tabId: number;
  windowId?: number | undefined;
  url?: string | undefined;
  title?: string | undefined;
  active?: boolean | undefined;
  status?: string | undefined;
};

export const MAX_STATE_ELEMENTS = 40;

export function createWebAutomationStateFromSnapshot(
  snapshot: WebAutomationDomSnapshotInput,
  input: { timestamp?: number; sourceId?: string } = {}
): StateSnapshot {
  const timestamp = input.timestamp ?? Date.now();
  let state = createWebAutomationInitialState(timestamp);
  state = putStateValue(state, "page.url", "string", snapshot.url, timestamp, input.sourceId, { elementKind: "url" });
  state = putStateValue(state, "page.title", "string", snapshot.title, timestamp, input.sourceId, { elementKind: "text" });
  state = putStateValue(state, "viewport.bounds", "rectangle", { x: 0, y: 0, width: snapshot.viewport.width, height: snapshot.viewport.height }, timestamp, input.sourceId, { elementKind: "bounds", volatility: "normal" });
  state = putStateValue(state, "scroll.position", "point", { x: snapshot.viewport.scrollX, y: snapshot.viewport.scrollY }, timestamp, input.sourceId, { elementKind: "position", volatility: "rapid" });
  if (snapshot.selectedText) state = putStateValue(state, "page.selectedText", "string", snapshot.selectedText, timestamp, input.sourceId, { elementKind: "text" });
  if (snapshot.focusedElement) {
    const target = webAutomationActionTargetFromElement(snapshot.focusedElement);
    state = putStateValue(state, "focus.target", "json", target, timestamp, input.sourceId, { elementKind: "json", volatility: "rapid" });
  }
  const elements = filterStateElements(snapshot.interactiveElements);
  state = putStateValue(state, "elements.count", "integer", elements.length, timestamp, input.sourceId, { elementKind: "count" });
  for (const element of elements) state = addElementStateValues(state, element, timestamp, input.sourceId);
  return state;
}

export function createWebAutomationStateFromTabs(
  active: WebAutomationTabStateInput | undefined,
  tabs: WebAutomationTabStateInput[],
  input: { timestamp?: number; sourceId?: string; recording?: boolean; permissions?: string[] } = {}
): StateSnapshot {
  const timestamp = input.timestamp ?? Date.now();
  let state = createWebAutomationInitialState(timestamp);
  if (active?.url) state = putStateValue(state, "page.url", "string", active.url, timestamp, input.sourceId, { elementKind: "url" });
  if (active?.title) state = putStateValue(state, "page.title", "string", active.title, timestamp, input.sourceId, { elementKind: "text" });
  if (active?.tabId !== undefined) state = putStateValue(state, "browser.activeTabId", "integer", active.tabId, timestamp, input.sourceId, { elementKind: "internal_id" });
  state = putStateValue(state, "browser.tabCount", "integer", tabs.length, timestamp, input.sourceId, { elementKind: "count" });
  state = putStateValue(state, "recording.active", "boolean", input.recording === true, timestamp, input.sourceId, { elementKind: "status" });
  if (input.permissions?.length) state = putStateValue(state, "browser.permissions", "json", input.permissions, timestamp, input.sourceId, { elementKind: "collection", comparable: false });
  return state;
}

export function filterStateElements(elements: WebAutomationElementStateInput[], limit = MAX_STATE_ELEMENTS): WebAutomationElementStateInput[] {
  const seen = new Set<string>();
  const filtered: WebAutomationElementStateInput[] = [];
  for (const element of elements) {
    if (!shouldCaptureElementState(element)) continue;
    const id = elementStateId(element);
    if (seen.has(id)) continue;
    seen.add(id);
    filtered.push(element);
    if (filtered.length >= limit) break;
  }
  return filtered;
}

export function shouldCaptureElementState(element: WebAutomationElementStateInput): boolean {
  return Boolean(
    meaningfulText(element.text) ||
    meaningfulText(element.name) ||
    meaningfulText(element.value) ||
    meaningfulText(element.href) ||
    stableAttribute(element, "data-testid") ||
    stableAttribute(element, "aria-label") ||
    stableAttribute(element, "name") ||
    stableAttribute(element, "id")
  );
}

export function webAutomationActionTargetFromElement(element: WebAutomationElementStateInput): ActionTarget {
  return compactJsonObject({
    type: element.role ?? element.inputType ?? element.tagName,
    id: stableAttribute(element, "data-testid") ?? stableAttribute(element, "id") ?? stableAttribute(element, "name"),
    label: element.name ?? element.visibleText ?? element.text ?? element.value,
    selector: element.selector,
    bounds: element.bounds,
    metadata: compactJsonObject({
      tagName: element.tagName,
      xpath: element.xpath,
      id: element.id,
      classNames: element.classNames,
      visibleText: element.visibleText,
      role: element.role,
      href: element.href,
      inputType: element.inputType,
      attributes: element.attributes as JsonObject | undefined
    })
  }) as ActionTarget;
}

function addElementStateValues(state: StateSnapshot, element: WebAutomationElementStateInput, timestamp: number, sourceId?: string): StateSnapshot {
  const basePath = `elements.${elementStateId(element)}`;
  let next = putStateValue(state, `${basePath}.selector`, "string", element.selector, timestamp, sourceId, { elementKind: "selector", stableAcrossSessions: true });
  next = putStateValue(next, `${basePath}.tagName`, "string", element.tagName, timestamp, sourceId, { elementKind: "static_id", stableAcrossSessions: true });
  next = putStateValue(next, `${basePath}.visible`, "boolean", isVisible(element), timestamp, sourceId, { elementKind: "visibility", volatility: "normal" });
  next = putStateValue(next, `${basePath}.enabled`, "boolean", isEnabled(element), timestamp, sourceId, { elementKind: "enabled", volatility: "normal" });
  if (element.text) next = putStateValue(next, `${basePath}.text`, "string", element.text, timestamp, sourceId, { elementKind: "text" });
  if (element.name) next = putStateValue(next, `${basePath}.label`, "string", element.name, timestamp, sourceId, { elementKind: "label" });
  if (element.value) next = putStateValue(next, `${basePath}.value`, "string", element.value, timestamp, sourceId, { elementKind: "text", sensitive: true });
  if (element.href) next = putStateValue(next, `${basePath}.href`, "string", element.href, timestamp, sourceId, { elementKind: "url" });
  if (element.bounds) next = putStateValue(next, `${basePath}.bounds`, "rectangle", element.bounds, timestamp, sourceId, { elementKind: "bounds", comparable: false });
  const stableId = stableAttribute(element, "data-testid") ?? stableAttribute(element, "id") ?? stableAttribute(element, "name");
  if (stableId) next = putStateValue(next, `${basePath}.stableId`, "string", stableId, timestamp, sourceId, { elementKind: "static_id", stableAcrossSessions: true });
  return next;
}

function putStateValue(
  snapshot: StateSnapshot,
  path: string,
  type: StateValueType,
  value: unknown,
  observedAt: number,
  sourceId: string | undefined,
  input: Partial<StateValue> & { elementKind?: string; stableAcrossSessions?: boolean } = {}
): StateSnapshot {
  const namespace = snapshot.namespaces[WEB_AUTOMATION_STATE_NAMESPACE] ?? {
    schemaId: WEB_AUTOMATION_DOMAIN_ID,
    schemaVersion: WEB_AUTOMATION_SCHEMA_VERSION,
    values: {},
    metadata: { domainId: WEB_AUTOMATION_DOMAIN_ID }
  };
  const stateValue: StateValue = compactJsonObject({
    type,
    value,
    observedAt,
    sourceId,
    confidence: input.confidence ?? 0.95,
    volatility: input.volatility ?? "normal",
    comparable: input.comparable ?? true,
    sensitive: input.sensitive,
    metadata: compactJsonObject({
      elementKind: input.elementKind,
      stableAcrossSessions: input.stableAcrossSessions
    })
  }) as StateValue;
  return {
    ...snapshot,
    timestamp: observedAt,
    namespaces: {
      ...snapshot.namespaces,
      [WEB_AUTOMATION_STATE_NAMESPACE]: {
        ...namespace,
        values: {
          ...namespace.values,
          [path]: stateValue
        }
      }
    }
  };
}

function elementStateId(element: WebAutomationElementStateInput): string {
  const stable = stableAttribute(element, "data-testid") ?? stableAttribute(element, "id") ?? stableAttribute(element, "name") ?? element.selector;
  return stable.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "").slice(0, 80) || "element";
}

function meaningfulText(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length >= 2;
}

function stableAttribute(element: WebAutomationElementStateInput, name: string): string | undefined {
  const value = element.attributes?.[name];
  return meaningfulText(value) ? value : undefined;
}

function isVisible(element: WebAutomationElementStateInput): boolean {
  return !element.bounds || (element.bounds.width > 0 && element.bounds.height > 0);
}

function isEnabled(element: WebAutomationElementStateInput): boolean {
  return element.attributes?.disabled === undefined && element.attributes?.["aria-disabled"] !== "true";
}

function compactJsonObject(value: Record<string, unknown>): JsonObject {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as JsonObject;
}
