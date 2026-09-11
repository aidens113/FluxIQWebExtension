import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseBenchReportJson, parseRunEvaluationJson, type BenchReport, type RunEvaluation } from "@fluxiq-web-extension/test-contracts";
import { RunnerFailure } from "../failure.js";
import { groupBenchResults, type BenchResultRuns } from "./aggregate-report.js";
import { BENCH_ID_PATTERN, benchDirectory, type BenchRunsFile } from "./report-store.js";

export type LoadedBenchReport = { report: BenchReport; directory: string };

/**
 * Loads and validates a bench's `report.json` by reference: a bench id, found
 * under `<runs directory>/bench/`, or a path, relative to `cwd`, to a
 * `report.json` or to the bench directory holding one.
 */
export async function loadBenchReport(reference: string, runsDirectory: string, cwd: string): Promise<LoadedBenchReport> {
  const resolved = path.resolve(cwd, reference);
  const directory = BENCH_ID_PATTERN.test(reference) ? benchDirectory(runsDirectory, reference) : path.basename(resolved) === "report.json" ? path.dirname(resolved) : resolved;
  const file = path.join(directory, "report.json");
  const text = await readFile(file, "utf8").catch((cause: unknown) => { throw new RunnerFailure("environment.missing", `Bench report not found: ${reference} (${file})`, { cause }); });
  return { report: parseBenchReportJson(text), directory };
}

/** The evaluated runs `runs.json` lists, each evaluation validated, grouped into results in the order the bench ran them. */
export async function loadBenchResults(directory: string): Promise<BenchResultRuns[]> {
  const root = path.resolve(directory);
  const runs = JSON.parse(await readFile(path.join(root, "runs.json"), "utf8")) as Partial<BenchRunsFile>;
  if (!Array.isArray(runs.runs)) throw new RunnerFailure("fixture.invalid", `${path.join(root, "runs.json")} lists no runs`);
  const evaluated: Array<{ corpusRowId: string; evaluation: RunEvaluation }> = [];
  for (const record of runs.runs) {
    if (record.status !== "evaluated") continue;
    const file = typeof record.evaluation === "string" ? path.resolve(root, record.evaluation) : undefined;
    if (!file || !file.startsWith(root + path.sep)) throw new RunnerFailure("fixture.invalid", `runs.json names no evaluation inside the bench for ${record.corpusRowId} repeat ${record.repeatIndex}`);
    evaluated.push({ corpusRowId: record.corpusRowId, evaluation: parseRunEvaluationJson(await readFile(file, "utf8")) });
  }
  return groupBenchResults(evaluated);
}
