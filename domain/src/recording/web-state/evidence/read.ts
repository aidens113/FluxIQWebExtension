// Reading a value off the page evidence, which arrives over a wire from a
// browser and may be anything.
//
// The rest of the projection trusts its declared input types, because those
// inputs are produced by code in this repository. This one is not: the evidence
// is assembled by a content script that may be older than the domain reading
// it, in a page that may have interfered with it, and a projection that threw
// on a malformed field would take the whole recording down with it. So every
// value is read through one of these and an unreadable field is simply absent,
// which is the answer the state paths are already shaped to give.

import type { JsonObject } from "fluxiq/core";

/** Matches `boundedText`'s bound in the producer, so a healthy string arrives whole. */
const MAX_TEXT = 200;

export function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

export function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/** The producer's `boundedText` rule, restated: collapse, trim, slice, drop if empty. */
export function text(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const collapsed = value.replace(/\s+/gu, " ").trim();
  return collapsed ? collapsed.slice(0, MAX_TEXT) : undefined;
}

/** A tally. Negative and fractional readings are impossible for a count, so they are corrected rather than carried. */
export function count(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : undefined;
}

export function flag(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

/** A rect is all four numbers or it is nothing: half a rect cannot be drawn or compared. */
export function rect(value: unknown): JsonObject | undefined {
  const bounds = record(value);
  if (!bounds) return undefined;
  const x = finite(bounds.x);
  const y = finite(bounds.y);
  const width = finite(bounds.width);
  const height = finite(bounds.height);
  return x === undefined || y === undefined || width === undefined || height === undefined
    ? undefined
    : { x, y, width, height };
}

/** Narrows a mapped list to the entries that read as something. */
export function isPresent(value: string | undefined): value is string {
  return value !== undefined;
}

function finite(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
