// Tells a run that presses a failed step again from a run whose Flow is being
// repaired. Core reports both in its `repairing` phase: its recovery ladder
// ("Recovering from a failed step", then a choice such as "Trying the step
// again", Core's `activity/wording/recovery-choice.ts`) and its repair of the
// step ("Working out what went wrong", "Deciding how to repair the step").
// Only the second changes the Flow, so only the second heads the status
// "Fixing your Flow"; a retry keeps "Running your Flow" and says why it tries
// again ("The page was busy, trying again": D12 of the t174 UI review of
// run-musp8nz1-dbd3905a, where the overlay said "Fixing your Flow" while the
// chat rightly said "Trying the step again"). Every `repairing` event of a
// build is a repair.
//
// Every event of the unit passes through `observe`, the model's thoughts
// included: a recovery choice is a thought row, and it is what keeps a retry
// a retry (`pacer.ts`).

import { activityActionOf } from "fluxiq/ui";
import type { ActivityDisplay, ClientGatewayActivity } from "../../shared/activity/index";

/** Core's sentence for a run step that failed, before its recovery ladder runs (Core's `activity/step/recovering.ts`). */
const RECOVERING = /^Recovering from a failed step\b/u;

/**
 * Core's recovery-ladder choices that press the step again, and those that
 * end the ladder without pressing it. None of them changes the Flow.
 */
const RETRY_CHOICES: ReadonlySet<string> = new Set(["Trying the step again", "Waiting for the page to catch up", "Clearing what was in the way"]);
const LADDER_ENDS: ReadonlySet<string> = new Set(["Moving on: the step's result is already there", "The quick fixes didn't help"]);

/** A retry whose failure names no reason. */
const RETRY_UNEXPLAINED = "That step didn't work, trying again";

/** What a run's recovery makes of one event. */
export type RetryState = {
  /** The status line in place of the event's own words, while a run presses a failed step again. */
  readonly line: string | null;
  /** The retry line this very event ended, so a display still showing it can let it go. */
  readonly ended: string | null;
  /** Core is repairing the Flow, not only pressing a step again. */
  readonly repairing: boolean;
};

export class RunRetry {
  private activityId: string | undefined;
  private line: string | null = null;
  private repairing = false;

  /** Folds `event`, of a unit of `kind`, in and answers what the run's recovery makes of it. */
  observe(event: ClientGatewayActivity, kind: ActivityDisplay["subjectKind"]): RetryState {
    if (event.activityId !== this.activityId) {
      this.activityId = event.activityId;
      this.line = null;
      this.repairing = false;
    }
    if (kind === "build") return { line: null, ended: null, repairing: true };
    const before = this.line;
    const line = this.fold(event);
    return { line, ended: before !== null && this.line === null ? before : null, repairing: this.repairing };
  }

  private fold(event: ClientGatewayActivity): string | null {
    if (event.phase !== "repairing") {
      // The run reported its next step: the retry, or the repair, is over.
      if (event.phase === "running" && event.step !== undefined) {
        this.line = null;
        this.repairing = false;
      }
      return null;
    }
    if (RECOVERING.test(event.label)) {
      // Why the step failed, as its card says it ("the page was busy").
      const why = event.detail ? activityActionOf(event)?.why : null;
      this.line = why ? `${capitalised(why)}, trying again` : RETRY_UNEXPLAINED;
      return this.line;
    }
    const title = event.detail?.kind === "thought" ? event.detail.title : event.label;
    if (RETRY_CHOICES.has(title)) return this.line ?? title;
    this.line = null;
    if (!LADDER_ENDS.has(title)) this.repairing = true;
    return null;
  }
}

function capitalised(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
