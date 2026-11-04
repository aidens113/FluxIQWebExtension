import type { AttemptReportRow, RunAnswerScore } from "@fluxiq-web-extension/test-contracts";

/**
 * The run's one result line, in plain words. A row with a stand-in on it says so here
 * as well as in its fields, so a scripted proof can never be read as a live result.
 */
export function attemptResultLine(input: { row: AttemptReportRow; answer: RunAnswerScore; status: string; waitingFor?: string | undefined }): string {
  const { row, answer } = input;
  const why = answer.wrongBecause.length > 0 ? ` because ${answer.wrongBecause.join(", ")}` : "";
  const rows = answer.storedRows === null ? "" : `, ${answer.storedRows} rows stored, ${answer.shownRows ?? 0} shown`;
  const ended = `${input.status}${input.waitingFor ? ` for ${input.waitingFor}` : ""}`;
  const counted = row.live ? "counted as live" : `NOT LIVE, stand-ins: ${row.standIns.join(", ")}`;
  return `${row.taskId} attempt ${row.attempt}: answer ${answer.verdict}${why}. Ended ${ended}${rows}, ${row.liveSteps} live steps, ${row.calls} calls, $${row.usd.toFixed(4)}, ${Math.round(row.ms / 1000)} s. ${counted}.`;
}
