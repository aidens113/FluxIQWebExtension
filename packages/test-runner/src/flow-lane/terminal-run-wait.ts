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

import { RunnerFailure } from "../failure.js";
import { everyNodeEndedSucceeded, type NodeAttempt } from "./node-recovery.js";

/**
 * A timed-out synchronous Core run can keep executing after its HTTP client has
 * gone away. Under the final two-bench load, the first W02 Flow crossed the
 * request's 30-second bound in both campaigns and completed its runner cleanup
 * 42.9-46.5 seconds after Flow-lane dispatch. Give that exact run the same
 * load-proven 90-second window used for recording finalization to publish a
 * terminal detail with durable attempts.
 */
export const TERMINAL_DETAIL_WAIT_MS = 90_000;
export const TERMINAL_DETAIL_POLL_MS = 250;

/**
 * How long the recovery record alone is waited for, measured from the moment
 * the run's own detail first read terminal.
 *
 * The recovery record is evidence *about* a run whose outcome is already
 * known: Core writes the failed status with the run's first save and the
 * record with the recovery's last, and nothing that judges a created Flow
 * reads it. So the two things a whole-run wait buys are different in kind, and
 * only one of them is worth the whole lease. Measured on
 * `run-mudslg9p-c59266aa`: a Flow was built, ran, failed, Core's repair made
 * its two calls, and no recovery record ever arrived; the run then spent ten
 * minutes waiting and was reported `performance.budget` -- a verdict about the
 * harness, for a run that had produced a complete product result. A campaign
 * of fifty-five rows cannot spend nine hours that way, and it must not lose
 * the result when it does.
 *
 * Five minutes is half of Core's own lease on a claimed grant and longer than
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
 * The closed code for a granted run Core was still finishing when the wait for
 * it ran out. It is the facility's finding -- the run never settled inside its
 * own deadline -- and never the run's failure, which Core had not finished
 * deciding.
 */
export const GRANTED_RUN_UNSETTLED_CODE = "flow_lane.granted_run_unsettled";

export type PersistedFlowTerminalWait = {
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  timeoutMs?: number;
  intervalMs?: number;
  /**
   * Whether a `succeeded` run is only finished once Core has recorded the
   * verdict on its result. True for a granted run: Core publishes the status
   * its steps earned first and judges the result afterwards, so a read in
   * between sees a pass the verdict may still overturn.
   */
  awaitVerdict?: boolean;
  /**
   * Whether a `failed` run is only finished once Core's recovery has recorded
   * how it ended. True for a granted run whose grant recovers. Core writes the
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

/** What Core may still owe a reader about a run it has already ended. */
export type PendingWork = "verdict" | "recovery";

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
 *   reader can tell "Core recovered nothing" from "Core never said".
 *
 * A run that never read terminal at all is the original failure, unchanged: no
 * evidence arrived, so there is nothing to report but what stopped it.
 */
export async function awaitTerminalRunDetail<T extends TerminalRunCandidate>(
  read: (timeoutMs: number) => Promise<T>,
  originalFailure: unknown,
  wait: PersistedFlowTerminalWait,
): Promise<{ detail: T; unsettled?: PendingWork }> {
  const now = wait.now ?? Date.now;
  const sleep = wait.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const intervalMs = wait.intervalMs ?? TERMINAL_DETAIL_POLL_MS;
  const recoveryWaitMs = wait.recoveryWaitMs ?? RECOVERY_RECORD_WAIT_MS;
  const recoveryGraceMs = wait.recoveryGraceMs ?? RECOVERY_RECORD_GRACE_MS;
  const started = now();
  let deadline = started + (wait.timeoutMs ?? TERMINAL_DETAIL_WAIT_MS);
  // What Core was still doing at the last terminal read, if anything: the
  // difference between a run that never finished and one Core was finishing.
  let pending: PendingWork | undefined;
  // The last terminal read, kept so a run Core finished but never annotated is
  // still the run that happened.
  let terminal: T | undefined;
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
        if (pending === "recovery" && terminal === undefined) {
          deadline = Math.min(deadline, now() + (recoveryCouldBeRunning(detail) ? recoveryWaitMs : recoveryGraceMs));
        }
        terminal = detail;
      }
    } catch { /* best-effort: the original timeout or abort stays authoritative until exact terminal evidence arrives, so a diagnostic read that fails must never replace what stopped the run */ }
    const delay = Math.min(intervalMs, Math.max(0, deadline - now()));
    if (delay > 0) await sleep(delay);
  }
  if (pending === "recovery" && terminal) return { detail: terminal, unsettled: "recovery" };
  if (pending) {
    throw new RunnerFailure("performance.budget", `Core was still finishing the granted run's ${pending} when the wait for it ran out`, { details: { code: GRANTED_RUN_UNSETTLED_CODE, pending, waitedMs: now() - started } });
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
  if (wait.awaitVerdict && detail.summaryStatus === "succeeded" && detail.resultVerification === null) return "verdict";
  if (wait.awaitRecovery && detail.summaryStatus === "failed" && !recoveryRecordWritten(detail.runDetail)) return "recovery";
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
 */
function recoveryCouldBeRunning(detail: TerminalRunCandidate): boolean {
  return !everyNodeEndedSucceeded(detail.actions);
}

/** Whether Core's recovery wrote its record: the gate that decided it, or the trace of its stages. */
function recoveryRecordWritten(runDetail: Readonly<Record<string, unknown>>): boolean {
  const metadata = plainRecord(runDetail.metadata);
  return plainRecord(metadata?.llmGate) !== undefined || plainRecord(metadata?.recoveryTrace) !== undefined;
}

function plainRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}
