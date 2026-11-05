import type { AttemptOutcome } from "../driver.js";

/**
 * Whether a second attempt means anything after this one, or why it does not. A right answer
 * and a budget that ran out both leave something to go on from: the second is held to what
 * is left. A wrong answer leaves a site in no known state, so nothing can be said of what the
 * second changes, and money would be spent to learn nothing. A wait for a person with none
 * coming has not ended at all.
 */
export function attemptCanGoOn(outcome: AttemptOutcome, balanceGone: boolean): string | undefined {
  if (balanceGone) return "the model service's balance ran out, and no paid work goes on past that";
  if (outcome.record.status === "waiting_for_person") return "the first attempt is still waiting for a person, with none coming";
  if (outcome.answer.verdict === "wrong") return "the first attempt's answer was wrong, so the site is in no known state to judge a second against";
  if (outcome.answer.verdict === "stopped_by_person") return "a person stopped the first attempt";
  return undefined;
}
