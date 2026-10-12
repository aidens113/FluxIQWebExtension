// Defensive readers for Core's payloads. Nothing here trusts a type: every
// field is checked, and a field that is missing or the wrong shape is left
// undefined rather than defaulted, so the summary never says something Core
// did not.

import type { RunDataset, RunSummary } from "./types";

/** Checks and reduces the run summaries, datasets and fields Core sends. */
export const readCore = {
  record(value: unknown): Record<string, unknown> | undefined {
    return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
  },
  text(value: unknown): string | undefined {
    return typeof value === "string" && value.trim() !== "" ? value : undefined;
  },
  count(value: unknown): number | undefined {
    return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
  },
  /** A time as epoch milliseconds, from a number or an ISO string. */
  time(value: unknown): number | undefined {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value !== "string") return undefined;
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  },
  texts(value: unknown): string[] | undefined {
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : undefined;
  },
  run(value: unknown): RunSummary | undefined {
    const record = readCore.record(value);
    const runId = readCore.text(record?.runId);
    const flowId = readCore.text(record?.flowId);
    if (record === undefined || runId === undefined || flowId === undefined) return undefined;
    return {
      runId,
      flowId,
      status: typeof record.status === "string" ? record.status : "",
      startedAt: readCore.time(record.startedAt),
      finishedAt: readCore.time(record.finishedAt),
      updatedAt: readCore.time(record.updatedAt),
      interventionCount: readCore.count(record.interventionCount),
      adaptationCount: readCore.count(record.adaptationCount),
      durableBehaviorChanged: typeof record.durableBehaviorChanged === "boolean" ? record.durableBehaviorChanged : undefined
    };
  },
  dataset(value: unknown): RunDataset | undefined {
    const record = readCore.record(value);
    const datasetId = readCore.text(record?.datasetId);
    if (datasetId === undefined) return undefined;
    return { datasetId, label: readCore.text(record?.label), recordCount: readCore.count(record?.recordCount) };
  }
};
