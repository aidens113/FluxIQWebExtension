// Whether a `--replays` run counts toward the adaptation gate.
//
// The gate (adaptation plan, "Gate oracle", P1-P7) counts a run only when its
// drift forced a repair and the repair was proven: the recovery engaged (P2),
// the repair was applied and moved the saved Flow's steps (P4), and the in-run
// replays ran with a known 0 provider calls and held (P5). "A run whose drift
// was absorbed with no repair does not count toward the gate." Until this
// existed, that rule was applied by a person reading the bundle: a run whose
// multi-signal fingerprint found the moved control recorded `no_proposal`,
// passed, and read as a gate pass (run-mv6v2g3l-a865ead7). So the repair
// lane states the classification on every record it writes, with a closed
// reason, and no gate run passes quietly.
//
// P1 (the build's judged whole run), P3's conduct half, P6 (a later session)
// and P7 (cost, headed browser, UI review, a debug) are not this record's to
// judge; a counted run still needs them checked. The input is structural so
// this module depends on nothing in the lane that writes it.

/** The closed reasons, `counted` first. Each names the first gate criterion the run did not meet. */
export const ADAPTATION_GATE_REASONS = [
  "counted",
  "oracle_failed",
  "reauthor_not_kept",
  "no_recovery_attempted",
  "no_proposal",
  "not_applied",
  "steps_unchanged",
  "no_replay",
  "replay_not_model_free",
  "replay_failed",
] as const;

export type AdaptationGateReason = (typeof ADAPTATION_GATE_REASONS)[number];

export type AdaptationGateClassification = Readonly<{ counted: boolean; reason: AdaptationGateReason }>;

/** What the repair lane knows of the run, by shape alone. */
export type AdaptationGateInput = Readonly<{
  /** The created Flow's own judgement failed (its oracle, or a judgement before it). */
  laneFailed: boolean;
  /** The run's recovery record: whether it engaged, and whether Core applied a re-author inside the run. */
  recovery: Readonly<{ attempted: boolean; resultReauthor?: Readonly<{ applied?: boolean | null }> | null }>;
  /** A re-author the run made and did not keep. */
  unkeptReauthor: boolean;
  /** The application outcome and what it did to the Flow's steps; `null` when nothing was applied by rule. */
  application: Readonly<{ outcome: string; flow?: Readonly<{ change: string }> }> | null;
  replays: readonly Readonly<{
    outcome: string;
    providerCalls: number | null;
    harnessActivations: number;
    modelCalled: boolean;
    goalPassed: boolean;
    flowSucceeded: boolean;
    datasetsReproduced: boolean | null;
  }>[];
}>;

/** The Flow changes that show the repair moved the saved steps (apply-repair `REPAIR_FLOW_CHANGES`). */
const STEPS_MOVED = new Set(["changed", "changed_in_run"]);

/** Classifies one `--replays` run; the first unmet criterion is the reason. */
export function classifyAdaptationGate(input: AdaptationGateInput): AdaptationGateClassification {
  const notCounted = (reason: AdaptationGateReason): AdaptationGateClassification => ({ counted: false, reason });
  if (input.laneFailed) return notCounted("oracle_failed");
  if (input.unkeptReauthor) return notCounted("reauthor_not_kept");
  // A re-author Core applied inside the run is recovery too, though it is not the patch ladder's `attempted`.
  const attempted = input.recovery.attempted || input.recovery.resultReauthor?.applied === true;
  const application = input.application;
  // Nothing proposed: with no recovery the drift was absorbed or never met; with one, the recovery declined.
  if (!application || application.outcome === "no_proposal") return notCounted(attempted ? "no_proposal" : "no_recovery_attempted");
  if (application.outcome !== "applied") return notCounted("not_applied");
  if (!application.flow || !STEPS_MOVED.has(application.flow.change)) return notCounted("steps_unchanged");
  if (!attempted) return notCounted("no_recovery_attempted");
  if (input.replays.length === 0) return notCounted("no_replay");
  if (input.replays.some((replay) => replay.outcome !== "ran" || replay.providerCalls !== 0 || replay.harnessActivations !== 0 || replay.modelCalled)) return notCounted("replay_not_model_free");
  if (input.replays.some((replay) => !replay.goalPassed || !replay.flowSucceeded || replay.datasetsReproduced === false)) return notCounted("replay_failed");
  return { counted: true, reason: "counted" };
}
