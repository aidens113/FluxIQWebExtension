// Rule `debug`: an instance does not start another live run until its
// previous one has been debugged, in writing, in the tree it runs from.

import { previousRun } from "../ledger-queries.mjs";

/** @param {import("./guard-state.mjs").GuardState} state */
export function checkPreviousDebug(state) {
  const { instance } = state.launch;
  const previous = previousRun(state.entries, (entry) => entry.instance === instance);
  if (previous === null || state.hasDebug(previous.runId)) return null;
  return {
    rule: "debug", overridable: true,
    why: `instance ${instance}'s previous live run, ${previous.runId}, has no debug file at ${state.debugPath(previous.runId)}`,
    remedy: `Read that run's evidence and write ${state.debugPath(previous.runId)}: what it did, why it failed or passed, and what changes next. Or ask the user to create ${state.files.override("debug")}.`,
  };
}
