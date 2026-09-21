// What the Lab's repair lane (`--replays N`) did, from `snapshots/repair-lane.json`:
// whether the run's repair was applied, the declared repair's verdict when the
// lane judged one (a created Flow's), and what each replay with no model spent
// and whether it met the fixture's goal. Closed values and counts only.

const APPLICATION_OUTCOMES = new Set(["no_proposal", "applied", "not_applied"]);
const DECLARED_VERDICTS = new Set(["repaired", "wrong_target", "refused", "not_proposed", "not_attempted", "proposal_unreadable"]);

/**
 * The lane's record as a row states it, or `null` for a run that left none: it
 * asked for no replays, or never reached the lane.
 *
 * - `application`: Core's outcome, or `not_attempted` where the lane judged the
 *   declared repair wrong and applied nothing (`application: null` in the
 *   record), or `null` where the record says something else.
 * - `replaysPassed`: replays that ran, called no model, succeeded in Core and
 *   met the goal -- the one count that says the repaired Flow works without
 *   the model.
 * - `replayProviderCalls`: Core's provider calls over every replay, `null`
 *   when none ran or any count is unreadable.
 */
export function replaySummary(lane) {
  if (!lane || typeof lane !== "object") return null;
  const replays = Array.isArray(lane.replays) ? lane.replays.filter((replay) => replay && typeof replay === "object") : [];
  const counts = replays.map((replay) => replay.providerCalls);
  const outcome = lane.application?.outcome;
  return {
    application: lane.application === null ? "not_attempted" : APPLICATION_OUTCOMES.has(outcome) ? outcome : null,
    declaredRepair: DECLARED_VERDICTS.has(lane.declaredRepair?.verdict) ? lane.declaredRepair.verdict : null,
    replaysRequested: isCount(lane.replaysRequested) ? lane.replaysRequested : null,
    replaysRan: replays.filter((replay) => replay.outcome === "ran").length,
    replaysPassed: replays.filter((replay) => replay.outcome === "ran" && replay.modelCalled === false && replay.flowSucceeded === true && replay.goalPassed === true).length,
    replayProviderCalls: replays.length === 0 || !counts.every(isCount) ? null : counts.reduce((sum, calls) => sum + calls, 0),
  };
}

function isCount(value) {
  return Number.isSafeInteger(value) && value >= 0;
}
