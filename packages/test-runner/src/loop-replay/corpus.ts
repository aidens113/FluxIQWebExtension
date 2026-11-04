// Core's loop detector over every saved run, and what it would have done: runs
// scanned, loops by pattern, and every firing in a run that passed, so each can be
// looked at. Tool ids, step numbers and closed codes only.

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { AutomationStudioLlmLoopPattern } from "fluxiq/automation";
import { replayLoopRun, type LoopReplayFiring, type LoopReplayRun } from "./replay-run.js";

const PATTERNS: readonly AutomationStudioLlmLoopPattern[] = ["exact_repeat", "near_repeat", "cycle", "no_progress", "same_fix", "same_act"];
const RUNGS = ["steer", "refuse", "change_approach", "ask_person"] as const;

/** One saved run, replayed. */
export type LoopReplayCorpusRun = LoopReplayRun & { runId: string; verdict: string; scenarioId: string };

async function directories(root: string): Promise<string[]> {
  return (await readdir(root, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
}

async function summaryOf(runDirectory: string): Promise<{ verdict: string; scenarioId: string }> {
  try {
    const summary = JSON.parse(await readFile(path.join(runDirectory, "summary.json"), "utf8")) as { verdict?: unknown; scenarioId?: unknown };
    return { verdict: typeof summary.verdict === "string" ? summary.verdict : "unknown", scenarioId: typeof summary.scenarioId === "string" ? summary.scenarioId : "unknown" };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || error instanceof SyntaxError) return { verdict: "unknown", scenarioId: "unknown" };
    throw error;
  }
}

/** Replays every `<root>/<day>/run-*` with a `steps/`; a run with no steps is passed over. */
export async function replayLoopCorpus(root: string, options: { byHandle?: boolean } = {}): Promise<LoopReplayCorpusRun[]> {
  const runs: LoopReplayCorpusRun[] = [];
  for (const day of await directories(root)) {
    const dayDirectory = path.join(root, day);
    for (const runId of (await directories(dayDirectory)).filter((name) => name.startsWith("run-"))) {
      const runDirectory = path.join(dayDirectory, runId);
      let replayed: LoopReplayRun;
      try {
        replayed = await replayLoopRun(path.join(runDirectory, "steps"), options);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
        throw error;
      }
      if (!replayed.loops) continue;
      runs.push({ runId, ...(await summaryOf(runDirectory)), ...replayed });
    }
  }
  return runs;
}

const count = (firings: readonly LoopReplayFiring[], rung: LoopReplayFiring["rung"], pattern: AutomationStudioLlmLoopPattern): number => firings.filter((firing) => firing.rung === rung && firing.pattern === pattern).length;

/** The table: one line per verdict, per pattern, and every new pattern's firing in a run that passed. */
export function renderLoopReplayTable(runs: readonly LoopReplayCorpusRun[]): string {
  const lines = [`runs scanned: ${runs.length}; model calls: ${runs.reduce((sum, run) => sum + run.calls, 0)}`, ""];
  lines.push(`| verdict | runs | fired | ${PATTERNS.join(" | ")} |`, `| --- | --- | --- | ${PATTERNS.map(() => "---").join(" | ")} |`);
  for (const verdict of [...new Set(runs.map((run) => run.verdict))].sort()) {
    const of = runs.filter((run) => run.verdict === verdict);
    lines.push(`| ${verdict} | ${of.length} | ${of.filter((run) => run.firings.length > 0).length} | ${PATTERNS.map((pattern) => of.reduce((sum, run) => sum + run.caught[pattern], 0)).join(" | ")} |`);
  }
  lines.push("", `| ladder step | pattern | ${[...new Set(runs.map((run) => run.verdict))].sort().join(" | ")} |`, `| --- | --- | ${[...new Set(runs.map((run) => run.verdict))].map(() => "---").join(" | ")} |`);
  for (const rung of RUNGS) {
    for (const pattern of PATTERNS) {
      const counts = [...new Set(runs.map((run) => run.verdict))].sort().map((verdict) => runs.filter((run) => run.verdict === verdict).reduce((sum, run) => sum + count(run.firings, rung, pattern), 0));
      if (counts.some((value) => value > 0)) lines.push(`| ${rung} | ${pattern} | ${counts.join(" | ")} |`);
    }
  }
  const passed = runs.filter((run) => run.verdict === "passed").flatMap((run) => run.firings.filter((firing) => firing.pattern !== "exact_repeat").map((firing) => ({ runId: run.runId, firing })));
  lines.push("", `firings of the new patterns in passed runs: ${passed.length}`, "", "| run | role | brief | step | rung | pattern | repeats | tools |", "| --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const { runId, firing } of passed) lines.push(`| ${runId} | ${firing.role ?? "-"} | ${firing.briefId ?? "-"} | ${firing.step} | ${firing.rung} | ${firing.pattern} | ${firing.repeats} | ${firing.toolIds.join(", ")} |`);
  return lines.join("\n");
}
