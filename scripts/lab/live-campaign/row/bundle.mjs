// A finished run's bundle: the four records a summary row is read from.

import { readFile } from "node:fs/promises";
import path from "node:path";

/** The bundle of an attempt that named no run directory: every record absent. */
export const EMPTY_BUNDLE = Object.freeze({ evaluation: null, run: null, liveLlm: null, flowLane: null });

/** Reads a run directory's records; one that is missing or not JSON is `null`. */
export async function readRunBundle(runPath) {
  const read = async (...parts) => { try { return JSON.parse(await readFile(path.join(runPath, ...parts), "utf8")); } catch { return null; } };
  return { evaluation: await read("evaluation.json"), run: await read("run.json"), liveLlm: await read("snapshots", "live-llm.json"), flowLane: await read("snapshots", "flow-lane.json") };
}
