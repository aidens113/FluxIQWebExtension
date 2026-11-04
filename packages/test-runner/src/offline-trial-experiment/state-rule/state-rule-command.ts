// The `state-rule` command: the go/no-go harness for the Answer First simulator. Saved
// Flows run through Core's trace state rule (`fluxiq/client-gateway`, with the web
// domain's port) and are compared with their own live answers, on saved data. Provider-
// free: no model, no site, no browser. Every store is read from a copy under `--work`,
// which is removed after it is read. Writes counts, codes, field paths and short ids to
// `--out` and tables to `--tables`; nothing else is written, and no row, URL or page text.
// Returns the exit code: 0 done, 2 usage.

import { mkdir, stat, writeFile } from "node:fs/promises";
import { webTraceStateDomain } from "@fluxiq-web-extension/domain/node";
import { measureBuild } from "./build-measure.js";
import { disagreementsTable, gapsTable, inputsTable, mutationsTable, pairsTable, refusedTable, runTable, summariseCorpus, totalsTable, verdictsTable } from "./corpus-summary.js";
import { labRunStores, readLabRun, readLabRuns, traceInRunWindow } from "./lab-corpus.js";
import { parseStateRuleArguments, STATE_RULE_USAGE } from "./state-rule-arguments.js";
import { readStoreTraces } from "./store-traces.js";
import { readTrialVerdicts } from "./trial-verdicts.js";
import type { BuildReport, LabRunRecord, StoreTrace } from "./types.js";
import path from "node:path";

const PRIMARY_CONFIG = "first/gap";

export async function stateRuleCommand(argv: readonly string[]): Promise<number> {
  const parsed = parseStateRuleArguments(argv);
  if ("error" in parsed) {
    process.stderr.write(`${parsed.error}\n${STATE_RULE_USAGE}\n`);
    return 2;
  }
  await mkdir(parsed.work, { recursive: true });
  const started = performance.now();
  const saved = parsed.labRuns !== null ? await readLabRuns(parsed.labRuns) : await oneRun(parsed.run!);
  // A run still marked running has no verdict to compare with, and an open window that would claim later runs' traces.
  const runs = saved.filter((run) => run.finishedAt !== null);
  const stores = await storesByFile(runs, parsed);
  const before = await fingerprints([...stores.keys()]);
  const builds: BuildReport[] = [];
  const unread: { store: string; reason: string }[] = [];
  for (const [storeFile, candidates] of stores) {
    let traces: readonly StoreTrace[];
    try {
      traces = await readStoreTraces({ storeFile, work: parsed.work, pick: (manifest) => candidates.some((run) => traceInRunWindow(manifest.startedAt, run)) });
    } catch (error) {
      unread.push({ store: path.basename(path.dirname(storeFile)), reason: error instanceof Error ? error.message.slice(0, 200) : "unreadable" });
      continue;
    }
    for (const run of candidates) {
      const own = traces.filter((trace) => traceInRunWindow(trace.manifest.startedAt, run));
      const exploration = own.find((trace) => trace.manifest.activity === "exploration");
      if (exploration === undefined) continue;
      const trialVerdicts = await readTrialVerdicts(path.join(run.directory, "steps"));
      // A store and its saved copy can both hold one build: it counts once.
      if (builds.some((known) => known.runId === run.runId && known.explorationTrace === exploration.manifest.traceId.slice(-8))) continue;
      const build = measureBuild({ run, exploration, traces: own.filter((trace) => trace !== exploration), domain: webTraceStateDomain, trialVerdicts });
      builds.push(build);
      process.stderr.write(`${build.runId} ${build.task.slice(0, 40)} ${build.flow} ${build.measures[PRIMARY_CONFIG]?.verdict.verdict ?? "no flow"}\n`);
    }
  }
  builds.sort((left, right) => left.runId.localeCompare(right.runId));
  const after = await fingerprints([...stores.keys()]);
  const sourcesUnchanged = [...before].every(([file, print]) => after.get(file) === print);
  const summary = summariseCorpus(builds);
  const report = { wallMs: Math.round(performance.now() - started), labRuns: saved.length, unfinishedRuns: saved.length - runs.length, storesRead: stores.size - unread.length, unread, sourcesUnchanged, normalisations: webTraceStateDomain.normalisations, summary, builds };
  if (parsed.out !== null) await writeFile(parsed.out, `${JSON.stringify(report, null, 2)}\n`);
  const tables = [
    `Builds ${summary.builds}; models ${JSON.stringify(summary.byModel)}; modes ${JSON.stringify(summary.byMode)}; Lab ${JSON.stringify(summary.byLabVerdict)}; refused by Core's offline admission ${JSON.stringify(summary.refusals)}; stores unread ${unread.length}; originals unchanged ${sourcesUnchanged}`,
    "### Totals against the control", totalsTable(summary),
    "### Exactly the same input", inputsTable(summary),
    "### Gaps", gapsTable(summary),
    "### Disagreements", disagreementsTable(summary),
    "### What refused reads would have said", refusedTable(summary),
    "### One live Flow run over the one before it", pairsTable(summary),
    "### Pure verdict against the Lab", verdictsTable(summary),
    `### Live trials, primary config\n${JSON.stringify(summary.trials)}`,
    `### The exploration walked as its own Flow\n${JSON.stringify({ builds: summary.self.builds, pass: summary.self.pass, fail: summary.self.fail, inconclusive: summary.self.inconclusive, commands: summary.self.tally.commands, answered: summary.self.tally.answered, gaps: summary.self.tally.gaps })}`,
    mutationsTable(summary),
    `### Per run, ${PRIMARY_CONFIG}`, runTable(builds, PRIMARY_CONFIG),
  ].join("\n\n");
  if (parsed.tables !== null) await writeFile(parsed.tables, `${tables}\n`);
  else process.stdout.write(`${tables}\n`);
  return 0;
}

async function oneRun(directory: string): Promise<readonly LabRunRecord[]> {
  const run = await readLabRun(directory);
  if (run === null) throw new Error(`${directory} holds no Lab run entry`);
  return [run];
}

/** Which runs each store may hold: named stores for all runs by time; otherwise the stores each run's instance kept. */
async function storesByFile(runs: readonly LabRunRecord[], parsed: { store: string | null; extraStores: readonly Readonly<{ store: string; runId: string }>[] }): Promise<ReadonlyMap<string, readonly LabRunRecord[]>> {
  const stores = new Map<string, LabRunRecord[]>();
  if (parsed.store !== null) {
    stores.set(parsed.store, [...runs]);
    return stores;
  }
  for (const run of runs) {
    for (const store of await labRunStores(run)) (stores.get(store) ?? stores.set(store, []).get(store)!).push(run);
  }
  for (const { store, runId } of parsed.extraStores) stores.set(store, runs.filter((run) => run.runId === runId));
  return stores;
}

async function fingerprints(files: readonly string[]): Promise<ReadonlyMap<string, string>> {
  const prints = new Map<string, string>();
  for (const file of files) {
    const { size, mtimeMs } = await stat(file);
    prints.set(file, `${size}:${mtimeMs}`);
  }
  return prints;
}
