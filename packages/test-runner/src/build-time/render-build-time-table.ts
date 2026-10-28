import { CATEGORY_RULES } from "./category-rules.js";
import type { BuildCategory, BuildTimeTotals, RunBuildTimeRow } from "./types.js";

const CATEGORIES: readonly BuildCategory[] = ["trial", "offline", "reset", "model", "exploration", "other"];

const minutes = (ms: number) => (ms / 60_000).toFixed(1);
const percent = (part: number, whole: number) => (whole > 0 ? `${((part / whole) * 100).toFixed(1)}%` : "-");
const cell = (value: string) => value.replace(/\|/gu, "\\|");

/** The report as Markdown: one row per run, the pooled shares, and the classification table it used. */
export function renderBuildTimeTable(rows: readonly RunBuildTimeRow[], totals: BuildTimeTotals): string {
  const lines = [
    "| Run | Task | Verdict | Build min | Trial | Offline | Reset | Model | Explore | Other (idle) | Trials | Live trials | Offline trials | Longest trial s | Model in trials s | Playback s | Incomplete |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |"
  ];
  for (const row of rows) {
    const m = row.measured;
    const shares = CATEGORIES.slice(0, 5).map(category => percent(m.exclusive[category], m.wallMs));
    lines.push(`| ${row.runId} | ${cell(row.task)} | ${row.verdict} | ${minutes(m.wallMs)} | ${shares.join(" | ")} | ${percent(m.exclusive.other, m.wallMs)} (${percent(m.idleMs, m.wallMs)}) | ${m.trialCount} | ${m.liveTrialCount} | ${m.offlineTrialCount} | ${(m.longestTrialMs / 1000).toFixed(0)} | ${(m.modelInTrialMs / 1000).toFixed(0)} | ${(m.playbackMs / 1000).toFixed(0)} | ${row.incomplete.length} |`);
  }
  lines.push("", `Overall, ${totals.runs} runs, ${minutes(totals.wallMs)} build minutes, ${totals.trialCount} trials (${totals.liveTrialCount} live, ${totals.offlineTrialCount} offline checks):`, "", "| Category | Minutes | Pooled share | Mean per-run share |", "| --- | --- | --- | --- |");
  for (const category of CATEGORIES) lines.push(`| ${category} | ${minutes(totals.exclusive[category])} | ${percent(totals.share[category], 1)} | ${percent(totals.meanShare[category], 1)} |`);
  lines.push(
    "",
    `Of other: idle (no step running) ${minutes(totals.idleMs)} min. Model time inside trials (counted as trial): ${minutes(totals.modelInTrialMs)} min (${percent(totals.modelInTrialMs, totals.exclusive.trial)} of trial time). Reset time inside trials (counted as reset, not trial): ${minutes(totals.resetInTrialMs)} min. Playback excluded: ${minutes(totals.playbackMs)} min. Incomplete steps skipped: ${totals.incompleteSteps}.`,
    `Unknown kinds (in other): ${Object.keys(totals.unknown).length === 0 ? "none" : Object.entries(totals.unknown).map(([key, count]) => `${key} x${count}`).join(", ")}.`,
    "",
    "Precedence for overlaps: reset > offline > trial > model > exploration > other.",
    "",
    "| Rule | Category | Matches | Steps |",
    "| --- | --- | --- | --- |"
  );
  for (const rule of CATEGORY_RULES) lines.push(`| ${rule.id} | ${rule.category} | ${cell(rule.describes)} | ${totals.ruleCounts[rule.id] ?? 0} |`);
  lines.push(`| unknown | other | anything else | ${totals.ruleCounts.unknown ?? 0} |`);
  return lines.join("\n");
}
