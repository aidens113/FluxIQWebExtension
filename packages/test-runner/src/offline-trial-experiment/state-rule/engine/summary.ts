// The engine replays added up, in both arms, against what each run's live judge and the
// Lab's oracle said. A false pass is a pass on a Flow whose live run was judged no. A wrong
// reference is a false pass whose reference the live judge said yes to: the Flow repeated
// the recording's mistake. It is said apart from the rest and never counted away. Pure.

import type { EngineArm, EngineBuildResult } from "./replay.js";

export type EngineConfusion = {
  ran: number;
  refused: number;
  skipped: number;
  pass: number;
  fail: number;
  inconclusive: number;
  /** A pass on a Flow whose live run was judged no, or whose build the Lab failed. */
  falsePasses: number;
  /** Of those, the second arm's: the reference's own live judge said yes. */
  wrongReference: number;
  /** A fail on a Flow whose live run was judged yes. */
  falseFailures: number;
  passOnYes: number;
  failOnNo: number;
  answered: number;
  computed: number;
  gaps: Record<string, number>;
  /** Passes the task's own oracle also passed the offline rows of, and those it failed. */
  passOracleSame: number;
  passOracleFailed: number;
};

export type EngineSummary = {
  builds: number;
  notRun: Record<string, number>;
  arms: Record<EngineArm, EngineConfusion>;
};

const emptyConfusion = (): EngineConfusion => ({ ran: 0, refused: 0, skipped: 0, pass: 0, fail: 0, inconclusive: 0, falsePasses: 0, wrongReference: 0, falseFailures: 0, passOnYes: 0, failOnNo: 0, answered: 0, computed: 0, gaps: {}, passOracleSame: 0, passOracleFailed: 0 });

function judgedNo(verdict: string | null): boolean {
  return verdict === "no" || verdict === "execution_failed";
}

export function summariseEngine(results: readonly EngineBuildResult[]): EngineSummary {
  const summary: EngineSummary = { builds: results.length, notRun: {}, arms: { exploration: emptyConfusion(), previous_flow: emptyConfusion(), own_run: emptyConfusion() } };
  for (const result of results) {
    if (result.notRun !== null) {
      const reason = result.notRun.split(":")[0]!;
      summary.notRun[reason] = (summary.notRun[reason] ?? 0) + 1;
      continue;
    }
    for (const arm of result.arms) {
      const totals = summary.arms[arm.arm];
      if (arm.skipped !== null) {
        totals.skipped += 1;
        continue;
      }
      if (arm.refusal !== null) {
        totals.refused += 1;
        continue;
      }
      totals.ran += 1;
      totals.answered += arm.answered;
      totals.computed += arm.computed;
      for (const [code, count] of Object.entries(arm.gaps)) totals.gaps[code] = (totals.gaps[code] ?? 0) + count;
      const failedLive = judgedNo(result.liveVerdict) || (result.liveVerdict === null && result.labVerdict === "failed");
      if (arm.verdict === "pass") {
        totals.pass += 1;
        if (failedLive) totals.falsePasses += 1;
        if (failedLive && arm.arm === "previous_flow" && result.referenceVerdict === "yes") totals.wrongReference += 1;
        if (result.liveVerdict === "yes") totals.passOnYes += 1;
        if (arm.oracle === "passed") totals.passOracleSame += 1;
        if (arm.oracle === "failed") totals.passOracleFailed += 1;
      } else if (arm.verdict === "fail") {
        totals.fail += 1;
        if (result.liveVerdict === "yes") totals.falseFailures += 1;
        if (failedLive) totals.failOnNo += 1;
      } else totals.inconclusive += 1;
    }
  }
  return summary;
}

const sorted = (counts: Readonly<Record<string, number>>): string => Object.entries(counts).sort((left, right) => right[1] - left[1]).map(([key, value]) => `${key} ${value}`).join(", ") || "none";

export function engineTable(summary: EngineSummary, results: readonly EngineBuildResult[]): string {
  const lines = [
    `Builds ${summary.builds}; not run ${JSON.stringify(summary.notRun)}`,
    "",
    "| Arm | Ran | Refused | No source | Pass | Fail | Inconclusive | False pass | Of those, wrong reference | False failure | Pass on yes | Fail on no | Oracle passed a pass's rows | Oracle failed a pass's rows | Answered | Computed | Gaps |",
    "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|",
  ];
  for (const [arm, totals] of Object.entries(summary.arms)) {
    lines.push(`| ${arm} | ${totals.ran} | ${totals.refused} | ${totals.skipped} | ${totals.pass} | ${totals.fail} | ${totals.inconclusive} | ${totals.falsePasses} | ${totals.wrongReference} | ${totals.falseFailures} | ${totals.passOnYes} | ${totals.failOnNo} | ${totals.passOracleSame} | ${totals.passOracleFailed} | ${totals.answered} | ${totals.computed} | ${sorted(totals.gaps)} |`);
  }
  lines.push("", "| Run | Task | Lab | Oracle | Live judge | Reference judge | Arm | Verdict | Execution | Answered of recorded | Computed | Gaps, with their steps | Stopped at | Violated | Offline rows | Oracle on them | ms |", "|---|---|---|---|---|---|---|---|---|---:|---:|---|---|---|---:|---|---:|");
  for (const result of results) {
    const head = `| ${result.runId.replace(/^run-/u, "")} | ${result.task.slice(0, 36)} | ${result.labVerdict} | ${result.oracleVerdict ?? "-"} | ${result.liveVerdict ?? "-"} | ${result.referenceVerdict ?? "-"}`;
    if (result.notRun !== null) {
      lines.push(`${head} | - | not run: ${result.notRun.slice(0, 70)} | - | - | - | - | - | - | - | - | - |`);
      continue;
    }
    for (const arm of result.arms) {
      lines.push(`${head} | ${arm.arm} | ${arm.verdict ?? arm.refusal ?? arm.skipped ?? "-"} | ${arm.execution ?? "-"}${arm.trialCode === null ? "" : ` ${arm.trialCode}`} | ${arm.answered}/${arm.recorded} | ${arm.computed} | ${arm.stepGaps.slice(0, 6).map((gap) => `${gap.step ?? "?"}: ${gap.code} (${gap.actionType.replace(/^web\./u, "")})`).join(", ") || "-"}${arm.stepGaps.length > 6 ? ` and ${arm.stepGaps.length - 6} more` : ""} | ${arm.stopped === null ? "-" : `${arm.stopped.step}: ${arm.stopped.code ?? "-"}`} | ${arm.assertions.join(", ") || "-"} | ${arm.storedRows} | ${arm.oracle ?? "-"} | ${arm.wallMs} |`);
    }
  }
  return lines.join("\n");
}
