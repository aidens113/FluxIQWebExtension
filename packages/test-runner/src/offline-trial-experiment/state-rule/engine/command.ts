// The `state-engine` command: every saved project build's last tested Flow, run offline end
// to end through the real intake on the state engine, in both arms (`./engine-replay.ts`).
// Provider-free: no model, site or browser. Each build's workspace is copied under `--work`
// and removed once read. Writes counts, codes, field paths and short ids. Returns the exit
// code: 0 done, 2 usage.

import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { jsonRecord } from "../../json-record.js";
import type { LabRunRecord, StoreTrace } from "../types.js";
import { engineTable, summariseEngine } from "./summary.js";
import { projectStoreWorkspace, replayBuildOnEngine, type EngineBuildResult } from "./replay.js";
import { labRunStores, readLabRuns, traceInRunWindow } from "../lab-corpus.js";
import { readStoreTraces } from "../store-traces.js";
import { freshStoreCopyRefusal } from "../../run/index.js";

export const STATE_ENGINE_USAGE = "usage: offline-trial-experiment/cli.js state-engine --lab-runs <lab-runs dir> --work <dir under test-runs/> [--only <run id>,...] [--out <json file>] [--tables <markdown file>]";

export async function stateEngineCommand(argv: readonly string[], repositoryRoot: string): Promise<number> {
  const options = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index]!;
    const value = argv[index + 1];
    if (!["--lab-runs", "--work", "--only", "--out", "--tables"].includes(name) || value === undefined) {
      process.stderr.write(`${name} is not an argument, or needs a value\n${STATE_ENGINE_USAGE}\n`);
      return 2;
    }
    options.set(name.slice(2), value);
  }
  const labRuns = options.get("lab-runs");
  const work = options.get("work");
  if (labRuns === undefined || work === undefined || freshStoreCopyRefusal(work) !== null) {
    process.stderr.write(`--lab-runs and --work under test-runs/ are required\n${STATE_ENGINE_USAGE}\n`);
    return 2;
  }
  const only = options.get("only")?.split(",") ?? null;
  await mkdir(work, { recursive: true });
  const runs = (await readLabRuns(labRuns)).filter((run) => run.finishedAt !== null && (only === null || only.includes(run.runId)));
  const results: EngineBuildResult[] = [];
  const unread: { store: string; reason: string }[] = [];
  let attempted = 0;
  // Each store is opened once: a Lab instance's stores would otherwise be read again for every run of that instance.
  const stores = new Map<string, LabRunRecord[]>();
  for (const run of runs) {
    for (const store of await labRunStores(run)) (stores.get(store) ?? stores.set(store, []).get(store)!).push(run);
  }
  for (const [storeFile, candidates] of stores) {
    let stored: readonly StoreTrace[];
    try {
      stored = await readStoreTraces({ storeFile, work, pick: (manifest) => candidates.some((run) => traceInRunWindow(manifest.startedAt, run)) });
    } catch (error) {
      unread.push({ store: path.basename(path.dirname(storeFile)), reason: error instanceof Error ? error.message.slice(0, 200) : "unreadable" });
      continue;
    }
    for (const run of candidates) {
      const exploration = stored.find((trace) => trace.manifest.activity === "exploration" && traceInRunWindow(trace.manifest.startedAt, run));
      if (exploration === undefined) continue;
      const context = jsonRecord(jsonRecord(exploration.manifest.context)?.value);
      attempted += 1;
      const { fluxiqDir, projectId } = projectStoreWorkspace(storeFile);
      const runWork = path.join(work, run.runId.slice(-8));
      try {
        const result = typeof context?.authoringMode === "string"
          ? await replayBuildOnEngine({ run, fluxiqDir, projectId, work: runWork, repositoryRoot })
          : { runId: run.runId, task: run.task, labVerdict: run.verdict, oracleVerdict: run.oracleVerdict, liveVerdict: null, referenceVerdict: null, notRun: "legacy_build_has_no_rebuild_seam", arms: [] };
        results.push(result);
        process.stderr.write(`${run.runId} ${result.notRun ?? result.arms.map((arm) => `${arm.arm}:${arm.verdict ?? arm.refusal ?? arm.skipped}`).join(" ")}\n`);
      } catch (error) {
        const reason = error instanceof Error ? error.message.slice(0, 120) : "failed";
        results.push({ runId: run.runId, task: run.task, labVerdict: run.verdict, oracleVerdict: run.oracleVerdict, liveVerdict: null, referenceVerdict: null, notRun: `error:${reason}`, arms: [] });
        process.stderr.write(`${run.runId} error ${reason}\n`);
      } finally {
        await rm(runWork, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
      }
    }
  }
  results.sort((left, right) => left.runId.localeCompare(right.runId));
  const summary = summariseEngine(results);
  if (options.has("out")) await writeFile(options.get("out")!, `${JSON.stringify({ attempted, unread, summary, results }, null, 2)}\n`);
  const tables = `Stores unread ${unread.length}\n\n${engineTable(summary, results)}`;
  if (options.has("tables")) await writeFile(options.get("tables")!, `${tables}\n`);
  else process.stdout.write(`${tables}\n`);
  return 0;
}
