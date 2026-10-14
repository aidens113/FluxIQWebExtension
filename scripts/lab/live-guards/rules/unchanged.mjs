// Rule `unchanged`: an instance does not rerun a task whose previous live run
// failed while the source is byte-for-byte what that run tested. Nothing was
// fixed, so the rerun can only spend credits to fail the same way.
//
// Only a run that reached the product says the source fails. A run killed
// before it ended, and one that failed on the facility before any provider
// call (`facilityFailureBeforeProvider`, e.g. a Lab read that timed out
// before the instruction was typed), tested nothing of it, so the run before
// it is the one compared.
//
// Only a run in the same authoring mode is compared (`authoringMode`, from the
// launch's `--authoring-mode`, the Lab's default when absent). A failed
// `project` build says nothing about a `candidate` build of the same task on
// the same source: it is a different experiment, not a rerun. An entry that
// carries no mode -- every entry written before the mode was recorded
// (2026-10-14) -- matches no launch, so history from before then never
// refuses a run under this rule.

import { previousRun } from "../ledger-queries.mjs";

/** @param {import("./guard-state.mjs").GuardState} state */
export function checkUnchangedRerun(state) {
  const { instance, task, authoringMode } = state.launch;
  const previous = previousRun(state.entries, (entry) => entry.instance === instance && entry.task === task && typeof entry.authoringMode === "string" && entry.authoringMode === authoringMode && entry.killed !== true && !entry.facilityFailureBeforeProvider);
  if (previous === null || previous.verdict === "passed" || typeof previous.fingerprint !== "string") return null;
  if (previous.fingerprint !== state.fingerprint) return null;
  return {
    rule: "unchanged", overridable: true,
    why: `instance ${instance} last ran ${task} in ${authoringMode} mode as ${previous.runId}, which ended ${previous.verdict ?? "without a verdict"}, and the source has not changed since (fingerprint ${state.fingerprint})`,
    remedy: `Change the source to fix what ${previous.runId} found (documentation and debug files do not count), then run again; or ask the user to create ${state.files.override("unchanged")}.`,
  };
}
