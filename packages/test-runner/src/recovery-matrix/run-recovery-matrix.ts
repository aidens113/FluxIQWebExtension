// `lab recovery-matrix`: the chosen cases, one after another, each once.
//
// One attempt per launch: a case that fails is reported with its reasons and
// its run's records, and is not run again here; a rerun is a new launch after
// the failure has been read. Cases run one at a time because each starts its
// own Core twice and a visible browser, and two at once would compete for the
// same machine a live lane is using.
//
// The bundle is `<runs>/recovery-matrix/<matrix-run-id>/`: one
// `case-<id>.json` per case (its verdict, reasons, records read, measures, and
// the perturbation's report) and `summary.json` (every case's verdict and the
// matrix's status table). Counts, ids and closed words only.

import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { RecoveryMatrixCase, RecoveryMatrixRow } from "./matrix-row.js";
import { RECOVERY_MATRIX_ROWS } from "./matrix-rows.js";
import { runMatrixCase, type MatrixCaseOptions, type MatrixCaseResult } from "./run/index.js";

export type RecoveryMatrixSelection = Readonly<{ caseIds?: readonly string[]; rows?: readonly number[]; ready?: boolean }>;

/** Where a row stands before it is run: what it still waits for, if anything. */
export type RecoveryMatrixRowStatus = Readonly<{
  row: number;
  scenario: string;
  cases: readonly string[];
  /** `ready` needs nothing a current Core lacks; `pending` names the executor capabilities its proof needs; `blocked` cannot be hand-authored as written. */
  status: "ready" | "pending" | "blocked";
  needs: readonly string[];
  authoringGap: string | null;
  /** The command that runs the row. */
  command: string;
}>;

/** Every row's standing, in matrix order. */
export function recoveryMatrixStatus(rows: readonly RecoveryMatrixRow[] = RECOVERY_MATRIX_ROWS): RecoveryMatrixRowStatus[] {
  return rows.map(row => ({
    row: row.row,
    scenario: row.scenario,
    cases: row.cases.map(item => item.caseId),
    status: row.authoringGap ? "blocked" : row.needs.length ? "pending" : "ready",
    needs: [...row.needs],
    authoringGap: row.authoringGap ?? null,
    command: `pnpm lab recovery-matrix --row ${row.row}`,
  }));
}

/** The cases a selection names, in matrix order; refuses a case or row that does not exist, and an empty selection. */
export function selectRecoveryMatrixCases(selection: RecoveryMatrixSelection, rows: readonly RecoveryMatrixRow[] = RECOVERY_MATRIX_ROWS): { row: RecoveryMatrixRow; matrixCase: RecoveryMatrixCase }[] {
  const all = rows.flatMap(row => row.cases.map(matrixCase => ({ row, matrixCase })));
  for (const caseId of selection.caseIds ?? []) if (!all.some(item => item.matrixCase.caseId === caseId)) throw new Error(`recovery-matrix has no case ${caseId}; cases are ${all.map(item => item.matrixCase.caseId).join(", ")}`);
  for (const number of selection.rows ?? []) if (!rows.some(row => row.row === number)) throw new Error(`recovery-matrix has no row ${number}; rows are ${rows.map(row => row.row).join(", ")}`);
  const chosen = all.filter(({ row, matrixCase }) => (selection.caseIds ?? []).includes(matrixCase.caseId)
    || (selection.rows ?? []).includes(row.row)
    || (selection.ready === true && row.needs.length === 0 && row.authoringGap === undefined));
  if (!chosen.length) throw new Error("recovery-matrix selected no case: name --case <id>, --row <n> or --ready");
  return chosen;
}

export type RecoveryMatrixOutcome = Readonly<{
  matrixRunId: string;
  directory: string;
  results: readonly MatrixCaseResult[];
  status: readonly RecoveryMatrixRowStatus[];
}>;

/** Runs the selected cases and writes the bundle. A case that cannot start ends the matrix with that error, after writing what ran. */
export async function runRecoveryMatrix(selection: RecoveryMatrixSelection, options: Omit<MatrixCaseOptions, "matrixRunId">): Promise<RecoveryMatrixOutcome> {
  const chosen = selectRecoveryMatrixCases(selection);
  const matrixRunId = `rmx-${new Date().toISOString().replace(/[:.]/gu, "-")}-${randomBytes(3).toString("hex")}`;
  const directory = path.join(options.runsDirectory, "recovery-matrix", matrixRunId);
  await mkdir(directory, { recursive: true });
  const results: MatrixCaseResult[] = [];
  const status = recoveryMatrixStatus();
  const writeSummary = () => writeJson(path.join(directory, "summary.json"), {
    matrixRunId,
    cases: results.map(result => ({ caseId: result.caseId, row: result.row, verdict: result.verdict, reasons: result.reasons, missingRecords: result.missingRecords, runtimeRunId: result.run?.runtimeRunId ?? null, measures: result.measures })),
    status,
  });
  for (const { row, matrixCase } of chosen) {
    const result = await runMatrixCase(row, matrixCase, { ...options, matrixRunId });
    results.push(result);
    await writeJson(path.join(directory, `case-${matrixCase.caseId}.json`), result);
    await writeSummary();
  }
  return Object.freeze({ matrixRunId, directory, results, status });
}

async function writeJson(file: string, value: unknown): Promise<void> {
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
