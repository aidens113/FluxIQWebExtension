import { cp, mkdir } from "node:fs/promises";
import path from "node:path";
import { pathExists } from "./path-exists.js";

/**
 * What the central folder keeps of a finished run's bundle: its verdict and
 * judgement, its report and review pages, its pictures, its spend, what the
 * Flow lane published, Core's log, and the local record of failed provider
 * calls. Named one by one, and nothing else is copied: the bundle's own
 * redaction attestation covers these, and the rest of `test-runs/` stays where
 * it is. The model's own steps are not copied at all -- they were written here
 * in the first place, and the bundle links to them.
 */
const KEY_FILES = [
  "summary.json", "run.json", "evaluation.json", "report.html", "review", "screenshots",
  "snapshots/live-llm.json", "snapshots/flow-lane.json", "logs/core.log", "provider-failures.local.json",
] as const;

/**
 * Copies each key file the bundle holds into `folder` at the same relative
 * path, and returns the ones copied. A file the run never wrote is skipped; a
 * copy that fails is named on the log and the rest still go.
 */
export async function copyKeyFiles(bundlePath: string, folder: string, log: (line: string) => void): Promise<string[]> {
  const copied: string[] = [];
  for (const relative of KEY_FILES) {
    const source = path.join(bundlePath, relative);
    try {
      if (!(await pathExists(source))) continue;
      const destination = path.join(folder, relative);
      await mkdir(path.dirname(destination), { recursive: true });
      await cp(source, destination, { recursive: true, force: true });
      copied.push(relative);
    } catch (error) {
      log(`[lab runs] could not copy ${relative} into ${folder}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return copied;
}

