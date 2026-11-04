// A recorded answer against a live one, on what the harness measures: the page's
// address, the interactive selector set of a page view, and the rows. Reports counts and
// booleans; nothing compared is copied out.

import type { ClientGatewayTraceRecordedPayload, ClientGatewayTraceStateAnswerReading } from "fluxiq/client-gateway";

/** Interactive selector sets this close count as the same page. The control measures what two live runs reach. */
export const SELECTORS_CLOSE_AT = 0.5;
/** A second, harder line, since half the selectors alike can still be another page. */
export const SELECTORS_VERY_CLOSE_AT = 0.8;

export function snapshotSelectors(answer: ClientGatewayTraceRecordedPayload | null): ReadonlySet<string> | null {
  const payload = answer?.payload;
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) return null;
  const snapshot = (payload as { readonly snapshot?: unknown }).snapshot;
  if (typeof snapshot !== "object" || snapshot === null || Array.isArray(snapshot)) return null;
  const elements = (snapshot as { readonly interactiveElements?: unknown }).interactiveElements;
  if (!Array.isArray(elements)) return null;
  const selectors = new Set<string>();
  for (const element of elements) {
    const selector = typeof element === "object" && element !== null ? (element as { readonly selector?: unknown }).selector : undefined;
    if (typeof selector === "string") selectors.add(selector);
  }
  return selectors;
}

/** Overlap of two selector sets, from 0 to 1; both empty is 1. */
export function selectorOverlap(left: ReadonlySet<string>, right: ReadonlySet<string>): number {
  if (left.size === 0 && right.size === 0) return 1;
  let shared = 0;
  for (const selector of left) {
    if (right.has(selector)) shared += 1;
  }
  return shared / (left.size + right.size - shared);
}

export function sameRows(left: ClientGatewayTraceStateAnswerReading, right: ClientGatewayTraceStateAnswerReading): boolean | null {
  if (left.rows === null || right.rows === null) return null;
  const rights = new Set(right.rows);
  const lefts = new Set(left.rows);
  return lefts.size === rights.size && [...lefts].every((row) => rights.has(row));
}

/** A live answer's failure code: a plain code, safe to count. */
export function failureCode(answer: ClientGatewayTraceRecordedPayload | null): string {
  const failure = answer?.failure;
  const code = typeof failure === "object" && failure !== null ? (failure as { readonly code?: unknown }).code : undefined;
  return typeof code === "string" ? code : "none";
}
