// The headline a person reads for a unit of work: what it is while it runs,
// and how it ended. It names the work, never the step inside it, so it stays
// put while Core's sentences change underneath (the detail line carries those).

import type { ActivityDisplay } from "../../shared/activity/index";

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

/** The headline for a unit of work of `kind`, working (`outcome` null) or settled. */
export function activityHeadline(kind: ActivityDisplay["subjectKind"], outcome: ActivityDisplay["outcome"]): string {
  if (outcome === "waiting") return "Waiting for you";
  if (outcome === "done") return DONE[kind];
  if (outcome === "failed") return FAILED[kind];
  return WORKING[kind];
}
