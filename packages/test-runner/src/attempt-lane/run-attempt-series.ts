import type { AttemptContinuation, AttemptSeries } from "@fluxiq-web-extension/test-contracts";
import { assertRealisticScenarios } from "../realistic-scenarios/index.js";
import type { AttemptDriver, AttemptOutcome, AttemptTask } from "./driver.js";
import { proveContinuation } from "./continuation.js";
import { attemptReportRow, attemptSeries } from "./report.js";

export type AttemptSeriesResult = Readonly<{ series: AttemptSeries; outcomes: readonly AttemptOutcome[]; continuations: readonly AttemptContinuation[] }>;

/**
 * A task run `attempts` times on **one workspace**, which is the difference from a
 * repeat: what an attempt saved stays where the next can find it. Only the site is
 * reseeded between attempts, because final-state oracles are absolute and a lasting
 * act's second landing would otherwise read as wrong rows; each attempt's change is
 * judged from that recorded baseline.
 */
export async function runAttemptSeries(input: { task: AttemptTask; driver: AttemptDriver; attempts: number }): Promise<AttemptSeriesResult> {
  const { task, driver } = input;
  assertRealisticScenarios([task.scenario.id], "The same-workspace attempt lane");
  const outcomes: AttemptOutcome[] = [];
  for (let ordinal = 1; ordinal <= input.attempts; ordinal += 1) {
    await driver.seedSite();
    outcomes.push(await driver.run(task, ordinal));
  }
  const continuations = outcomes.slice(1).map((later, index) => proveContinuation(outcomes[index]!, later));
  const series = attemptSeries(task, outcomes.map((outcome) => attemptReportRow(task, outcome)), continuations[0] ?? null);
  return Object.freeze({ series, outcomes, continuations });
}
