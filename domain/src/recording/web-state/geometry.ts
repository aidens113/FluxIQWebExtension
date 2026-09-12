import type { EvidenceAnchor, StateBounds } from "fluxiq/automation-studio";
import type { WebAutomationRect } from "./types";

// Browser rects reach us from a live page, so a rect can carry NaN, Infinity or
// a zero dimension for an element that is present but not laid out. Every
// conversion in this module returns `undefined` rather than a degenerate
// rectangle: a missing bound is a fact the state can carry, an impossible one
// is not, and Core's validator rejects the latter.

// A rect Core can store, or `undefined` when any component is unusable.
export function stateBounds(bounds: WebAutomationRect | undefined): StateBounds | undefined {
  if (!bounds) return undefined;
  const x = finite(bounds.x);
  const y = finite(bounds.y);
  const width = positiveFinite(bounds.width);
  const height = positiveFinite(bounds.height);
  return x !== undefined && y !== undefined && width !== undefined && height !== undefined
    ? { x, y, width, height }
    : undefined;
}

// The evidence anchor that points a state value at its region on screen.
export function boundsAnchor(bounds: WebAutomationRect | undefined): EvidenceAnchor | undefined {
  const normalized = stateBounds(bounds);
  return normalized ? { type: "bounds", bounds: normalized } : undefined;
}

// Viewport-relative bounds moved into the top document's viewport space. An
// element inside a child frame is measured against that frame's own viewport,
// so its rect must be offset by where the frame sits before it can be drawn on
// a screenshot of the whole tab.
export function screenFrameBounds(bounds: WebAutomationRect | undefined, frameViewportOffset: StateBounds | undefined): StateBounds | undefined {
  const normalized = stateBounds(bounds);
  if (!normalized) return undefined;
  if (!frameViewportOffset) return normalized;
  return stateBounds({
    x: frameViewportOffset.x + normalized.x,
    y: frameViewportOffset.y + normalized.y,
    width: normalized.width,
    height: normalized.height
  });
}

// Viewport bounds scaled into the screenshot's pixel space, for a capture taken
// at a device pixel ratio other than 1.
export function scaledScreenBounds(bounds: StateBounds | undefined, scaleX: number, scaleY: number): StateBounds | undefined {
  if (!bounds) return undefined;
  return stateBounds({
    x: bounds.x * scaleX,
    y: bounds.y * scaleY,
    width: bounds.width * scaleX,
    height: bounds.height * scaleY
  });
}

// A usable dimension: finite and greater than zero. Also the guard for the
// viewport and screenshot sizes a frame's coordinate space is built from.
export function positiveFinite(value: number | undefined): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;
}

function finite(value: number): number | undefined {
  return Number.isFinite(value) ? value : undefined;
}
