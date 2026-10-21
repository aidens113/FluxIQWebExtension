// Whether the control -- the recorded command replayed over the snapshot
// (D37) -- reproduced what the recorded read returned live. When it did, the
// snapshot holds the page that read saw, at least as far as that read looked,
// which is what lets a changed read over the same snapshot stand in for it.
//
// Both sides are compared as gateway results, the control built by the same
// builder the live background used, and only on what the page decided:
// - the status, and the failure code (both absent counts as equal);
// - the value or records taken off the page (`payload.extracted`), by value;
// - the extraction summary's counts (records, pages, items seen, empty
//   records, earlier-page repeats), each read with the wire's own copier.
// Never timings, addresses or ids: the sandbox has its own clock, its own
// command id and no tab, and none of them says anything about the page.

import type { ClientGatewayActionResult, ClientGatewayTraceRecordedPayload } from "fluxiq/client-gateway";
import { webAutomationExtractionSummaryValue, type WebAutomationExtractionSummary } from "../../actions/extraction";

type SummaryCount = "recordCount" | "pagesRead" | "itemsSeen" | "emptyRecords" | "earlierPageRepeats";

const SUMMARY_COUNTS: readonly SummaryCount[] = ["recordCount", "pagesRead", "itemsSeen", "emptyRecords", "earlierPageRepeats"];

export function webOfflineReadControlReproduced(control: ClientGatewayActionResult, recordedResult: ClientGatewayTraceRecordedPayload): boolean {
  if (control.status !== recordedResult.status) return false;
  if (control.failure?.code !== fieldOf(recordedResult.failure, "code")) return false;
  const controlPayload = control.payload ?? {};
  const recordedPayload = isRecord(recordedResult.payload) ? recordedResult.payload : {};
  if (!sameValue(controlPayload.extracted, recordedPayload.extracted)) return false;
  const controlSummary = webAutomationExtractionSummaryValue(controlPayload.extraction);
  const recordedSummary = webAutomationExtractionSummaryValue(recordedPayload.extraction);
  if ((controlSummary === undefined) !== (recordedSummary === undefined)) return false;
  return SUMMARY_COUNTS.every((count) => countOf(controlSummary, count) === countOf(recordedSummary, count));
}

function countOf(summary: WebAutomationExtractionSummary | undefined, count: SummaryCount): number | undefined {
  return summary?.[count];
}

function fieldOf(value: unknown, key: string): unknown {
  return isRecord(value) ? value[key] : undefined;
}

/** Equal JSON values: arrays in order, objects by key whatever their order. */
function sameValue(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right) && left.length === right.length && left.every((entry, index) => sameValue(entry, right[index]));
  }
  if (!isRecord(left) || !isRecord(right)) return false;
  const keys = Object.keys(left).filter((key) => left[key] !== undefined);
  return keys.length === Object.keys(right).filter((key) => right[key] !== undefined).length && keys.every((key) => sameValue(left[key], right[key]));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
