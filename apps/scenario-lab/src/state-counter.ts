/** Internal numeric guard; the actual state owner alone publishes counters. */
export function advanceScenarioCounter(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0 || value >= Number.MAX_SAFE_INTEGER) throw new Error("fixture.counter_exhausted");
  return value + 1;
}
