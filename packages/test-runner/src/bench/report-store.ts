import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { BenchReport, BenchTarget, RunEvaluation } from "@fluxiq-web-extension/test-contracts";

/** A bench id as `runBench` mints it: `bench-<base-36 time>-<8 hex>`. */
export const BENCH_ID_PATTERN = /^bench-[a-z0-9]+-[0-9a-f]{8}$/u;
const FILE_SAFE_RUN_ID = /^[A-Za-z0-9._-]{1,160}$/u;

/** One planned run of a bench, as `runs.json` records it. */
export type BenchRunRecord = {
  corpusRowId: string;
  scenarioId: string;
  workflowId: string | null;
  variantId: string | null;
  repeatIndex: number;
  status: "evaluated" | "skipped";
  /** Evaluated runs: the runner's run id, whose bundle is `<runs directory>/<runId>`, or the attempt id when the runner threw. */
  runId?: string;
  /** Evaluated runs: the `RunEvaluation` file, relative to the bench directory. */
  evaluation?: string;
  verdict?: RunEvaluation["verdict"];
  failureCategory?: string;
  skipReason?: string;
  /** Bundle files the bench could not read or verify. */
  problems?: string[];
};

/** `runs.json`: every planned run and where each measurement came from. Bench-local; not a shared contract. */
export type BenchRunsFile = {
  schemaVersion: "0.1";
  benchId: string;
  corpusId: string;
  repeatCount: number;
  target: BenchTarget;
  lane: "recording";
  startedAt: string;
  finishedAt?: string;
  sources: Readonly<Record<string, string>>;
  runs: BenchRunRecord[];
};

/** `<runs directory>/bench/<bench id>`. */
export function benchDirectory(runsDirectory: string, benchId: string): string {
  if (!BENCH_ID_PATTERN.test(benchId)) throw new Error(`Invalid bench id: ${benchId}`);
  return path.join(path.resolve(runsDirectory), "bench", benchId);
}

/** Replaces `runs.json`; the bench rewrites it after every run, so a bench cut short still lists what ran. */
export function writeBenchRuns(directory: string, runs: BenchRunsFile): Promise<string> { return writeJson(directory, "runs.json", runs); }

/** Writes `evaluations/<run id>.json` and returns that path relative to the bench directory. */
export async function writeRunEvaluation(directory: string, evaluation: RunEvaluation): Promise<string> {
  if (!FILE_SAFE_RUN_ID.test(evaluation.runId)) throw new Error(`Run id is not safe as a file name: ${evaluation.runId}`);
  const relative = `evaluations/${evaluation.runId}.json`;
  await writeJson(directory, relative, evaluation);
  return relative;
}

export function writeBenchReport(directory: string, report: BenchReport): Promise<string> { return writeJson(directory, "report.json", report); }

export async function writeBenchMarkdown(directory: string, markdown: string): Promise<string> {
  const file = path.join(directory, "report.md");
  await writeFile(file, markdown, "utf8");
  return file;
}

async function writeJson(directory: string, relative: string, value: unknown): Promise<string> {
  const file = path.join(directory, ...relative.split("/"));
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return file;
}
