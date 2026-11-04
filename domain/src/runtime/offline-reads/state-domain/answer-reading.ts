// A recorded web answer as the state rule reads it: how it came out, where it says the
// page is, its rows, and whether it gave up waiting. A call succeeded only when the
// client said so and no post-condition failed; a read with no answer failed.
//
// **A position is the whole address the page reported**, query and fragment included,
// because a search page and its next results differ only there. Only a trailing empty
// fragment is removed, since it names nothing.
//
// A row's identity is its canonical value: object keys sorted at every depth. A cell
// that changes on its own (a relative date, a live price) then reads as another row,
// which costs a false gap and never a false match. A read whose conditions kept nothing
// answers the rows they rejected (`unfiltered`, `content/extraction/filtered-answer.ts`):
// those are not its rows, so the reading holds none.

import type { ClientGatewayTraceRecordedPayload, ClientGatewayTraceStateAnswerReading } from "fluxiq/client-gateway";
import { WEB_AUTOMATION_FAILURE_CODES } from "../../failure";

const TIMED_OUT_STATUS = "timed_out";

export function webTraceStateReadAnswer(answer: ClientGatewayTraceRecordedPayload | null): ClientGatewayTraceStateAnswerReading {
  if (answer === null) return { outcome: "failed", position: null, rows: null, timedOut: false };
  const payload = recordOf(answer.payload);
  const validation = recordOf(payload?.validation);
  const failure = recordOf(answer.failure) ?? recordOf(payload?.failure);
  const succeeded = answer.status === "succeeded" && validation?.status !== "failed";
  return {
    outcome: succeeded ? "succeeded" : "failed",
    position: positionOf(payload),
    rows: rowsOf(payload),
    timedOut: answer.status === TIMED_OUT_STATUS || failure?.code === WEB_AUTOMATION_FAILURE_CODES.TIMEOUT
  };
}

function positionOf(payload: Record<string, unknown> | undefined): string | null {
  const url = stringOf(payload?.url) ?? stringOf(recordOf(payload?.snapshot)?.url);
  return url === null ? null : url.replace(/#$/u, "");
}

function rowsOf(payload: Record<string, unknown> | undefined): readonly string[] | null {
  const extracted = payload?.extracted;
  if (extracted === undefined || extracted === null) return null;
  if (recordOf(recordOf(payload?.extraction)?.conditions)?.unfiltered === true) return [];
  return (Array.isArray(extracted) ? extracted : [extracted]).map((row: unknown) => JSON.stringify(canonical(row)));
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  const record = recordOf(value);
  if (record === undefined) return value;
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(record).sort()) sorted[key] = canonical(record[key]);
  return sorted;
}

function stringOf(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

function recordOf(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}
