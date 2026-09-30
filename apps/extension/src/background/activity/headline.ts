// The headline a person reads for a unit of work: what it is while it runs,
// and how it ended. It names the work, never the step inside it, so it stays
// put while Core's sentences change underneath (the detail line carries those).
//
// Three situations change it besides the work settling (U8 and U9 of the t174
// live lane's UI review):
//
// - **Repair.** Once Core starts repairing the Flow -- a run recovering from a
//   failed step, a build re-authoring an answer its check refuted -- the work
//   reads "Fixing your Flow", not "Building your Flow", and a repair that ends
//   in failure reads "Couldn't fix your Flow".
// - **A check only the person can answer.** When a page action reports that
//   the page asks for what only a person can give (a robot check, a code
//   prompt), the headline says so plainly: "Waiting for you: finish the check
//   on the page".
// - **A question.** Core's own waiting state (`waiting_permission`, a run
//   paused on an ask) reads "Waiting for you: answer in the FluxIQ panel".

import type { ActivityDisplay } from "../../shared/activity/index";

/** What the person is being waited on for. */
export type ActivityWaitReason = "answer" | "check";

export type ActivityHeadlineSituation = {
  /** Core is repairing the Flow in this unit of work. */
  readonly repairing?: boolean;
  /** Why the work waits, when `outcome` is `waiting`. */
  readonly waitingOn?: ActivityWaitReason;
};

const WORKING: Readonly<Record<ActivityDisplay["subjectKind"], string>> = Object.freeze({
  build: "Building your Flow",
  run: "Running your Flow"
});

const DONE: Readonly<Record<ActivityDisplay["subjectKind"], string>> = Object.freeze({
  build: "Flow ready",
  run: "Run finished"
});

const FAILED: Readonly<Record<ActivityDisplay["subjectKind"], string>> = Object.freeze({
  build: "Build failed",
  run: "Run failed"
});

const WAITING: Readonly<Record<ActivityWaitReason, string>> = Object.freeze({
  answer: "Waiting for you: answer in the FluxIQ panel",
  check: "Waiting for you: finish the check on the page"
});

const REPAIRING = "Fixing your Flow";
const REPAIR_FAILED = "Couldn't fix your Flow";

/** The headline for a unit of work of `kind`, working (`outcome` null) or settled, in `situation`. */
export function activityHeadline(kind: ActivityDisplay["subjectKind"], outcome: ActivityDisplay["outcome"], situation: ActivityHeadlineSituation = {}): string {
  if (outcome === "waiting") return WAITING[situation.waitingOn ?? "answer"];
  if (outcome === "done") return DONE[kind];
  if (outcome === "failed") return situation.repairing ? REPAIR_FAILED : FAILED[kind];
  return situation.repairing ? REPAIRING : WORKING[kind];
}
