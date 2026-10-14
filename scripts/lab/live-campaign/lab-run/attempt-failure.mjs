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

import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { repositoryRoot } from "../../lab-instance.mjs";
import { readFirstFailure as firstFailureOfRun } from "./first-failure.mjs";
import { parseLabResult, parseRunnerRefusal } from "./output.mjs";

// A `core.refused` facility failure names Core's 4xx and its sentence. The
// sentence is screened again with the contract's own rule before it is
// printed, and dropped when it fails or when there is no build to screen with.
// (`row/facility-failure.mjs` holds the same reading, but `row` imports this
// directory, so it cannot be imported from here.)
const ENDPOINT = /^\/api\/[a-z0-9][a-z0-9/_-]{0,119}$/u;
const SCREEN_MODULE = path.join(repositoryRoot, "packages", "test-contracts", "dist", "facility-failure-refusal.js");
const { isScreenedFacilityRefusal = () => false } = existsSync(SCREEN_MODULE) ? await import(pathToFileURL(SCREEN_MODULE).href) : {};

/**
 * @param {{ code: number | null, signal?: string | null, stdout: string, stderr: string }} attempt
 * @param {{ readFirstFailure?: (runPath: string) => Promise<string | null> | string | null }} [options]
 * @returns {Promise<{ fingerprint: string, description: string } | null>} null when the attempt carries no classified failure
 */
export async function describeAttemptFailure(attempt, { readFirstFailure = firstFailureOfRun } = {}) {
  const result = parseLabResult(attempt.stdout);
  const refusal = parseRunnerRefusal(attempt.stderr);
  const category = result?.failureCategory ?? result?.evaluation?.failureCategory ?? refusal?.category ?? null;
  if (category === null) return null;
  const facility = result?.evaluation?.facilityFailure ?? null;
  const refused = facility ? coreRefusal(facility) : null;
  const where = facility ? [[facility.boundary, facility.stage, facility.reason, facility.operationStage].filter(Boolean).join("/"), refused].filter(Boolean).join(" ") : null;
  const first = result?.path ? await readFirstFailure(path.resolve(repositoryRoot, result.path)) : null;
  // Core's own status and sentence say why ahead of anything else the run wrote.
  const what = (refused ? `core.refused ${refused}` : null) ?? first ?? refusal?.message ?? where ?? "no further detail";
  return {
    fingerprint: [category, where, first ?? refusal?.message ?? null, `exit ${attempt.code ?? attempt.signal}`].filter(Boolean).join(" | "),
    description: `${category}: ${what}`,
  };
}

/** `400 /api/...: "Core's sentence"` for a `core.refused` failure, or null. */
function coreRefusal(facility) {
  const { reason, endpoint, httpStatus, refusal } = facility;
  if (reason !== "core.refused" || typeof endpoint !== "string" || !ENDPOINT.test(endpoint) || !Number.isSafeInteger(httpStatus) || httpStatus < 400 || httpStatus > 499) return null;
  return `${httpStatus} ${endpoint}${isScreenedFacilityRefusal(refusal) ? `: "${refusal}"` : ""}`;
}
