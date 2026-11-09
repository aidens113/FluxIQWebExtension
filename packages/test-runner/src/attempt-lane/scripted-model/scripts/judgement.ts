import type { ScriptedModelRequest } from "../wire-request.js";

// A judge's reply as Core's judge schema asks for it since t875 (lane A; Core
// `runtime/llm/verification-checked/reply-required.ts`): the judge of an attempt
// with no Flow must write `checked` and `answerRecords`, and a yes over rows
// stands on them (`runtime/result-verification/cited-yes/records-yes.ts`): it
// cites the stored rows that answer and says how many records the site shows as
// the answer. A reply without them is off the schema, so Core asks again until a
// script runs out of replies (run-mw9tqkp0-228b64e4: "expects no request 4 of
// kind loop_verification"). Every scripted task asks for a table, so `asked` is
// always true here.

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/** What a script's judge says: its verdict and words, and how many records it read the site to show, where it read that. */
export type ScriptedJudgement = Readonly<{
  answersRequest: "yes" | "no" | "unknown";
  summary: string;
  /** How many records the site shows as the answer. Left out, the judge takes the rows held to be what the site shows, as a judge that believes what it is given does. */
  siteShows?: number;
  observed?: string;
  defects?: readonly Readonly<Record<string, unknown>>[];
}>;

/**
 * The diagnosis a judge writes, with the rows it cites and the count it gives.
 * A yes cites every stored row by its label, as Core labels it: the first of
 * its set's columns it holds text in (`cited-yes/stored-cells.ts`). Rows are
 * read from every record set Core put in the summary; a working set Core
 * sets aside would be cited wrongly, which none of these tasks' honest paths
 * store.
 */
export function scriptedJudgement(request: ScriptedModelRequest, said: ScriptedJudgement): Record<string, unknown> {
  const context = request.payload?.context;
  const summary = isRecord(context) && isRecord(context.resultSummary) ? context.resultSummary : undefined;
  const sets = summary && Array.isArray(summary.recordSets) ? summary.recordSets.filter(isRecord) : [];
  const held = sets.reduce((sum, set) => sum + (typeof set.recordCount === "number" && Number.isSafeInteger(set.recordCount) && set.recordCount > 0 ? set.recordCount : 0), 0);
  const checked = said.answersRequest === "yes" ? sets.flatMap(citedRows) : [];
  return {
    kind: "diagnosis",
    diagnosis: {
      answersRequest: said.answersRequest,
      ...(said.observed ? { observed: said.observed } : {}),
      defects: said.defects ?? [],
      checked,
      answerRecords: { asked: true, siteShows: said.siteShows ?? held },
    },
    summary: said.summary,
  };
}

/** Each sample row of a set, cited by its label cell. */
function citedRows(set: Record<string, unknown>): Array<{ row: string; column: string; value: string }> {
  const columns = Array.isArray(set.columns) ? set.columns.filter((column): column is string => typeof column === "string") : [];
  const rows = Array.isArray(set.sampleRows) ? set.sampleRows.filter(isRecord) : [];
  return rows.flatMap((row) => {
    const text = (column: string): string => {
      const value = row[column];
      return typeof value === "string" ? value.trim() : typeof value === "number" || typeof value === "boolean" ? String(value) : "";
    };
    const column = columns.find((id) => text(id)) ?? Object.keys(row).find((id) => text(id));
    return column === undefined ? [] : [{ row: text(column), column, value: text(column) }];
  });
}
