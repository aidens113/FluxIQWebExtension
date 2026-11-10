import { writeFile } from "node:fs/promises";
import path from "node:path";
import type { AttemptReportRow, AttemptSeries } from "@fluxiq-web-extension/test-contracts";
import type { AttemptOutcome } from "../driver.js";
import { renderAttemptSeries } from "../report.js";
import type { AttemptOutcomeRecord } from "./attempt/index.js";
import type { LiveAttemptEnded } from "./live-driver.js";
import { writePaidAttemptBundle } from "./paid-attempt-bundle.js";

/** An attempt the driver had already scored when the run ended early, with its row in the series. */
export type ScoredAttempt = Readonly<{ outcome: AttemptOutcome; row: AttemptReportRow }>;

/**
 * What a run keeps when something throws after its attempts ended: an attempt record for each
 * one that ended, marked as not scored and saying why, and for a paid run the bundle the spend
 * ledger reads its run id, verdict and spend from. `run-mw43h5ew-a04a583d` lost all three to a
 * dataset read that threw after a $0.54 attempt, and its ledger line had no run and no cost.
 *
 * Its picture and `answer-turn.json` are written as each attempt ends (`../live/live-driver.ts`
 * keeps that ending whatever its scoring throws), so they are already in the evidence folder.
 * An attempt record the run already wrote is left as it is: it is the whole one. The spend is
 * what Core recorded for the attempts that ended; with none ended and nothing said of an attempt
 * that did not, there is no spend to stand behind and no bundle is written, as before. Returns
 * the line that says what was kept.
 *
 * It also keeps a series that ended early (`run-mw4907db-c3992394`: attempt 1 ended and was paid
 * for, attempt 2 never started, and the proof stopped waiting). `scored` holds each attempt the
 * driver had already scored; its record carries its verdict, rows and site change as a finished
 * one does and is not marked unscored. `didNotEnd` names the attempt that never started or never
 * ended, with the reason (the stuck message, with what the chat showed) and what Core had recorded
 * of it so far. That spend is in the ledger too, and the bundle is written even with no attempt
 * ended, because the run was started, typed into and paid for.
 */
export async function writeUnscoredAttemptEvidence(input: {
  evidence: string;
  attempts: number;
  kept: ReadonlyMap<number, { ended: LiveAttemptEnded; cache: unknown; modelCalls: Record<string, number> | null }>;
  error: unknown;
  recorded: boolean;
  scored?: ReadonlyMap<number, ScoredAttempt>;
  /**
   * The attempt that did not end. `started` is set when the run did start it (it typed the instruction and followed it), with the
   * steps the run logged for it and the chat's reading of the instruction (a replay's own steps are not in the step log) and, when the script refused a request, which one: it is then not an attempt that "did not start".
   */
  didNotEnd?: { ordinal: number; attempt?: AttemptOutcomeRecord | null; started?: { loggedSteps: number; interpretationCalls: number; refusal?: { kind: string; ordinal: number } } };
  /** The series of every attempt that ended and was scored, as a finished run would have written it: its rows, continuations and deterministic summary. */
  series?: AttemptSeries;
  paid?: { runsDirectory: string; runId: string; startedAt: string; plan: { maxTotalEstimatedCostUsd: number }; stepsDirectory: string };
}): Promise<string> {
  const ended = [...input.kept.entries()].sort(([left], [right]) => left - right).map(([, each]) => each);
  if (ended.length === 0 && !input.didNotEnd) return "no attempt had ended, so there was no attempt to keep";
  const notScored = { name: input.error instanceof Error ? input.error.name : typeof input.error, ...categoryOf(input.error), message: input.error instanceof Error ? input.error.message : String(input.error) };
  const records = ended.map(({ ended: { ordinal, outcome, site }, cache, modelCalls }) => ({ ordinal, ...scoreOf(input.scored?.get(ordinal), notScored), attempt: outcome.attempt, result: outcome.result ?? null, saved: outcome.saved ?? null, budgetUsd: outcome.attempt.budget.usd, cache, actsWithNoRow: outcome.attempt.actsWithNoRow ?? 0, modelCalls, site }));
  const unended = input.didNotEnd ? { ordinal: input.didNotEnd.ordinal, of: input.attempts, reason: notScored, stoodAt: input.didNotEnd.attempt ?? null, ...(input.didNotEnd.started ? { started: input.didNotEnd.started } : {}) } : null;
  if (!input.recorded) {
    const single = input.attempts === 1 && records.length === 1 && !unended;
    await writeFile(path.join(input.evidence, "attempt.json"), JSON.stringify(single ? records[0] : { notScored, ...(unended ? { didNotEnd: unended } : {}), ...(input.series ? { series: input.series, continuations: input.series.continuations, deterministic: input.series.deterministic } : {}), attempts: records }, null, 2));
    const lines: string[] = input.series ? [renderAttemptSeries(input.series)] : [];
    lines.push(...records.map((record) => {
      const ending = `Attempt ${record.ordinal} ended ${record.attempt.status}${record.attempt.waitingFor ? ` for ${record.attempt.waitingFor}` : ""}`;
      return record.scored ? `${ending} and was scored ${record.scored.answer.verdict}.` : `${ending} and was not scored: ${notScored.message}`;
    }));
    if (unended) {
      const stood = unended.stoodAt;
      const began = "started" in unended ? unended.started : undefined;
      const refusal = began?.refusal ? `, then was refused at request ${began.refusal.ordinal} of kind ${began.refusal.kind}` : "";
      const what = stood ? `did not end (it stood at ${stood.status}, ${stood.liveSteps} live steps, ${stood.spend.calls} calls)` : began ? `started (the chat read the instruction in ${began.interpretationCalls} model call(s); the run logged ${began.loggedSteps} steps for it)${refusal}, and did not end` : "did not start";
      lines.push(`Attempt ${unended.ordinal} of ${unended.of} ${what}: ${notScored.message}`);
    }
    await writeFile(path.join(input.evidence, "attempt-report.txt"), `${lines.join("\n")}\n`);
  }
  const spentUsd = records.reduce((sum, { attempt }) => sum + attempt.spend.usd, 0) + (unended?.stoodAt?.spend.usd ?? 0);
  if (input.paid) await writePaidAttemptBundle({ ...input.paid, verdict: "failed", spentUsd });
  const unscored = records.filter((record) => !record.scored).length;
  return `${records.length} attempt(s) ended and were kept${unscored === 0 ? ", scored" : " unscored"}${unended ? `, attempt ${unended.ordinal} ${unended.stoodAt ? "did not end" : "started" in unended ? "started and did not end" : "did not start"}` : ""}${input.paid ? `, with $${spentUsd.toFixed(4)} spent in the ledger` : ""}`;
}

/** An attempt the driver scored keeps its verdict, rows and series row; one it did not is marked as not scored, and why. */
function scoreOf(scored: ScoredAttempt | undefined, notScored: unknown): { scored: { answer: AttemptOutcome["answer"]; row: AttemptReportRow; startedFrom: AttemptOutcome["startedFrom"]; askedAgain: NonNullable<AttemptOutcome["askedAgain"]> | null }; notScored?: undefined } | { notScored: unknown; scored?: undefined } {
  return scored ? { scored: { answer: scored.outcome.answer, row: scored.row, startedFrom: scored.outcome.startedFrom, askedAgain: scored.outcome.askedAgain ?? null } } : { notScored };
}

function categoryOf(error: unknown): { category?: string } {
  const category = error && typeof error === "object" ? (error as { category?: unknown }).category : undefined;
  return typeof category === "string" ? { category } : {};
}
