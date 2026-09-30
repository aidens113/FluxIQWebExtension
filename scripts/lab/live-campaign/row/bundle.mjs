// A finished run's bundle: the records a summary row is read from.

import { readFile } from "node:fs/promises";
import path from "node:path";

/** The bundle of an attempt that named no run directory: every record absent. */
export const EMPTY_BUNDLE = Object.freeze({ evaluation: null, run: null, liveLlm: null, flowLane: null, repairLane: null, personHandOffs: null });

/**
 * Reads a run directory's records; one that is missing or not JSON is `null`.
 * `repairLane` exists only for a run given `--replays`, and `personHandOffs`
 * only for a run the Lab played the person on (`snapshots/person-hand-offs.json`).
 */
export async function readRunBundle(runPath) {
  const read = async (...parts) => { try { return JSON.parse(await readFile(path.join(runPath, ...parts), "utf8")); } catch { return null; } };
  return { evaluation: await read("evaluation.json"), run: await read("run.json"), liveLlm: await read("snapshots", "live-llm.json"), flowLane: await read("snapshots", "flow-lane.json"), repairLane: await read("snapshots", "repair-lane.json"), personHandOffs: await read("snapshots", "person-hand-offs.json") };
}
