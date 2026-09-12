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
import { pageEvidenceWire, type WebAutomationEvidenceRect } from "../../../page-evidence";

/**
 * Narrowing a wire object to the contract's keys. Re-exported under the name
 * this projection has always used, so the whole of `project.ts` reaches the
 * wire through one import.
 *
 * `record<T>(value)` keeps `T`'s key set and makes every value `unknown`, so a
 * field the producer renames stops compiling here rather than reading
 * `undefined` for ever, and a field the page corrupts still has to pass one of
 * the readers below. `T` is the shared contract's own type, which is the
 * producer's own declaration -- that is the whole join.
 */
export { pageEvidenceWire as record, type PageEvidenceWire } from "../../../page-evidence";

/** Matches `boundedText`'s bound in the producer, so a healthy string arrives whole. */
const MAX_TEXT = 200;

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
  const bounds = pageEvidenceWire<WebAutomationEvidenceRect>(value);
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
