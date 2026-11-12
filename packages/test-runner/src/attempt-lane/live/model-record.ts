/**
 * Which model a `lab attempt` ran on, as `attempt.json`, the report's header and the spend ledger name it: the provider and
 * the exact model id. A scripted run reaches no provider, so it records `provider: "scripted"` and no model (the id its Core
 * is configured with is a stand-in for the script, not a model that answered).
 */
export type AttemptModelRecord = Readonly<{ provider: string; model?: string }>;

/** The record of a run's model side: the live plan's own provider and model, else the scripted stand-in. */
export function attemptModelRecord(live: { describe(): { provider: string; model: string } } | undefined): AttemptModelRecord {
  if (live === undefined) return { provider: "scripted" };
  const { provider, model } = live.describe();
  return { provider, model };
}
