import type { AttemptContinuation, AttemptSeries } from "@fluxiq-web-extension/test-contracts";
import { assertRealisticScenarios } from "../realistic-scenarios/index.js";
import type { AttemptDriver, AttemptOutcome, AttemptTask } from "./driver.js";
import { seriesOfOutcomes } from "./series-of-outcomes.js";

export type AttemptSeriesResult = Readonly<{
  series: AttemptSeries;
  outcomes: readonly AttemptOutcome[];
  continuations: readonly AttemptContinuation[];
  /** Why the attempts stopped short of those asked for; absent when they all ran. */
  stoppedShort?: string;
}>;

/**
 * A task run `attempts` times on **one workspace**, which is the difference from a
 * repeat: what an attempt saved stays where the next can find it.
 *
 * `between` says what happens to the site between attempts. `reseed` puts it back, so each
 * attempt is judged from the seed, which proves the workspace and nothing about acts.
 * `as_left` leaves it as the last attempt left it, as a person's site is: the case where a
 * repeat could press what the first already pressed, which each later attempt's change is
 * judged against. `mayGoOn` may stop the series short, with its reason. `beforeLater` runs once
 * before each later attempt, after `mayGoOn` let it go on: where a run restarts Core between them.
 */
export async function runAttemptSeries(input: { task: AttemptTask; driver: AttemptDriver; attempts: number; between: "reseed" | "as_left"; mayGoOn?: (outcome: AttemptOutcome) => Promise<string | undefined>; beforeLater?: (ordinal: number) => Promise<void> }): Promise<AttemptSeriesResult> {
  const { task, driver } = input;
  assertRealisticScenarios([task.scenario.id], "The same-workspace attempt lane");
  const outcomes: AttemptOutcome[] = [];
  let stoppedShort: string | undefined;
  for (let ordinal = 1; ordinal <= input.attempts && stoppedShort === undefined; ordinal += 1) {
    if (ordinal > 1) await input.beforeLater?.(ordinal);
    if (ordinal === 1 || input.between === "reseed") await driver.seedSite();
    const outcome = await driver.run(task, ordinal);
    outcomes.push(outcome);
    if (ordinal < input.attempts) stoppedShort = await input.mayGoOn?.(outcome);
  }
  const { series, continuations } = seriesOfOutcomes(task, outcomes, input.attempts);
  return Object.freeze({ series, outcomes, continuations, ...(stoppedShort === undefined ? {} : { stoppedShort }) });
}
