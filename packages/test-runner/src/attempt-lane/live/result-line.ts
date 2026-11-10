import type { AttemptPath, AttemptReportRow, RunAnswerScore } from "@fluxiq-web-extension/test-contracts";
import type { AttemptAskedAgain } from "../driver.js";

const PATH_WORDS: Readonly<Record<AttemptPath, string>> = {
  explore: "It explored, with no run of a saved Flow",
  run_flow: "It took the run of the saved Flow, and needed nothing else",
  run_flow_then_repair: "It took the run of the saved Flow, then repaired the step that stopped it",
  run_flow_then_explore: "It took the run of the saved Flow, then explored on from where that stopped",
};

const quoted = (items: readonly string[]): string => items.join(", ");

/** What an attempt on what an earlier one left says of that. Absent on one that began from the seed. */
function againstWords(row: AttemptReportRow, startedFromFirst: boolean | undefined): string {
  const { against } = row;
  if (!against) return "";
  const found = against.foundDone.length > 0 ? `it found already done: ${quoted(against.foundDone)}` : "it found none of the asked acts already done";
  const change = against.changed.length > 0 ? `It changed the site: ${quoted(against.changed)}` : "It changed nothing on the site";
  const proof = startedFromFirst === undefined ? "" : startedFromFirst ? ` It started from attempt ${row.attempt - 1}'s saved work, proven by the digest.` : ` That it started from attempt ${row.attempt - 1}'s saved work is not proven.`;
  return ` It ran against what attempt ${row.attempt - 1} left, with no reseed; ${found}. ${change}. ${PATH_WORDS[row.path]}.${proof}`;
}

/**
 * The run's one result line, in plain words. A row with a stand-in on it says so here
 * as well as in its fields, so a scripted proof can never be read as a live result.
 */
/** What an attempt a person started with Run again says of each asked act: done again, left as it stood, undone, or not done. */
function askedAgainWords(askedAgain: AttemptAskedAgain | undefined): string {
  if (!askedAgain) return "";
  const parts = [
    askedAgain.pressedAgain.length > 0 ? `it did again: ${quoted(askedAgain.pressedAgain)}, so these are no repeated acts` : "",
    askedAgain.foundAsAsked.length > 0 ? `it found already as asked and pressed nothing: ${quoted(askedAgain.foundAsAsked)}` : "",
    askedAgain.undone.length > 0 ? `it undid what was asked: ${quoted(askedAgain.undone)}` : "",
    askedAgain.notPressed.length > 0 ? `it did not do: ${quoted(askedAgain.notPressed)}` : "",
  ].filter((part) => part.length > 0);
  return ` You asked to do it again (Run again): ${parts.length > 0 ? parts.join("; ") : "it did nothing"}.`;
}

export function attemptResultLine(input: { row: AttemptReportRow; answer: RunAnswerScore; status: string; waitingFor?: string | undefined; actsWithNoRow?: number | undefined; startedFromFirst?: boolean | undefined; askedAgain?: AttemptAskedAgain | undefined }): string {
  const { row, answer } = input;
  const cached = row.cacheHitPercent === undefined ? "" : `, ${row.cacheHitPercent}% of input from cache`;
  const why = answer.wrongBecause.length > 0 ? ` because ${answer.wrongBecause.join(", ")}` : "";
  const rows = answer.storedRows === null ? "" : `, ${answer.storedRows} rows stored, ${answer.shownRows ?? 0} shown`;
  const ended = `${input.status}${input.waitingFor ? ` for ${input.waitingFor}` : ""}`;
  const counted = row.live ? "counted as live" : `NOT LIVE, stand-ins: ${row.standIns.join(", ")}`;
  const noRow = (input.actsWithNoRow ?? 0) > 0 ? ` ${input.actsWithNoRow} lasting acts could not be tied to a row.` : "";
  return `${row.taskId} attempt ${row.attempt}: answer ${answer.verdict}${why}.${askedAgainWords(input.askedAgain)}${againstWords(row, input.startedFromFirst)} Ended ${ended}${rows}, ${row.liveSteps} live steps, ${row.calls} calls${cached}, $${row.usd.toFixed(4)}, ${Math.round(row.ms / 1000)} s. ${counted}.${noRow}`;
}
