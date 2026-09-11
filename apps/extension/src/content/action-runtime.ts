// The page-side half of action execution. `actions.ts` decides what each action
// type does; this module supplies the capabilities it needs -- finding the
// target, waiting, reading values, and shaping the result the background worker
// receives. Target resolution tries selector, then coordinates, then the visual
// bounds the model saw, then an element fingerprint, and reports which of them
// missed so a failure says why.

import { executeContentAction } from "./actions";
import { findClosestFingerprint } from "./element-finder";
import { captureSettings } from "./capture-settings";
import { captureSnapshot } from "./dom-snapshot";
import { describeElement } from "./describe-element";
import { isTopFrame, requestFrameGeometry } from "./frame-geometry";
import type {
  BrowserActionCommand,
  BrowserActionResult,
  DomElementDescriptor,
  DomSnapshot,
  JsonObject,
  JsonValue,
  RectDescriptor
} from "./types";

/** A child frame needs its offset before its bounds mean anything to the caller. */
export async function captureSnapshotForResponse(): Promise<DomSnapshot> {
  if (!isTopFrame()) await requestFrameGeometry();
  return captureSnapshot();
}

export async function executeAction(action: BrowserActionCommand): Promise<BrowserActionResult> {
  return executeContentAction(action, {
    captureSnapshot,
    resolveTarget,
    describeElement,
    waitForElement,
    waitForText,
    extractElement,
    scrollElementIntoView,
    setElementValue,
    dispatchInputEvents,
    success,
    failure: actionFailure
  });
}

export function actionFailure(action: BrowserActionCommand, error: unknown, startedAt = Date.now()): BrowserActionResult {
  const snapshot = captureSettings.snapshots ? captureSnapshot() : undefined;
  return {
    commandId: action.commandId,
    actionType: action.actionType,
    status: "failed",
    message: error instanceof Error ? error.message : "Action failed.",
    url: location.href,
    title: document.title,
    ...(snapshot ? { snapshot } : {}),
    startedAt,
    finishedAt: Date.now()
  };
}

function resolveTarget(action: BrowserActionCommand): Element {
  const misses: string[] = [];
  if (action.selector) {
    const element = document.querySelector(action.selector);
    if (element) return element;
    misses.push(`selector ${action.selector}`);
  }
  if (action.coordinates) {
    const element = document.elementFromPoint(action.coordinates.x, action.coordinates.y);
    if (element) return element;
    misses.push(`coordinates ${action.coordinates.x},${action.coordinates.y}`);
  }
  const visualPoint = pointFromVisualTarget(action.visualTarget);
  if (visualPoint) {
    const element = document.elementFromPoint(visualPoint.x, visualPoint.y);
    if (element) return element;
    misses.push(`visual target ${Math.round(visualPoint.x)},${Math.round(visualPoint.y)}`);
  }
  const fingerprint = action.options?.element;
  if (fingerprint && typeof fingerprint === "object" && !Array.isArray(fingerprint)) {
    const element = findClosestFingerprint(fingerprint as Parameters<typeof findClosestFingerprint>[0]);
    if (element) return element;
    misses.push("element fingerprint");
  }
  if (!misses.length) {
    const active = document.activeElement;
    if (active) return active;
  }
  if (misses.length) throw new Error(`No target resolved from ${misses.join(", ")}.`);
  throw new Error("No selector, coordinates, or active element was available.");
}

function pointFromVisualTarget(visualTarget: BrowserActionCommand["visualTarget"]): { x: number; y: number } | undefined {
  const bounds = visualTarget?.bounds ?? visualTarget?.anchor?.bounds;
  if (bounds) return centerPoint(bounds);
  if (visualTarget?.documentBounds) {
    const center = centerPoint(visualTarget.documentBounds);
    return { x: center.x - window.scrollX, y: center.y - window.scrollY };
  }
  return undefined;
}

function centerPoint(rect: RectDescriptor): { x: number; y: number } {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

function success(
  action: BrowserActionCommand,
  startedAt: number,
  message: string,
  element?: DomElementDescriptor,
  snapshot?: DomSnapshot,
  extracted?: JsonValue
): BrowserActionResult {
  const result: BrowserActionResult = {
    commandId: action.commandId,
    actionType: action.actionType,
    status: "succeeded",
    message,
    url: location.href,
    title: document.title,
    startedAt,
    finishedAt: Date.now()
  };
  if (element) result.element = element;
  if (action.visualTarget) result.visualTarget = action.visualTarget;
  if (snapshot ?? captureSettings.snapshots) result.snapshot = snapshot ?? captureSnapshot();
  if (extracted !== undefined) result.extracted = extracted;
  return result;
}

function scrollElementIntoView(element: Element): void {
  element.scrollIntoView({ block: "center", inline: "center", behavior: "instant" });
}

function setElementValue(element: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
  descriptor?.set?.call(element, value);
}

function dispatchInputEvents(element: Element): void {
  element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText" }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

function waitForElement(selector: string | undefined, timeoutMs = 10_000): Promise<Element> {
  if (!selector) return Promise.reject(new Error("Selector is required."));
  const existing = document.querySelector(selector);
  if (existing) return Promise.resolve(existing);
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      waitObserver.disconnect();
      reject(new Error(`Timed out waiting for selector: ${selector}`));
    }, timeoutMs);
    const waitObserver = new MutationObserver(() => {
      const element = document.querySelector(selector);
      if (!element) return;
      clearTimeout(timeout);
      waitObserver.disconnect();
      resolve(element);
    });
    waitObserver.observe(document.documentElement, { childList: true, subtree: true });
  });
}

function waitForText(text: string, timeoutMs = 10_000): Promise<void> {
  if (document.body.innerText.includes(text)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      waitObserver.disconnect();
      reject(new Error(`Timed out waiting for text: ${text}`));
    }, timeoutMs);
    const waitObserver = new MutationObserver(() => {
      if (!document.body.innerText.includes(text)) return;
      clearTimeout(timeout);
      waitObserver.disconnect();
      resolve();
    });
    waitObserver.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  });
}

function extractElement(element: Element, options?: JsonObject): JsonValue {
  const mode = options?.mode;
  if (mode === "html") return element.innerHTML;
  if (mode === "attribute" && typeof options?.attribute === "string") return element.getAttribute(options.attribute) ?? "";
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) return element.value;
  return element.textContent?.replace(/\s+/g, " ").trim() ?? "";
}
