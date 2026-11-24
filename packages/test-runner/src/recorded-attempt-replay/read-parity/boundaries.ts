import { isDeepStrictEqual } from "node:util";
import type { JsonObject } from "fluxiq/core";
import { webOfflineReadModelResult } from "@fluxiq-web-extension/domain/node";
import { compareRecordedReadRows } from "./compare.js";

/** Each layer compares to its own original; model projection never replaces raw equality. */
export function compareRecordedReadBoundaries(input: { actualPayload: JsonObject | undefined; originalPayload: unknown; canonicalRead: unknown; parameters: JsonObject; recordedUrl: string; currentDerivedSchema?: unknown }) {
  const original = record(input.originalPayload);
  const canonical = record(input.canonicalRead);
  const projected = record(webOfflineReadModelResult(input.actualPayload, input.parameters));
  const raw = compareRecordedReadRows({ actual: input.actualPayload?.extracted, expected: original?.extracted, ...(input.currentDerivedSchema === undefined ? {} : { currentDerivedSchema: input.currentDerivedSchema }) });
  const modelProjectedRowsMatch = Array.isArray(projected?.extracted) && projected.extracted.length > 0 && Array.isArray(canonical?.extracted) && isDeepStrictEqual(projected.extracted, canonical.extracted);
  // The read's writer states `origin` only when a kept row holds a link it writes as a path (`shown-rows/account.ts`),
  // so a link-free read states none on either side and equal absence matches. A canonical read that states none
  // beside a reproduction that does cannot say its context: unavailable, never a pass.
  const contextAvailable = typeof original?.url === "string" && original.url.length > 0 && !(originOf(canonical) === null && originOf(projected) !== null);
  const projectionContextMatches = contextAvailable ? input.actualPayload?.url === original!.url && original!.url === input.recordedUrl && originOf(projected) === originOf(canonical) : null;
  return { rawNativeRowsMatch: raw.rowsMatch, modelProjectedRowsMatch, projectionContextMatches, rawComparison: raw, boundariesPassed: raw.contractRowsMatch && modelProjectedRowsMatch && projectionContextMatches === true };
}

/** A stated origin, or `null` for none: an empty or non-text one is not an origin. */
function originOf(read: Record<string, unknown> | undefined): string | null {
  return typeof read?.origin === "string" && read.origin.length > 0 ? read.origin : null;
}

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}
