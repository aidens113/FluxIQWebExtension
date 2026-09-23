// What one adversarial condition's run measured: which recovery absorbed the
// fault, what it cost in attempts, and how many provider calls it took.
//
// The number this lane exists to produce is the last one. A condition the
// runtime absorbs must cost zero provider calls, and a run that spends one has
// failed even if it ends green -- because a Flow that needs the model on every
// replay is not an automation, it is a conversation with a bill.

import { rungAttribution } from "../live-campaign/row/index.mjs";

/**
 * One row of the measurement table.
 *
 * `absorbedBy` is what the run's own attribution says resolved a node, and
 * `agreed` is whether that includes what the fixture declared. The Flow lane
 * asserts the declaration itself, so a disagreement has already failed the
 * run; this repeats it because a table whose rows can only be read by knowing
 * the exit code of a child process is not a measurement anybody will read.
 */
export function measureCondition(condition, attempt, bundle) {
  const { evaluation, liveLlm, flowLane } = bundle;
  const attribution = rungAttribution(flowLane);
  const resolvedBy = attribution?.resolvedBy ?? [];
  const declared = condition.declared.absorbedBy;
  return {
    id: condition.id,
    declaredAbsorbedBy: declared,
    because: condition.declared.because,
    absorbedBy: resolvedBy,
    rungsRun: attribution?.rungsRun ?? [],
    agreed: declared === "none" ? resolvedBy.length === 0 : resolvedBy.includes(declared),
    maxAttemptsPerNode: attribution?.maxAttemptsPerNode ?? null,
    declaredMaxAttemptsPerNode: condition.declared.maxAttemptsPerNode ?? null,
    // With no grant issued, Core cannot reach a provider, so this is a
    // structural zero rather than an observed one -- and a non-zero here would
    // mean something reached a model the run never authorized, which is worth
    // failing on loudly.
    providerCalls: liveLlm?.observed?.calls ?? evaluation?.llm?.calls ?? 0,
    harnessActivations: flowLane?.harnessActivations ?? null,
    runStatus: flowLane?.status ?? null,
    failureCode: flowLane?.failure?.code ?? null,
    verdict: evaluation?.verdict ?? null,
    exitCode: attempt.code,
    runId: evaluation?.runId ?? null,
    durationMs: typeof evaluation?.durationMs === "number" ? evaluation.durationMs : null,
  };
}

/** Whether one measured condition is a pass: the declared rung answered, at no more than the declared cost, for nothing. */
export function conditionHeld(row) {
  if (!row.agreed) return false;
  if (row.providerCalls !== 0 || (row.harnessActivations !== null && row.harnessActivations !== 0)) return false;
  if (row.declaredMaxAttemptsPerNode !== null && row.maxAttemptsPerNode !== null && row.maxAttemptsPerNode > row.declaredMaxAttemptsPerNode) return false;
  // The run's own verdict, which already carries the declared failure and the
  // declared final state. A condition nothing absorbs still has to fail in the
  // way its fixture said it would.
  return row.verdict === "passed";
}

/** The table as a person reads it, one line per condition, widest column first. */
export function measurementTable(rows) {
  const header = ["condition", "declared", "absorbed by", "attempts", "calls", "verdict"];
  const body = rows.map((row) => [
    row.id,
    row.declaredAbsorbedBy,
    row.absorbedBy.length ? row.absorbedBy.join("+") : "none",
    row.maxAttemptsPerNode === null ? "-" : String(row.maxAttemptsPerNode),
    String(row.providerCalls),
    `${row.verdict ?? "no-result"}${conditionHeld(row) ? "" : "  <- DISAGREED"}`,
  ]);
  const widths = header.map((_, column) => Math.max(header[column].length, ...body.map((line) => line[column].length)));
  const line = (cells) => cells.map((cell, column) => cell.padEnd(widths[column])).join("  ").trimEnd();
  return [line(header), line(widths.map((width) => "-".repeat(width))), ...body.map(line)].join("\n");
}
