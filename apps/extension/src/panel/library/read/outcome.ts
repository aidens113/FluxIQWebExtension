import type { SubflowRunOutcome } from "@fluxiq/ui-components";
import { readClasses } from "./classes";
import { count, list, record, text } from "./values";

const STATUSES: readonly string[] = ["succeeded", "failed", "stopped", "cancelled"];

/** A run that took place: how it ended, what it handed back, the rows it stored and where it stopped. */
export function readOutcome(value: unknown): SubflowRunOutcome | undefined {
  const run = record(value);
  const status = run?.status;
  if (run === undefined || typeof status !== "string" || !STATUSES.includes(status)) return undefined;
  const datasets = list(record(run.rows)?.datasets);
  const rowCount = datasets.reduce<number>((total, dataset) => total + (count(record(dataset)?.rowCount) ?? 0), 0);
  const stop = record(run.stoppedAt);
  const stepLabel = text(stop?.stepLabel);
  const reason = text(stop?.reason);
  return {
    refused: false,
    status: status as SubflowRunOutcome["status"],
    outputs: record(run.outputs) ?? {},
    rowCount,
    ...(stepLabel === undefined || reason === undefined ? {} : { stoppedAt: { stepLabel, reason } }),
    acts: readClasses(run.acts)
  };
}
