import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseBenchReportJson, parseRunEvaluationJson, type BenchReport, type RunEvaluation } from "@fluxiq-web-extension/test-contracts";
import { RunnerFailure } from "../failure.js";
import { groupBenchResults, type BenchResultRuns } from "./aggregate-report.js";
import { containedPath, loadCampaignCheckpointChain, loadCampaignManifest, loadCampaignShardGroup, loadCampaignShardMergeSeal, type CampaignExecutionIdentity } from "./campaign/index.js";
import { BENCH_ID_PATTERN, benchDirectory, type BenchRunsFile } from "./report-store.js";

type ShardParentExecution = Extract<CampaignExecutionIdentity, { mode: "shard-parent" }>;
export type BenchCampaignTopology =
  | Readonly<{ mode: "serial" }>
  | Readonly<{ mode: "sharded"; algorithm: ShardParentExecution["algorithm"]; shardCount: number; jobs: number }>;

export type LoadedBenchReport = { report: BenchReport; directory: string; topology?: BenchCampaignTopology };

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
  const report = parseBenchReportJson(text);
  const topology = await loadCampaignTopology(directory, report, Buffer.from(text, "utf8"));
  return { report, directory, ...(topology ? { topology } : {}) };
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

async function loadCampaignTopology(directory: string, report: BenchReport, reportBytes: Buffer): Promise<BenchCampaignTopology | undefined> {
  let manifest;
  try { manifest = await loadCampaignManifest(directory); }
  catch (error) {
    if (isMissing(error)) return undefined;
    throw error;
  }
  if (manifest.benchId !== report.reportId) throw new RunnerFailure("fixture.invalid", "Bench report identity does not match its campaign authority");
  if (manifest.execution.mode === "serial") return { mode: "serial" };
  if (manifest.execution.mode !== "shard-parent") throw new RunnerFailure("fixture.invalid", "A shard child is not a readable logical bench report");

  const group = await loadCampaignShardGroup(directory);
  const parentChain = await loadCampaignCheckpointChain(directory, group.parent);
  if (parentChain.ignored.length !== 0 || parentChain.latest?.state !== "finished" || parentChain.latest.activeAttempt !== null) throw new RunnerFailure("fixture.invalid", "Sharded bench parent checkpoint is not exactly finished");
  const seal = await loadCampaignShardMergeSeal(directory, group);
  for (const [index, child] of group.children.entries()) {
    const childDirectory = containedPath(directory, `shards/${index.toString().padStart(3, "0")}`);
    const chain = await loadCampaignCheckpointChain(childDirectory, child);
    const sealed = seal.children[index];
    if (chain.ignored.length !== 0 || chain.latest?.state !== "finished" || chain.latest.activeAttempt !== null || chain.latest.checkpointSha256 !== sealed?.terminalCheckpointSha256) throw new RunnerFailure("fixture.invalid", "Sharded bench child terminal authority does not match its merge seal");
    await assertDigest(containedPath(childDirectory, "runs.json"), sealed.runsSha256, "child runs projection");
    await assertDigest(containedPath(childDirectory, "report.json"), sealed.reportSha256, "child report projection");
    await assertDigest(containedPath(childDirectory, "report.md"), sealed.markdownSha256, "child markdown projection");
  }
  if (sha256(reportBytes) !== seal.merged.reportSha256) throw new RunnerFailure("fixture.invalid", "Sharded bench report does not match its authenticated merge seal");
  await assertDigest(containedPath(directory, "runs.json"), seal.merged.runsSha256, "merged runs projection");
  await assertDigest(containedPath(directory, "report.md"), seal.merged.markdownSha256, "merged markdown projection");
  return { mode: "sharded", algorithm: manifest.execution.algorithm, shardCount: manifest.execution.shardCount, jobs: manifest.execution.jobs };
}

async function assertDigest(file: string, expected: string, label: string): Promise<void> {
  if (sha256(await readFile(file)) !== expected) throw new RunnerFailure("fixture.invalid", `Sharded bench ${label} does not match its authenticated merge seal`);
}

function sha256(bytes: Uint8Array): string { return createHash("sha256").update(bytes).digest("hex"); }
function isMissing(error: unknown): boolean { return typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === "ENOENT"; }
