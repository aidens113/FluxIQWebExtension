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
  const contextAvailable = typeof original?.url === "string" && original.url.length > 0 && typeof canonical?.origin === "string" && canonical.origin.length > 0 && typeof projected?.origin === "string" && projected.origin.length > 0;
  const projectionContextMatches = contextAvailable ? input.actualPayload?.url === original!.url && original!.url === input.recordedUrl && projected!.origin === canonical!.origin : null;
  return { rawNativeRowsMatch: raw.rowsMatch, modelProjectedRowsMatch, projectionContextMatches, rawComparison: raw, boundariesPassed: raw.contractRowsMatch && modelProjectedRowsMatch && projectionContextMatches === true };
}

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}
