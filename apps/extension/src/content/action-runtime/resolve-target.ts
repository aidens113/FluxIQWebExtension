// Finds the element an action acts on. Resolution tries selector, then
// coordinates, then the visual bounds the model saw, then an element
// fingerprint, and reports which of them missed so a failure says why.

import { findClosestFingerprint } from "../element-finder";
import type { BrowserActionCommand, RectDescriptor } from "../types";

export function resolveTarget(action: BrowserActionCommand): Element {
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
