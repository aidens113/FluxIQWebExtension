// The builds' measures added up, and the tables a person reads: agreement against the
// control, what was answered and each gap's reason, why acts disagreed, and the pure
// verdict against the Lab's saved oracle verdicts. Pure. Counts and codes only.

import { emptyControlTally } from "./control.js";
import { emptyWalkTally } from "./flow-walk.js";
import type { BuildReport, ControlTally, MutationName, WalkTally } from "./types.js";

export type VerdictConfusion = {
  builds: number;
  pass: number;
  fail: number;
  inconclusive: number;
  /** Harness pass on a saved failed run. */
  falsePasses: number;
  /** Of those, the runs the oracle itself judged failed. */
  falsePassesOnOracleFailed: number;
  /** Harness fail on a saved passed run. */
  falseFailures: number;
  passOnPassed: number;
  failOnFailed: number;
};

export type TrialConfusion = { trials: number; pass: number; fail: number; inconclusive: number; passOnNo: number; passOnYes: number; failOnYes: number; failOnNo: number; noLiveVerdict: number };

export type CorpusSummary = {
  builds: number;
  byModel: Record<string, number>;
  byMode: Record<string, number>;
  byLabVerdict: Record<string, number>;
  measures: Record<string, WalkTally>;
  verdicts: Record<string, VerdictConfusion>;
  trials: TrialConfusion;
  control: ControlTally;
  controlBuilds: number;
  self: { builds: number; tally: WalkTally; pass: number; fail: number; inconclusive: number };
  mutations: Record<MutationName, { applied: number; pass: number; fail: number; inconclusive: number }>;
  refusals: Record<string, number>;
  /** One live Flow run over the one before it. */
  pairs: { pairs: number; tally: WalkTally; pass: number; fail: number; inconclusive: number; sameCommands: number; passSameCommands: number; passAfterYesThenYes: number; passAfterYesThenNo: number; passAfterNoThenNo: number; passAfterNoThenYes: number; passUnjudged: number };
};

export function addTally(total: WalkTally, tally: WalkTally): void {
  for (const key of Object.keys(total) as (keyof WalkTally)[]) {
    const value = tally[key];
    if (typeof value === "number") (total[key] as number) += value;
    else addCounts(total[key] as Record<string, number>, value);
  }
}

function addCounts(total: Record<string, number>, counts: Readonly<Record<string, number>>): void {
  for (const [key, value] of Object.entries(counts)) total[key] = (total[key] ?? 0) + value;
}

export function summariseCorpus(builds: readonly BuildReport[]): CorpusSummary {
  const summary: CorpusSummary = {
    builds: builds.length, byModel: {}, byMode: {}, byLabVerdict: {}, measures: {}, verdicts: {},
    trials: { trials: 0, pass: 0, fail: 0, inconclusive: 0, passOnNo: 0, passOnYes: 0, failOnYes: 0, failOnNo: 0, noLiveVerdict: 0 },
    control: emptyControlTally(), controlBuilds: 0,
    self: { builds: 0, tally: emptyWalkTally(), pass: 0, fail: 0, inconclusive: 0 },
    mutations: { drop_last_act: mutationCounts(), repeat_act: mutationCounts(), other_row: mutationCounts(), changed_read: mutationCounts(), swap_acts: mutationCounts(), drop_last_move: mutationCounts() },
    refusals: {},
    pairs: { pairs: 0, tally: emptyWalkTally(), pass: 0, fail: 0, inconclusive: 0, sameCommands: 0, passSameCommands: 0, passAfterYesThenYes: 0, passAfterYesThenNo: 0, passAfterNoThenNo: 0, passAfterNoThenYes: 0, passUnjudged: 0 },
  };
  for (const build of builds) {
    for (const pair of build.pairs) {
      const pairs = summary.pairs;
      pairs.pairs += 1;
      addTally(pairs.tally, pair.tally);
      pairs[pair.verdict.verdict] += 1;
      if (pair.sameCommands) pairs.sameCommands += 1;
      if (pair.verdict.verdict !== "pass") continue;
      if (pair.sameCommands) pairs.passSameCommands += 1;
      const judged = (verdict: string | null): "yes" | "no" | null => (verdict === "yes" ? "yes" : verdict === "no" || verdict === "execution_failed" ? "no" : null);
      const from = judged(pair.liveFrom);
      const to = judged(pair.liveTo);
      if (from === "yes" && to === "yes") pairs.passAfterYesThenYes += 1;
      else if (from === "yes" && to === "no") pairs.passAfterYesThenNo += 1;
      else if (from === "no" && to === "no") pairs.passAfterNoThenNo += 1;
      else if (from === "no" && to === "yes") pairs.passAfterNoThenYes += 1;
      else pairs.passUnjudged += 1;
    }
    bump(summary.byModel, build.model ?? "unknown");
    bump(summary.byMode, build.authoringMode ?? "legacy");
    bump(summary.byLabVerdict, build.labVerdict);
    if (build.explorationRefusal !== null) bump(summary.refusals, `exploration:${build.explorationRefusal}`);
    if (build.flowRefusal !== null) bump(summary.refusals, `flow:${build.flowRefusal}`);
    for (const [key, measure] of Object.entries(build.measures)) {
      addTally((summary.measures[key] ??= emptyWalkTally()), measure.tally);
      const confusion = (summary.verdicts[key] ??= { builds: 0, pass: 0, fail: 0, inconclusive: 0, falsePasses: 0, falsePassesOnOracleFailed: 0, falseFailures: 0, passOnPassed: 0, failOnFailed: 0 });
      confusion.builds += 1;
      confusion[measure.verdict.verdict] += 1;
      const failedRun = build.labVerdict === "failed";
      if (measure.verdict.verdict === "pass") {
        if (failedRun) confusion.falsePasses += 1;
        else confusion.passOnPassed += 1;
        if (build.oracleVerdict === "failed") confusion.falsePassesOnOracleFailed += 1;
      }
      if (measure.verdict.verdict === "fail") {
        if (failedRun) confusion.failOnFailed += 1;
        else confusion.falseFailures += 1;
      }
    }
    if (build.control !== null) {
      summary.controlBuilds += 1;
      for (const key of Object.keys(summary.control) as (keyof ControlTally)[]) summary.control[key] += build.control[key];
    }
    if (build.self !== null) {
      summary.self.builds += 1;
      addTally(summary.self.tally, build.self.tally);
      summary.self[build.self.verdict.verdict] += 1;
      for (const mutation of build.self.mutations) {
        const counts = summary.mutations[mutation.mutation];
        counts.applied += 1;
        counts[mutation.verdict] += 1;
      }
    }
    for (const trial of build.trials) {
      summary.trials.trials += 1;
      summary.trials[trial.verdict] += 1;
      const yes = trial.liveVerdict === "yes";
      const no = trial.liveVerdict === "no" || trial.liveVerdict === "execution_failed";
      if (!yes && !no) summary.trials.noLiveVerdict += 1;
      if (trial.verdict === "pass" && no) summary.trials.passOnNo += 1;
      if (trial.verdict === "pass" && yes) summary.trials.passOnYes += 1;
      if (trial.verdict === "fail" && yes) summary.trials.failOnYes += 1;
      if (trial.verdict === "fail" && no) summary.trials.failOnNo += 1;
    }
  }
  return summary;
}

function mutationCounts(): { applied: number; pass: number; fail: number; inconclusive: number } {
  return { applied: 0, pass: 0, fail: 0, inconclusive: 0 };
}

function bump(counts: Record<string, number>, key: string): void {
  counts[key] = (counts[key] ?? 0) + 1;
}

const ratio = (same: number, differ: number): string => `${same}/${same + differ}`;
const sorted = (counts: Readonly<Record<string, number>>): string => Object.entries(counts).sort((left, right) => right[1] - left[1]).map(([key, value]) => `${key} ${value}`).join(", ") || "none";

/** The per-run table, under one config. */
export function runTable(builds: readonly BuildReport[], key: string): string {
  const lines = [
    "| Run | Task | Model | Mode | Lab | Oracle | Flow | Cmds | Answered | URL (snapshots) | Act status | Move status | Rows | Verdict | First gap |",
    "|---|---|---|---|---|---|---|---:|---:|---:|---:|---:|---:|---|---|",
  ];
  for (const build of builds) {
    const measure = build.measures[key];
    const head = `| ${build.runId.replace(/^run-/u, "")} | ${build.task.slice(0, 44)} | ${shortModel(build.model)} | ${build.authoringMode ?? "legacy"} | ${build.labVerdict} | ${build.oracleVerdict ?? "-"} | ${build.flow}`;
    if (measure === undefined) {
      lines.push(`${head} | - | - | - | - | - | - | - | - |`);
      continue;
    }
    const { tally, verdict } = measure;
    lines.push(`${head} | ${tally.commands} | ${tally.answered} | ${ratio(tally.snapshotUrlSame, tally.snapshotUrlDiffer)} | ${ratio(tally.statusSameActs, tally.statusDifferActs)} | ${ratio(tally.statusSameMoves, tally.statusDifferMoves)} | ${ratio(tally.rowsSame, tally.rowsDiffer)} | ${verdict.verdict} | ${verdict.firstGap === null ? "-" : `${verdict.firstGap.code} (${verdict.firstGap.actionType.replace(/^web\./u, "")})`} |`);
  }
  return lines.join("\n");
}

function shortModel(model: string | null): string {
  return model === null ? "?" : model.replace(/^deepseek-/u, "ds-").replace(/^claude-/u, "cl-");
}

/** The totals table, one row per config, with the control beside it. */
export function totalsTable(summary: CorpusSummary): string {
  const control = summary.control;
  const lines = [
    "| Config | Cmds | Answered | Before leaving: answered of cmds | Not sent | URL, all reads | URL, snapshots | Opening URL | Selectors >= 0.5 | Selectors >= 0.8 | Rows | Status, all | Act status | Move status |",
    "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
    `| **Control** (two live runs, ${summary.controlBuilds} builds) | ${control.positions} | - | - | - | - | ${ratio(control.snapshotUrlSame, control.snapshotUrlDiffer)} | - | ${ratio(control.selectorsClose, control.selectorsFar)} | ${control.selectorsVeryClose}/${control.selectorsClose + control.selectorsFar} | ${ratio(control.rowsSame, control.rowsDiffer)} | ${ratio(control.statusSame, control.statusDiffer)} | ${ratio(control.statusSameActs, control.statusDifferActs)} (layer ${ratio(control.statusSameLayerActs, control.statusDifferLayerActs)}) | ${ratio(control.statusSameMoves, control.statusDifferMoves)} |`,
  ];
  for (const [key, tally] of Object.entries(summary.measures)) {
    lines.push(`| ${key} | ${tally.commands} | ${tally.answered} | ${tally.answeredOnRecording}/${tally.commandsOnRecording} | ${tally.notSent} | ${ratio(tally.urlSame, tally.urlDiffer)} | ${ratio(tally.snapshotUrlSame, tally.snapshotUrlDiffer)} | ${ratio(tally.openingUrlSame, tally.openingUrlDiffer)} | ${ratio(tally.selectorsClose, tally.selectorsFar)} | ${tally.selectorsVeryClose}/${tally.selectorsClose + tally.selectorsFar} | ${ratio(tally.rowsSame, tally.rowsDiffer)} | ${ratio(tally.statusSameAll, tally.statusDifferAll)} | ${ratio(tally.statusSameActs, tally.statusDifferActs)} (${tally.markedActDisagreements} marked) | ${ratio(tally.statusSameMoves, tally.statusDifferMoves)} |`);
  }
  return lines.join("\n");
}

export function gapsTable(summary: CorpusSummary): string {
  const lines = ["| Config | Gaps by reason | What first took the run off the recording | Differing fields, nearest recorded call |", "|---|---|---|---|"];
  for (const [key, tally] of Object.entries(summary.measures)) lines.push(`| ${key} | ${sorted(tally.gaps)} | ${sorted(tally.firstLeave)} | ${sorted(tally.gapFields).split(", ").slice(0, 12).join(", ")} |`);
  return lines.join("\n");
}

/** "Exactly the same input": how many of a Flow's commands the recording holds, whatever the state. */
export function inputsTable(summary: CorpusSummary): string {
  const lines = ["| Config | Reads same input | Moves same input | Acts same input | Act gaps' nearest recorded act |", "|---|---:|---:|---:|---|"];
  for (const [key, tally] of Object.entries(summary.measures)) lines.push(`| ${key} | ${ratio(tally.readsSameInput, tally.readsOtherInput)} | ${ratio(tally.movesSameInput, tally.movesOtherInput)} | ${ratio(tally.actsSameInput, tally.actsOtherInput)} | ${sorted(tally.actGapElements)} |`);
  return lines.join("\n");
}

export function disagreementsTable(summary: CorpusSummary): string {
  const lines = ["| Config | Disagreements (kind, recorded, live, live failure code, layer mark) | Marked may-be-gone |", "|---|---|---:|"];
  for (const [key, tally] of Object.entries(summary.measures)) lines.push(`| ${key} | ${sorted(tally.disagreements)} | ${tally.markedActDisagreements} |`);
  return lines.join("\n");
}

export function refusedTable(summary: CorpusSummary): string {
  const lines = ["| Config | Refused reads, what answering would have said of the URL: same | differ | Position-blind (same input, same acts, other node): URL same/all |", "|---|---|---|---:|"];
  for (const [key, tally] of Object.entries(summary.measures)) lines.push(`| ${key} | ${sorted(tally.refusedUrlSame)} | ${sorted(tally.refusedUrlDiffer)} | ${ratio(tally.blindPositionUrlSame, tally.blindPositionUrlDiffer)} |`);
  return lines.join("\n");
}

/** One live Flow run over the one before it: what a later attempt's simulation would have read. */
export function pairsTable(summary: CorpusSummary): string {
  const { pairs } = summary;
  const { tally } = pairs;
  return [
    "| Pairs | Same commands | Cmds | Answered | URL, snapshots | Selectors >= 0.5 | Selectors >= 0.8 | Rows | Status, all | Act status | Pass | Fail | Inconclusive |",
    "|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
    `| ${pairs.pairs} | ${pairs.sameCommands} | ${tally.commands} | ${tally.answered} | ${ratio(tally.snapshotUrlSame, tally.snapshotUrlDiffer)} | ${ratio(tally.selectorsClose, tally.selectorsFar)} | ${tally.selectorsVeryClose}/${tally.selectorsClose + tally.selectorsFar} | ${ratio(tally.rowsSame, tally.rowsDiffer)} | ${ratio(tally.statusSameAll, tally.statusDifferAll)} | ${ratio(tally.statusSameActs, tally.statusDifferActs)} (${tally.markedActDisagreements} marked) | ${pairs.pass} | ${pairs.fail} | ${pairs.inconclusive} |`,
    "",
    `Passes by what each run's judge said: earlier yes, later yes ${pairs.passAfterYesThenYes}; earlier yes, later no ${pairs.passAfterYesThenNo} (a false pass); earlier no, later no ${pairs.passAfterNoThenNo}; earlier no, later yes ${pairs.passAfterNoThenYes}; a run with no judge ${pairs.passUnjudged}. Passes where the two runs sent the same commands: ${pairs.passSameCommands}.`,
    `Gaps: ${sorted(tally.gaps)}.`,
    `Disagreements: ${sorted(tally.disagreements)}.`,
  ].join("\n");
}

export function verdictsTable(summary: CorpusSummary): string {
  const lines = ["| Config | Builds | Pass | Fail | Inconclusive | False pass on failed run | Of those, oracle failed | Pass on passed run | Fail on failed run | False fail on passed run |", "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|"];
  for (const [key, confusion] of Object.entries(summary.verdicts)) {
    lines.push(`| ${key} | ${confusion.builds} | ${confusion.pass} | ${confusion.fail} | ${confusion.inconclusive} | ${confusion.falsePasses} | ${confusion.falsePassesOnOracleFailed} | ${confusion.passOnPassed} | ${confusion.failOnFailed} | ${confusion.falseFailures} |`);
  }
  return lines.join("\n");
}

export function mutationsTable(summary: CorpusSummary): string {
  const lines = ["| Mutation of the exploration's own commands | Applied | Passed (must be 0) | Fail | Inconclusive |", "|---|---:|---:|---:|---:|"];
  for (const [name, counts] of Object.entries(summary.mutations)) lines.push(`| ${name} | ${counts.applied} | ${counts.pass} | ${counts.fail} | ${counts.inconclusive} |`);
  return lines.join("\n");
}
