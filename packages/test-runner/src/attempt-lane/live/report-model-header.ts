import type { AttemptModelRecord } from "./model-record.js";

/** The first line of `attempt-report.txt`: `model claude-sonnet-5-5, provider anthropic`, or `model none, provider scripted`. */
export function attemptModelHeader(record: AttemptModelRecord): string {
  return `model ${record.model ?? "none"}, provider ${record.provider}`;
}
