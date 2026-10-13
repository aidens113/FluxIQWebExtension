// The words the run's evidence event gives the repair lane's publish.
//
// It said "The live repair was applied and replayed" for every record,
// including a `no_proposal` run that applied and replayed nothing, which is
// how an absorbed drift read as a gate pass (run-mv6v2g3l-a865ead7). The
// summary now says what happened and whether the run counts toward the
// adaptation gate, from the `adaptationGate` the lane publishes (t512).

/** The event summary for one repair-lane publish. */
export function repairLaneSummary(details: Readonly<Record<string, unknown>>): string {
  const gate = details.adaptationGate as { counted?: unknown; reason?: unknown } | undefined;
  const happened = details.laneFailure
    ? "The created Flow's judgement failed, so the repair lane recorded its run and applied nothing"
    : details.application === "applied"
      ? "The live repair was applied and replayed"
      : "The repair lane ran and applied nothing";
  if (!gate || typeof gate.counted !== "boolean") return happened;
  return gate.counted
    ? `${happened}; the run counts toward the adaptation gate`
    : `${happened}; the run does not count toward the adaptation gate (${String(gate.reason)})`;
}
