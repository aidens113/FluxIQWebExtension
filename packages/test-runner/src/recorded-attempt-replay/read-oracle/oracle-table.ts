import type { JsonObject } from "fluxiq/core";
import type { FlowRunDataset } from "../../flow-lane/index.js";
import { judgeTrialDatasets, loadOracleExpectation } from "../../offline-trial-experiment/oracle/index.js";
import { extractedValueMatches, type ExtractionRecord } from "../../run-expectations/extraction/index.js";

const DATASET = "recorded-oracle.answer";
const READ_NODE = "recorded-oracle.read";

/**
 * The answer judged by the task's own oracle, with the very judgement a created Flow's Lab run is judged by
 * (`judgeTrialDatasets`): record by record, in the oracle's order, each value exact. Beside it, in counts only: whether
 * the answer's columns run in the oracle's column order, and how many of the oracle's records any collected row holds
 * at all (all its columns matching), which separates a recording that never read a record from processing that lost it.
 */
export async function judgeRecordedOracleTable(input: { repositoryRoot: string; scenarioLabDist: string; scenarioId: string; taskId: string; scenarioOrigin: string; runId: string; columns: readonly string[]; rows: readonly JsonObject[]; collected: readonly JsonObject[] }) {
  const oracle = await loadOracleExpectation({ repositoryRoot: input.repositoryRoot, scenarioLabDist: input.scenarioLabDist, scenarioId: input.scenarioId, taskId: input.taskId, scenarioOrigin: input.scenarioOrigin });
  let nonStringValues = 0;
  const text = (value: unknown): string | null => {
    if (value === undefined || value === null) return null;
    if (typeof value === "string") return value;
    nonStringValues += 1;
    return JSON.stringify(value);
  };
  const records: ExtractionRecord[] = input.rows.map((row) => Object.fromEntries(input.columns.map((column) => [column, text(row[column])])));
  const dataset: FlowRunDataset = { datasetId: DATASET, nodeIds: [READ_NODE], recordCount: records.length, storeTruncated: false, invalidCount: 0, records, nonStringValues, pages: 1 };
  const verdict = judgeTrialDatasets({ scenarioOrigin: input.scenarioOrigin }, oracle, input.runId, [dataset], 1);
  const expected = oracle.entry.records ?? [];
  const oracleColumns = expected[0] === undefined ? [] : Object.keys(expected[0]);
  const context = { scenarioOrigin: input.scenarioOrigin };
  const holds = (row: JsonObject, wanted: Readonly<Record<string, string | null>>) => Object.entries(wanted).every(([key, value]) => {
    const cell = row[key];
    return extractedValueMatches(value, typeof cell === "string" ? cell : cell === undefined || cell === null ? null : JSON.stringify(cell), context);
  });
  const inCollected = expected.filter((wanted) => input.collected.some((row) => holds(row, wanted))).length;
  const inAnswer = expected.filter((wanted) => input.rows.some((row) => holds(row, wanted))).length;
  // Per oracle column, how many oracle records a collected row holding the record's first column also matches on it:
  // a column read in another form than the oracle writes shows here as a count, never as a value.
  const [first] = oracleColumns;
  const byColumn = Object.fromEntries(oracleColumns.map((column) => [column, first === undefined ? 0 : expected.filter((wanted) =>
    input.collected.some((row) => holds(row, { [first]: wanted[first] ?? null }) && holds(row, { [column]: wanted[column] ?? null }))).length]));
  return {
    verdict,
    oracleColumns,
    answerColumns: [...input.columns],
    columnOrderMatches: oracleColumns.length === input.columns.length && oracleColumns.every((column, index) => input.columns[index] === column),
    expectedRecords: expected.length,
    expectedInCollected: inCollected,
    expectedInAnswer: inAnswer,
    expectedByColumnInCollected: byColumn,
    answerRecords: records.length,
    nonStringValues,
  };
}
