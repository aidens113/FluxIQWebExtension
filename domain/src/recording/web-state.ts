import type { JsonObject } from "fluxiq/core";
import type { ActionTarget, EvidenceAnchor, StateBounds, StateSnapshot, StateValue, StateValueType, StateVisualFrame } from "fluxiq/automation-studio";
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
  viewport: { width: number; height: number; scrollX: number; scrollY: number; devicePixelRatio?: number | undefined };
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

export const MAX_STATE_ELEMENTS = 150;
export const MAX_VISUAL_FRAME_ELEMENTS = 100;
export const WEB_AUTOMATION_VIEWPORT_VISUALIZER_ID = "web-automation.viewport";
export const WEB_AUTOMATION_SCREEN_FRAME_ID = "screen";

export function createWebAutomationStateFromSnapshot(
  snapshot: WebAutomationDomSnapshotInput,
  input: { timestamp?: number; sourceId?: string; screenContentRef?: string; projectId?: string } = {}
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
  return withScreenVisualFrame(state, snapshot, elements, input);
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
  const prioritized = [...elements].sort((left, right) =>
    stateElementBucket(left) - stateElementBucket(right) ||
    stateElementScore(right) - stateElementScore(left)
  );
  for (const element of prioritized) {
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
    (element.bounds !== undefined && isVisible(element) && isLikelyInteractableElement(element) && hasMeaningfulElementIdentity(element)) ||
    stableAttribute(element, "data-testid") ||
    stableAttribute(element, "data-test") ||
    stableAttribute(element, "data-cy") ||
    stableAttribute(element, "aria-label") ||
    stableAttribute(element, "name") ||
    stableAttribute(element, "id") ||
    meaningfulText(element.text) ||
    meaningfulText(element.name) ||
    meaningfulText(element.value) ||
    meaningfulText(element.href)
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
  const anchor = boundsAnchor(element.bounds);
  const elementLabel = element.name ?? element.visibleText ?? element.text ?? element.value ?? element.href ?? element.selector;
  const elementPresentation = anchor ? { group: "Elements", anchor, visualKind: "bounds" as const } : { group: "Elements" };
  let next = putStateValue(state, `${basePath}.selector`, "string", element.selector, timestamp, sourceId, { elementKind: "selector", stableAcrossSessions: true, presentation: { ...elementPresentation, label: `${elementLabel} selector`, visualKind: "text" } });
  next = putStateValue(next, `${basePath}.tagName`, "string", element.tagName, timestamp, sourceId, { elementKind: "static_id", stableAcrossSessions: true, presentation: { ...elementPresentation, label: `${elementLabel} tag`, visualKind: "badge" } });
  next = putStateValue(next, `${basePath}.visible`, "boolean", isVisible(element), timestamp, sourceId, { elementKind: "visibility", volatility: "normal", presentation: { ...elementPresentation, label: `${elementLabel} visible`, visualKind: "badge" } });
  next = putStateValue(next, `${basePath}.enabled`, "boolean", isEnabled(element), timestamp, sourceId, { elementKind: "enabled", volatility: "normal", presentation: { ...elementPresentation, label: `${elementLabel} enabled`, visualKind: "badge" } });
  if (element.text) next = putStateValue(next, `${basePath}.text`, "string", element.text, timestamp, sourceId, { elementKind: "text", presentation: { ...elementPresentation, label: elementLabel, visualKind: "text" } });
  if (element.name) next = putStateValue(next, `${basePath}.label`, "string", element.name, timestamp, sourceId, { elementKind: "label", presentation: { ...elementPresentation, label: element.name, visualKind: "text" } });
  if (element.value) next = putStateValue(next, `${basePath}.value`, "string", element.value, timestamp, sourceId, { elementKind: "text", sensitive: true, presentation: { ...elementPresentation, label: `${elementLabel} value`, visualKind: "text", sensitive: true } });
  if (element.href) next = putStateValue(next, `${basePath}.href`, "string", element.href, timestamp, sourceId, { elementKind: "url", presentation: { ...elementPresentation, label: `${elementLabel} link`, visualKind: "text" } });
  if (element.bounds) next = putStateValue(next, `${basePath}.bounds`, "rectangle", element.bounds, timestamp, sourceId, { elementKind: "bounds", comparable: false, presentation: { ...elementPresentation, label: elementLabel, visualKind: "bounds" } });
  const stableId = stableAttribute(element, "data-testid") ?? stableAttribute(element, "id") ?? stableAttribute(element, "name");
  if (stableId) next = putStateValue(next, `${basePath}.stableId`, "string", stableId, timestamp, sourceId, { elementKind: "static_id", stableAcrossSessions: true, presentation: { ...elementPresentation, label: `${elementLabel} stable ID`, visualKind: "badge" } });
  return next;
}

function withScreenVisualFrame(
  state: StateSnapshot,
  snapshot: WebAutomationDomSnapshotInput,
  elements: WebAutomationElementStateInput[],
  input: { screenContentRef?: string; projectId?: string } = {}
): StateSnapshot {
  const width = positiveFinite(snapshot.viewport.width) ?? 1;
  const height = positiveFinite(snapshot.viewport.height) ?? 1;
  const layers: StateVisualFrame["layers"] = [];

  if (input.screenContentRef) {
    layers.push({
      id: "screenshot",
      kind: "image",
      contentRef: input.screenContentRef,
      bounds: { x: 0, y: 0, width, height },
      metadata: compactJsonObject({ projectId: input.projectId, url: snapshot.url })
    });
  }

  for (const [index, element] of elements.slice(0, MAX_VISUAL_FRAME_ELEMENTS).entries()) {
    const bounds = stateBounds(element.bounds);
    if (!bounds) continue;
    const statePath = `${WEB_AUTOMATION_STATE_NAMESPACE}.elements.${elementStateId(element)}.bounds`;
    layers.push({
      id: `element.${safeLayerId(elementStateId(element), index + 1)}`,
      kind: "region",
      label: element.name ?? element.visibleText ?? element.text ?? element.value ?? element.href ?? element.tagName,
      bounds,
      statePath,
      anchor: { type: "bounds", bounds },
      metadata: { selector: element.selector, tagName: element.tagName }
    });
  }

  const frame: StateVisualFrame = {
    id: WEB_AUTOMATION_SCREEN_FRAME_ID,
    rendererId: WEB_AUTOMATION_VIEWPORT_VISUALIZER_ID,
    label: "Screen",
    coordinateSpace: { width, height, unit: "px", origin: "top-left" },
    layers,
    presentation: { label: snapshot.title || "Browser viewport", visualKind: "bounds", icon: "globe" },
    metadata: compactJsonObject({
      url: snapshot.url,
      title: snapshot.title,
      scrollX: snapshot.viewport.scrollX,
      scrollY: snapshot.viewport.scrollY,
      devicePixelRatio: snapshot.viewport.devicePixelRatio
    })
  };

  return {
    ...state,
    id: state.id ?? `web.snapshot.${state.timestamp}`,
    presentation: {
      ...(state.presentation ?? {}),
      defaultFrameId: WEB_AUTOMATION_SCREEN_FRAME_ID,
      visualFrames: [frame]
    }
  };
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
    presentation: input.presentation,
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
  const stable = stableAttribute(element, "data-testid") ?? stableAttribute(element, "id");
  if (stable) return sanitizeStateId(stable);
  const name = stableAttribute(element, "name");
  if (name) return sanitizeStateId(`${name}.${element.selector}`);
  return sanitizeStateId(element.selector);
}

function sanitizeStateId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "").slice(0, 120) || "element";
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

function stateElementBucket(element: WebAutomationElementStateInput): number {
  if (isPrimaryControlElement(element) && hasMeaningfulElementIdentity(element)) return 0;
  if (isLikelyInteractableElement(element) && hasMeaningfulElementIdentity(element)) return 1;
  if (meaningfulText(element.text) || meaningfulText(element.visibleText) || meaningfulText(element.name) || meaningfulText(element.value)) return 2;
  if (isVisible(element) && hasStableElementIdentity(element)) return 3;
  return 4;
}

function stateElementScore(element: WebAutomationElementStateInput): number {
  let score = 0;
  if (isLikelyInteractableElement(element)) score += 200;
  if (isLikelyActionableElement(element)) score += 100;
  if (hasStableElementIdentity(element)) score += 60;
  if (meaningfulText(element.name)) score += 45;
  if (meaningfulText(element.value)) score += 35;
  if (meaningfulText(element.text) || meaningfulText(element.visibleText)) score += 25;
  if (element.bounds) score += Math.min(20, Math.sqrt(element.bounds.width * element.bounds.height) / 8);
  return score;
}

function hasMeaningfulElementIdentity(element: WebAutomationElementStateInput): boolean {
  return hasStableElementIdentity(element) ||
    meaningfulText(element.text) ||
    meaningfulText(element.visibleText) ||
    meaningfulText(element.name) ||
    meaningfulText(element.value) ||
    meaningfulText(element.href);
}

function hasStableElementIdentity(element: WebAutomationElementStateInput): boolean {
  return Boolean(
    stableAttribute(element, "data-testid") ||
    stableAttribute(element, "data-test") ||
    stableAttribute(element, "data-cy") ||
    stableAttribute(element, "aria-label") ||
    stableAttribute(element, "name") ||
    stableAttribute(element, "id")
  );
}

function isLikelyInteractableElement(element: WebAutomationElementStateInput): boolean {
  return isLikelyActionableElement(element) ||
    element.attributes?.tabindex !== undefined ||
    element.attributes?.["aria-expanded"] !== undefined ||
    element.attributes?.["aria-controls"] !== undefined ||
    element.attributes?.["aria-pressed"] !== undefined ||
    element.attributes?.["aria-selected"] !== undefined;
}

function isPrimaryControlElement(element: WebAutomationElementStateInput): boolean {
  const tagName = element.tagName.toLowerCase();
  const role = element.role?.toLowerCase();
  return tagName === "button" ||
    tagName === "a" ||
    tagName === "summary" ||
    role === "button" ||
    role === "link" ||
    role === "menuitem" ||
    role === "tab";
}

function isLikelyActionableElement(element: WebAutomationElementStateInput): boolean {
  const tagName = element.tagName.toLowerCase();
  const role = element.role?.toLowerCase();
  const inputType = element.inputType?.toLowerCase();
  return tagName === "button" ||
    tagName === "a" ||
    tagName === "select" ||
    tagName === "textarea" ||
    tagName === "summary" ||
    tagName === "label" ||
    tagName === "input" && inputType !== "hidden" ||
    role === "button" ||
    role === "link" ||
    role === "menuitem" ||
    role === "checkbox" ||
    role === "radio" ||
    role === "tab" ||
    role === "switch" ||
    element.attributes?.onclick !== undefined;
}

function boundsAnchor(bounds: WebAutomationRect | undefined): EvidenceAnchor | undefined {
  const normalized = stateBounds(bounds);
  return normalized ? { type: "bounds", bounds: normalized } : undefined;
}

function stateBounds(bounds: WebAutomationRect | undefined): StateBounds | undefined {
  if (!bounds) return undefined;
  const x = finite(bounds.x);
  const y = finite(bounds.y);
  const width = positiveFinite(bounds.width);
  const height = positiveFinite(bounds.height);
  return x !== undefined && y !== undefined && width !== undefined && height !== undefined
    ? { x, y, width, height }
    : undefined;
}

function finite(value: number): number | undefined {
  return Number.isFinite(value) ? value : undefined;
}

function positiveFinite(value: number): number | undefined {
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

function safeLayerId(value: string, fallbackIndex: number): string {
  return value.replace(/[^a-z0-9.]+/gi, ".").replace(/^\.+|\.+$/g, "").slice(0, 80) || String(fallbackIndex);
}

function compactJsonObject(value: Record<string, unknown>): JsonObject {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as JsonObject;
}
