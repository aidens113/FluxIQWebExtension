// What a failed attempt actually failed at, when the Lab classified it: a
// fingerprint two attempts can be compared by, and a sentence a person can act
// on.
//
// This exists because of one mislabel. On 2026-09-18 every Core web panel
// build in one worktree died the same way -- Turbopack aborting on a project
// path that ran through `node_modules` -- and the campaign reported each of
// three attempts, then a fourth in a rerun, as "this machine's RAM-fault
// signature". The label came from `ramFaultSignature`, which treats any
// `process.startup` failure as possibly the hardware, and nothing ever asked
// whether the failure was the same one every time. A memory fault on this
// machine is rare and does not reproduce on a quiet rerun; a failure that
// comes back identical is the opposite of that signature.
//
// Only a classified failure is fingerprinted. A bare crash -- an access
// violation, a segmentation fault -- prints nothing that tells "the same
// failure" from "the same symptom", so two of those in a row are still the
// hardware as far as anyone can tell, and stay retried as such.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { repositoryRoot } from "../../lab-instance.mjs";
import { parseLabResult, parseRunnerRefusal } from "./output.mjs";

/**
 * @param {{ code: number | null, signal?: string | null, stdout: string, stderr: string }} attempt
 * @param {{ readFirstFailure?: (runPath: string) => Promise<string | null> }} [options]
 * @returns {Promise<{ fingerprint: string, description: string } | null>} null when the attempt carries no classified failure
 */
export async function describeAttemptFailure(attempt, { readFirstFailure = firstFailureOfRun } = {}) {
  const result = parseLabResult(attempt.stdout);
  const refusal = parseRunnerRefusal(attempt.stderr);
  const category = result?.failureCategory ?? result?.evaluation?.failureCategory ?? refusal?.category ?? null;
  if (category === null) return null;
  const facility = result?.evaluation?.facilityFailure ?? null;
  const where = facility ? [facility.boundary, facility.stage, facility.reason, facility.operationStage].filter(Boolean).join("/") : null;
  const first = result?.path ? await readFirstFailure(path.resolve(repositoryRoot, result.path)) : null;
  const what = first ?? refusal?.message ?? where ?? "no further detail";
  return {
    fingerprint: [category, where, first ?? refusal?.message ?? null, `exit ${attempt.code ?? attempt.signal}`].filter(Boolean).join(" | "),
    description: `${category}: ${what}`,
  };
}

/** The summary of the first failure a run's bundle recorded, or null when it recorded none. */
async function firstFailureOfRun(runPath) {
  let text;
  try {
    text = await readFile(path.join(runPath, "summary.json"), "utf8");
  } catch (error) {
    // An attempt that died before finalizing has no summary; its printed
    // result still fingerprints it.
    if (error?.code === "ENOENT") return null;
    throw error;
  }
  const summary = JSON.parse(text)?.firstFailure?.summary;
  return typeof summary === "string" && summary.trim() !== "" ? summary.trim() : null;
}
