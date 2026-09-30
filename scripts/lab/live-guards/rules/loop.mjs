// Rule `loop`: at most three live runs per instance in any 30 minutes. A
// supervised loop -- run, read the evidence, debug, fix, rerun -- does not go
// faster than that; a launcher relaunching on its own does.

import { recentStarts } from "../ledger-queries.mjs";

export const LOOP_WINDOW_MS = 30 * 60 * 1000;
export const LOOP_MAX_STARTS = 3;

/** @param {import("./guard-state.mjs").GuardState} state */
export function checkRelaunchLoop(state) {
  const { instance } = state.launch;
  const starts = recentStarts(state.entries, instance, state.now - LOOP_WINDOW_MS);
  if (starts.length < LOOP_MAX_STARTS) return null;
  const oldest = starts.map((entry) => Date.parse(entry.at)).sort((left, right) => left - right)[0];
  const freeAt = new Date(oldest + LOOP_WINDOW_MS).toISOString();
  return {
    rule: "loop", overridable: true,
    why: `instance ${instance} already started ${starts.length} live runs in the last 30 minutes, the signature of an unattended relaunch loop`,
    remedy: `Stop any launcher loop. A person or supervising agent reviews those runs; the next run is admitted from ${freeAt}. Or ask the user to create ${state.files.override("loop")}.`,
  };
}
