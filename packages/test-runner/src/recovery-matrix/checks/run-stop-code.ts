// The run's own stop code, as Core's run detail carries it: the closed code
// for why the run stopped, which can differ from the failed attempt's own
// failure. A run stopped because a lasting act's outcome is unknown carries
// `run.outcome_uncertain` here, while its attempt keeps the timeout it met
// (`runtime/service/summaries/run-stop.ts` in Core). The detail's metadata is
// read first, then the summary's; anything not shaped as a closed code is null.

const CODE = /^[a-z][a-z0-9_]*(?:\.[a-z0-9_]+)+$/u;

/** The run detail's `stopCode`, or null when Core recorded none. */
export function matrixRunStopCode(runDetail: unknown): string | null {
  const detail = record(runDetail);
  const code = record(detail?.metadata)?.stopCode ?? record(record(detail?.summary)?.metadata)?.stopCode;
  return typeof code === "string" && code.length <= 120 && CODE.test(code) ? code : null;
}

function record(value: unknown): Readonly<Record<string, unknown>> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}
