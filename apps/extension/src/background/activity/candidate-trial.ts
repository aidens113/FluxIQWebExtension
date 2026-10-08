// Tells a candidate build's trial apart from the rest of the build, so the
// status names it as a test of the Flow, never as a repair.
//
// A candidate creation build tests each Flow it submits by running it once,
// from its start, with no model and no repair (Core's
// `runtime/service/candidate-trial/run.ts`). That run reports its steps under
// the build's own unit of work, and a step that fails in it reports Core's
// "Recovering from a failed step" row in the `repairing` phase, as any run's
// failed step does. Read as the build's own events, that row headed the
// status "Fixing your Flow" with the trial's "Step 2 of 8", and the heading
// stayed after the trial ended (lane A round 4, `run-muyrpbnk-fef374e7`, the
// trial of revision 2): nothing was being fixed.
//
// What Core sends, and nothing guessed: the build's tool row for
// `core.test_candidate` opens the trial (`status: "started"`) and closes it
// (`succeeded` or `failed`, its record "Result: candidate.trial_<verdict>",
// Core's `flow-bootstrap/candidate/trial-gate.ts`); every event between the
// two belongs to the trial's run. The trial session's `metadata.candidateTrial`
// never reaches the activity stream, so the tool row is the signal. A trial
// that never closes ends with its unit.

import { activityActionOf } from "fluxiq/ui";
import type { ClientGatewayActivity } from "../../shared/activity/index";

/** Core's tool id for testing a submitted candidate (`flow-bootstrap/candidate/trial-gate.ts`). */
const TEST_CANDIDATE = "core.test_candidate";

/** Core's sentence for a run step that failed (`activity/step/recovering.ts`). */
const RECOVERING = /^Recovering from a failed step\b/u;

/** The result code a trial's closing row carries in its record. */
const RESULT_CODE = /^Result:\s*(\S+)/u;

/** What the status says when a trial ends, by the trial gate's result code; anything else did not run. */
const ENDINGS: ReadonlyMap<string, string> = new Map([
  ["candidate.trial_yes", "The test passed: the Flow did what you asked"],
  ["candidate.trial_no", "The test failed: the Flow didn't do what you asked. Next: changing it and testing again"],
  ["candidate.trial_execution_failed", "The test failed: a step didn't work. Next: changing the Flow and testing again"],
  ["candidate.trial_unsure", "The test couldn't be judged. Next: testing the Flow again"],
  ["candidate.trial_not_judged", "The test couldn't be judged. Next: testing the Flow again"]
]);
const NOT_RUN = "The test didn't run. Next: deciding what to do";
const STEP_FAILED = "A step didn't work in the test";

/** What a candidate trial makes of one event. */
export type TrialState = {
  /** This event belongs to a trial still under way: its opening row or one of its run's events. */
  readonly testing: boolean;
  /** This event is the row that opened the trial. */
  readonly startedNow: boolean;
  /** This event is the row that closed the trial. */
  readonly endedNow: boolean;
  /** The status line in place of the event's own words, when the trial has one to say. */
  readonly line: string | null;
};

const OUTSIDE: TrialState = Object.freeze({ testing: false, startedNow: false, endedNow: false, line: null });

export class CandidateTrial {
  private activityId: string | undefined;
  private open = false;

  /** Folds `event` in and answers what the trial makes of it. */
  observe(event: ClientGatewayActivity): TrialState {
    if (event.activityId !== this.activityId) {
      this.activityId = event.activityId;
      this.open = false;
    }
    const detail = event.detail;
    if (detail?.kind === "tool" && detail.ref === TEST_CANDIDATE) {
      if (detail.status === "started") {
        this.open = true;
        return { testing: true, startedNow: true, endedNow: false, line: null };
      }
      this.open = false;
      const code = RESULT_CODE.exec(detail.text ?? "")?.[1];
      return { testing: false, startedNow: false, endedNow: true, line: (code ? ENDINGS.get(code) : undefined) ?? NOT_RUN };
    }
    if (!this.open) return OUTSIDE;
    // The unit settled with the trial under way: the trial ends with it.
    if (event.final === true || event.phase === "failed" || event.phase === "done") {
      this.open = false;
      return OUTSIDE;
    }
    return { testing: true, startedNow: false, endedNow: false, line: RECOVERING.test(event.label) ? stepFailed(event) : null };
  }
}

/** A trial's failed step, with why when the row says it ("A step didn't work in the test: it wasn't on the page"); a trial never presses it again. */
function stepFailed(event: ClientGatewayActivity): string {
  const why = event.detail ? activityActionOf(event)?.why : null;
  return why ? `${STEP_FAILED}: ${why}` : STEP_FAILED;
}
