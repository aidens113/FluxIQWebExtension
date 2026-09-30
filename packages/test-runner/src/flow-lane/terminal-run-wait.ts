// When a run Core is still writing counts as finished, and what happens when
// Core never finishes writing it.
//
// Core saves a run in stages. The status its steps earned is written first;
// the verdict on its result, and a failed run's recovery record, are written
// afterwards. A reader that takes the first save as the whole run reports a
// pass the verdict may be about to take away, so this waits. A reader that
// waits for everything, forever, throws away a complete product result over a
// note that never came -- which is what `RECOVERY_RECORD_WAIT_MS` explains.
//
// The reader is passed in rather than imported, because the run detail belongs
// to `persisted-flow-run.ts` and this is the rule about it, not another way of
// fetching it.
//
// How long the run's own detail is waited for is derived from the Flow rather
// than measured from one campaign, which is why Core's own per-node ceilings
// are imported here. A bound measured from single-node Flows is not a bound on
// a Flow of twenty nodes, and a wait that expires early does not report "still
// running": it reports the run's failure, which is a product verdict this
// facility never observed.

import { AUTOMATION_STUDIO_DEFAULT_NODE_RETRY_POLICY, AUTOMATION_STUDIO_READINESS_CAP_MS, automationStudioRetryBackoffMs } from "fluxiq/automation-studio";
import { RunnerFailure } from "../failure.js";
import { everyNodeRan, type NodeAttempt } from "./node-recovery.js";

/**
 * What a run costs beyond its nodes, and so the whole bound for a Flow of one.
 *
 * A timed-out synchronous Core run can keep executing after its HTTP client has
 * gone away. Under the final two-bench load, the first W02 Flow crossed the
 * request's 30-second bound in both campaigns and completed its runner cleanup
 * 42.9-46.5 seconds after Flow-lane dispatch. Ninety seconds is that
 * load-proven window, the same one recording finalization uses.
 *
 * It was the entire bound until t124, and every run it was measured on ran a
 * single extraction node. Read as a whole-run deadline it says a Flow of six to
 * twenty nodes must finish in the time one node took, which no multi-node Flow
 * can do; the run would then be read back as never terminal and reported with
 * the failure that stopped its *request*. So it is the fixed part now, and
 * `terminalDetailWaitMs` adds the rest.
 */
export const TERMINAL_DETAIL_BASE_WAIT_MS = 90_000;
export const TERMINAL_DETAIL_POLL_MS = 250;

/**
 * What one more node may add, taken from Core's own per-node ceilings rather
 * than from a measurement of Flows that had one node.
 *
 * Core awaits a node's recorded state before *each* attempt -- the wait is
 * named `<node>.attempt.<n>` inside the attempt loop (Core
 * `runtime/executor/graph-run.ts`) -- under the ceiling
 * `AUTOMATION_STUDIO_READINESS_CAP_MS`. Retries are on by default
 * (`AUTOMATION_STUDIO_DEFAULT_NODE_RETRY_POLICY`: three attempts), and the
 * ladder sleeps `automationStudioRetryBackoffMs` before each attempt after the
 * first. So the most one node can spend inside Core's own waits is every
 * attempt's readiness ceiling plus every retry's backoff: 3 x 30 s, plus
 * 250 ms and 1 s, which is 91.25 s.
 *
 * Every term is Core's published constant, applied by Core's own rule, so a
 * Core that changes its ceilings moves this bound with it instead of leaving a
 * number here that was true for one campaign.
 */
export const TERMINAL_DETAIL_NODE_WAIT_MS = AUTOMATION_STUDIO_READINESS_CAP_MS * AUTOMATION_STUDIO_DEFAULT_NODE_RETRY_POLICY.maxAttempts + retryBackoffTotalMs();

/**
 * How long a live LLM run is read back for after its request timed out: ten
 * minutes, the whole-run deadline this facility gives a run the model takes
 * part in. The poll ends as soon as the run settles; this bounds only a run
 * that never does. The number is what a diagnosing, exploring recovery was
 * measured to need.
 *
 * Why a live run needs more than the fixed 90 seconds a one-node run gets
 * (`TERMINAL_DETAIL_BASE_WAIT_MS`): the single request that runs it also waits
 * for its recovery and for the model to judge the result. On 2026-09-18 that
 * outlasted the 30-second request bound in four units, and because the run's
 * id arrived only in the reply, nothing could be read back and every one of
 * them failed as `environment.missing`.
 */
export const LIVE_LLM_RUN_WAIT_MS = 600_000;

/**
 * The ceiling on the derived bound: the live-run deadline above, already this
 * package's bound for a live run (`persisted-flow-run.ts`).
 *
 * It binds from seven nodes up, and it should. The per-node figure is the worst
 * case Core permits, not what a node costs -- a node that resolves its target
 * and runs takes seconds -- so uncapped it would let one stuck run hold a
 * scenario for half an hour and a nineteen-row campaign for nine, which is the
 * arithmetic `RECOVERY_RECORD_WAIT_MS` was cut for. Ten minutes is the longest
 * any run in this facility is allowed to be in flight, so a deterministic run
 * still unfinished after it is not a run that was merely taking long.
 */
export const TERMINAL_DETAIL_MAX_WAIT_MS = LIVE_LLM_RUN_WAIT_MS;

/**
 * How long a run of `actionNodeCount` action nodes is read back for: the fixed
 * cost of a run, plus Core's own per-node ceiling for every node after the
 * first, capped.
 *
 * The count is the Flow's action nodes, the same map `stopWithoutFailedAttempt`
 * counts over, so it is the Flow's own shape rather than a guess at it. A
 * caller that names none, or names something that is not a count, gets the
 * one-node bound, which is exactly what every caller got before.
 */
export function terminalDetailWaitMs(actionNodeCount?: number): number {
  const nodes = typeof actionNodeCount === "number" && Number.isSafeInteger(actionNodeCount) && actionNodeCount > 1 ? actionNodeCount : 1;
  return Math.min(TERMINAL_DETAIL_MAX_WAIT_MS, TERMINAL_DETAIL_BASE_WAIT_MS + (nodes - 1) * TERMINAL_DETAIL_NODE_WAIT_MS);
}

/** Every backoff Core's default policy sleeps across one node's retries, by Core's own rule for reading them. */
function retryBackoffTotalMs(): number {
  let total = 0;
  for (let attempt = 2; attempt <= AUTOMATION_STUDIO_DEFAULT_NODE_RETRY_POLICY.maxAttempts; attempt += 1) {
    total += automationStudioRetryBackoffMs(AUTOMATION_STUDIO_DEFAULT_NODE_RETRY_POLICY, attempt);
  }
  return total;
}

/**
 * How long the recovery record alone is waited for, measured from the moment
 * the run's own detail first read terminal.
 *
 * The recovery record is evidence *about* a run whose outcome is already
 * known: Core writes the failed status with the run's first save and the
 * record with the recovery's last, and nothing that judges a created Flow
 * reads it. So the two things a whole-run wait buys are different in kind, and
 * only one of them is worth the whole bound. Measured on
 * `run-mudslg9p-c59266aa`: a Flow was built, ran, failed, Core's repair made
 * its two calls, and no recovery record ever arrived; the run then spent ten
 * minutes waiting and was reported `performance.budget` -- a verdict about the
 * harness, for a run that had produced a complete product result. A campaign
 * of fifty-five rows cannot spend nine hours that way, and it must not lose
 * the result when it does.
 *
 * Five minutes is half of the live-run deadline and longer than
 * any recovery this facility has been observed to complete. It bounds the
 * wait; it never fails the run.
 */
export const RECOVERY_RECORD_WAIT_MS = 300_000;

/**
 * How long the recovery record is waited for when the run has no failed
 * attempt left for a recovery to work from.
 *
 * Core's recovery plans from the deterministic diagnosis of an attempt that
 * failed. With none, it takes the unclassified path and its whole plan is one
 * `stop` step, under its own refusal: *"No failed attempt reached the
 * diagnosis, so there is nothing to plan."*
 * (`runtime/recovery/plan.ts`, `unclassifiedPlan`). There is no exploration,
 * no patch and no provider call, so there is nothing in flight that a wait
 * could catch.
 *
 * Both runs of `ten-sites-r5` (2026-09-23) were exactly that run and both spent
 * the full five minutes on it. `run-mudw1ktb-0557816b`'s five attempts all
 * succeeded; `run-mudwci8d-de88aa32` met two faults and the ladder recovered
 * both, so no node was left failed either. Each waited 5 min 11 s of a run of
 * 7 to 8 minutes -- 622 s of the campaign's 959 s of run time -- for a record
 * that was never going to be written.
 *
 * It is a short grace rather than nothing, because the test is about what Core
 * *can* plan from and not about what Core has already written: if Core is a
 * poll away from saving a record this rule did not expect, the record is still
 * read. What it never does is spend five minutes finding that out.
 */
export const RECOVERY_RECORD_GRACE_MS = 5_000;

/**
 * The closed code for a live run Core was still finishing when the wait for
 * it ran out. It is the facility's finding -- the run never settled inside its
 * own deadline -- and never the run's failure, which Core had not finished
 * deciding.
 */
export const LIVE_RUN_UNSETTLED_CODE = "flow_lane.live_run_unsettled";

export type PersistedFlowTerminalWait = {
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  /**
   * How long the run's own detail is waited for. A caller passes
   * `terminalDetailWaitMs` over the Flow's action-node count, so the bound is
   * the Flow's; the default is the one-node bound
   * (`TERMINAL_DETAIL_BASE_WAIT_MS`).
   */
  timeoutMs?: number;
  intervalMs?: number;
  /**
   * Whether a `succeeded` run is only finished once Core has recorded the
   * verdict on its result. True for a live run: Core publishes the status
   * its steps earned first and judges the result afterwards, so a read in
   * between sees a pass the verdict may still overturn.
   */
  awaitVerdict?: boolean;
  /**
   * Whether a `failed` run is only finished once Core's recovery has recorded
   * how it ended. True for a live run whose intent recovers. Core writes the
   * failed status with the run's first save, before the recovery starts, and
   * the recovery's record -- `metadata.llmGate` and `metadata.recoveryTrace`,
   * which every way out of Core's recovery writes -- only with its last. The
   * recovery ladder's diagnosis placeholder is in the first save too, so an
   * intervention alone says nothing about whether the recovery finished.
   */
  awaitRecovery?: boolean;
  /**
   * How long the recovery record alone is waited for once the run itself has
   * read terminal (`RECOVERY_RECORD_WAIT_MS`). Its expiry never fails the run.
   */
  recoveryWaitMs?: number;
  /**
   * How long the recovery record is waited for when the run left no failed
   * attempt for a recovery to plan from (`RECOVERY_RECORD_GRACE_MS`).
   */
  recoveryGraceMs?: number;
};

/**
 * What Core may still owe a reader about a run it has already ended.
 *
 * `repair` is a wrong answer Core is still repairing: it saves the refuted run
 * as `failed` with `resultRepair.phase` `reauthoring` before its re-author
 * starts, re-runs the same run id, and writes `settled` only once the repaired
 * answer is judged (Core `recovery/refuted-result/repair.ts`).
 */
export type PendingWork = "verdict" | "recovery" | "repair";

/**
 * Why a recovery record never arrived, when Core said. Core marks a failed
 * run's recovery on its run detail (`metadata.recoveryState`): `running` before
 * it starts, `ended` with its last save, `threw` when it died. So the reader
 * can name the absence instead of waiting it out:
 *
 * - `recovery.threw` -- Core's recovery threw; no record will ever come.
 * - `recovery.ended_without_record` -- it ended and wrote no record.
 * - `recovery.still_running` -- Core still said `running` when the wait, bounded
 *   by the live-run deadline, ran out.
 *
 * A Core that writes no marker (older, or a re-run's re-projection overwrote
 * it) gets no code, and the wait follows the rule it always did.
 */
export type RecoveryStateCode = "recovery.threw" | "recovery.ended_without_record" | "recovery.still_running";

/**
 * As much of a run detail as this rule reads. `actions` is narrowed to the two
 * members `recoveryCouldBeRunning` reads -- Core's status word and the node the
 * attempt ran -- and to nothing else: this module still knows nothing about
 * what an attempt is, only whether one was left failed.
 */
export type TerminalRunCandidate = {
  summaryStatus: string | undefined;
  actions: readonly NodeAttempt[];
  resultVerification: unknown;
  runDetail: Readonly<Record<string, unknown>>;
};

/**
 * Reads the run back until Core has written everything the wait asks for, and
 * says what it settled on.
 *
 * Three endings, and the difference between the last two is the whole point.
 *
 * - **Everything arrived.** The detail is returned with nothing unsettled.
 * - **The verdict never arrived**, so the run still fails here. A `succeeded`
 *   run read before Core has judged its result reports a pass the verdict may
 *   be about to take away, and a measurement that can report a false pass is
 *   worse than one that reports nothing.
 * - **The recovery record never arrived.** The run is returned as it stands,
 *   marked `unsettled: "recovery"`. The run is terminal, its attempts and its
 *   datasets are complete, and nothing that judges a created Flow reads the
 *   recovery record; failing the run over a missing note about it threw away a
 *   whole product result. The absence is reported rather than swallowed, so a
 *   reader can tell "Core recovered nothing" from "Core never said". When
 *   Core marked its recovery, the wait follows the marker and names the
 *   absence (`RecoveryStateCode`).
 *
 * A run that never read terminal at all is the original failure, unchanged: no
 * evidence arrived, so there is nothing to report but what stopped it.
 */
export async function awaitTerminalRunDetail<T extends TerminalRunCandidate>(
  read: (timeoutMs: number) => Promise<T>,
  originalFailure: unknown,
  wait: PersistedFlowTerminalWait,
): Promise<{ detail: T; unsettled?: PendingWork; recoveryState?: RecoveryStateCode }> {
  const now = wait.now ?? Date.now;
  const sleep = wait.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const intervalMs = wait.intervalMs ?? TERMINAL_DETAIL_POLL_MS;
  const recoveryWaitMs = wait.recoveryWaitMs ?? RECOVERY_RECORD_WAIT_MS;
  const recoveryGraceMs = wait.recoveryGraceMs ?? RECOVERY_RECORD_GRACE_MS;
  const started = now();
  // The whole bound, kept apart from `deadline` because a recovery's shorter
  // bound may cut it and a repair that then turns up in flight restores it.
  const fullDeadline = started + (wait.timeoutMs ?? TERMINAL_DETAIL_BASE_WAIT_MS);
  let deadline = fullDeadline;
  // What Core was still doing at the last terminal read, if anything: the
  // difference between a run that never finished and one Core was finishing.
  let pending: PendingWork | undefined;
  // The last terminal read, kept so a run Core finished but never annotated is
  // still the run that happened.
  let terminal: T | undefined;
  // When the run first read terminal, and Core's marker on its recovery at the
  // last read that carried one.
  let firstTerminalAt = 0;
  let recoveryMarker: "running" | undefined;
  while (now() < deadline) {
    try {
      const detail = await read(Math.min(30_000, deadline - now()));
      if (terminalRunStatus(detail.summaryStatus) && detail.actions.length > 0) {
        pending = pendingWork(detail, wait);
        if (!pending) return { detail };
        // From the first terminal read the run itself is complete and only
        // Core's own note is outstanding, so the recovery record takes its
        // own, shorter bound -- shorter again when the run left no failed
        // attempt for a recovery to plan from, since then there is nothing in
        // flight to wait for.
        if (terminal === undefined) firstTerminalAt = now();
        const marker = pending === "recovery" ? coreRecoveryState(detail.runDetail) : undefined;
        // Core said its recovery is over and wrote no record: none is coming.
        if (marker === "threw" || marker === "ended") {
          return { detail, unsettled: "recovery", recoveryState: marker === "threw" ? "recovery.threw" : "recovery.ended_without_record" };
        }
        // Core says it is still working: the live-run deadline, not a fixed guess, bounds it.
        if (marker === "running") {
          recoveryMarker = marker;
          deadline = Math.max(deadline, firstTerminalAt + TERMINAL_DETAIL_MAX_WAIT_MS);
        } else if (pending === "recovery" && terminal === undefined) {
          deadline = Math.min(deadline, now() + (recoveryCouldBeRunning(detail) ? recoveryWaitMs : recoveryGraceMs));
        }
        // A repair in flight is the run still running, however its nodes
        // ended: it keeps the run's whole bound, the live-run deadline.
        if (pending === "repair") deadline = fullDeadline;
        terminal = detail;
      }
    } catch { /* best-effort: the original timeout or abort stays authoritative until exact terminal evidence arrives, so a diagnostic read that fails must never replace what stopped the run */ }
    const delay = Math.min(intervalMs, Math.max(0, deadline - now()));
    if (delay > 0) await sleep(delay);
  }
  if (pending === "repair" && terminal) return { detail: terminal, unsettled: "repair" };
  if (pending === "recovery" && terminal) return { detail: terminal, unsettled: "recovery", ...(recoveryMarker ? { recoveryState: "recovery.still_running" as const } : {}) };
  if (pending) {
    throw new RunnerFailure("performance.budget", `Core was still finishing the live run's ${pending} when the wait for it ran out`, { details: { code: LIVE_RUN_UNSETTLED_CODE, pending, waitedMs: now() - started } });
  }
  throw originalFailure;
}

export function terminalRunStatus(status: string | undefined): boolean {
  return status === "succeeded" || status === "failed" || status === "cancelled";
}

/**
 * What Core still has to write about a terminal run, or `undefined` when it
 * has written everything the wait asked for.
 *
 * The verdict: Core writes a finished run's status as its steps earned it,
 * then judges the result and may rewrite a `succeeded` to `failed`; the
 * verdict and the final status are saved together (Core
 * `result-verification/run-outcome.ts`). So a `succeeded` run with no verdict
 * recorded yet is not finished, and one read at that moment would report a
 * pass the verdict was about to take away. A run that failed is never judged.
 *
 * The recovery: a `failed` run is saved as soon as its steps fail, and Core's
 * recovery then diagnoses, explores and repairs it before writing its record.
 * Until that record is in, the run is not finished either (`awaitRecovery`).
 */
export function pendingWork(
  detail: TerminalRunCandidate,
  wait: Pick<PersistedFlowTerminalWait, "awaitVerdict" | "awaitRecovery">,
): PendingWork | undefined {
  // First, because a repair in flight carries the first pass's recovery record
  // and verdict already: either rule alone would call it finished.
  if ((wait.awaitVerdict || wait.awaitRecovery) && resultRepairInFlight(detail.runDetail)) return "repair";
  if (wait.awaitVerdict && detail.summaryStatus === "succeeded" && detail.resultVerification === null) return "verdict";
  if (wait.awaitRecovery && detail.summaryStatus === "failed" && !recoveryRecordWritten(detail.runDetail) && !repairedRerunFinished(detail.runDetail)) return "recovery";
  return undefined;
}

/**
 * Whether a recovery could still be running for this run: some node it
 * attempted ended on an attempt that did not succeed.
 *
 * Core's recovery is planned from the deterministic diagnosis of a *failed
 * attempt*. A run whose every node ended on a successful attempt hands it
 * none, whether because nothing failed or because the ladder recovered
 * everything that did, and Core's own refusal for that case says so: "No
 * failed attempt reached the diagnosis, so there is nothing to plan."
 *
 * It is deliberately the run's attempts and not its interventions. The ladder's
 * diagnosis placeholder is written with the run's first save, so an
 * intervention says nothing about whether a recovery is running -- which is
 * exactly why the wait could not tell the two apart before.
 *
 * **A node that ran and was then judged wrong is a node that ran.** Core marks
 * a refuted result as a failure on the last record-storing attempt, so this
 * read `failed` for a Flow whose every node executed as authored, and took the
 * five-minute wait for a recovery Core had already declined to plan. On
 * `run-muher0en-508ddb69` that cost 568 s of a 949 s run -- against 192 s of
 * exploration and 12.6 s of actual Flow actions -- for a record that was never
 * going to be written. `everyNodeRan` is what tells the two apart.
 */
function recoveryCouldBeRunning(detail: TerminalRunCandidate): boolean {
  return !everyNodeRan(detail.actions);
}

/** Whether Core is still repairing this run's wrong answer: re-authoring its Flow, or re-running it. */
function resultRepairInFlight(runDetail: Readonly<Record<string, unknown>>): boolean {
  const phase = plainRecord(plainRecord(runDetail.metadata)?.resultRepair)?.phase;
  return phase === "reauthoring" || phase === "rerunning";
}

/**
 * Whether this failure is the finished re-run of a repaired Flow
 * (`metadata.repairedRerun.status` terminal, Core
 * `runtime-adaptation/repair-rerun.ts`).
 *
 * No recovery follows it: a repaired run is not repaired again, so Core writes
 * no recovery record for it. Read as a recovery still to come, the re-run's
 * failure on `run-munw7ffn-fe1cecd2` held the Lab for 306 s waiting for one.
 */
function repairedRerunFinished(runDetail: Readonly<Record<string, unknown>>): boolean {
  return terminalRunStatus(stringOrUndefined(plainRecord(plainRecord(runDetail.metadata)?.repairedRerun)?.status));
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

/** Whether Core's recovery wrote its record: the gate that decided it, or the trace of its stages. */
function recoveryRecordWritten(runDetail: Readonly<Record<string, unknown>>): boolean {
  const metadata = plainRecord(runDetail.metadata);
  return plainRecord(metadata?.llmGate) !== undefined || plainRecord(metadata?.recoveryTrace) !== undefined;
}

/** Core's marker on a failed run's recovery (`metadata.recoveryState.state`), when it wrote a known one. */
function coreRecoveryState(runDetail: Readonly<Record<string, unknown>>): "running" | "ended" | "threw" | undefined {
  const state = plainRecord(plainRecord(runDetail.metadata)?.recoveryState)?.state;
  return state === "running" || state === "ended" || state === "threw" ? state : undefined;
}

function plainRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}
