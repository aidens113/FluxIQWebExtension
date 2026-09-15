import { access } from "node:fs/promises";
import { RunnerFailure } from "../failure.js";

/** Fails as `environment.missing`, naming the first absent path, before anything is hashed, copied or built. */
export async function requireTopologyPaths(targets: readonly string[]): Promise<void> {
  for (const target of targets) {
    try { await access(target); }
    catch (cause) { throw new RunnerFailure("environment.missing", `Required test topology path is missing: ${target}`, { cause, details: { path: target } }); }
  }
}
