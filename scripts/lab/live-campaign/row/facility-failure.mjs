// Where a run that finished its bundle failed on the facility, read from the
// evaluation's `facilityFailure`: a closed, secret-free diagnostic, so only its
// known fields are read, and only when they are plain codes.
//
// A `core.refused` diagnostic also carries Core's own sentence. The contract's
// validator already screened it, but this line is printed, so it is screened
// again with the contract's own rule (`isScreenedFacilityRefusal`, read from
// `test-contracts`' build) and dropped if it fails. With no build there is
// nothing to screen with, and the sentence is dropped too.

import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { repositoryRoot } from "../../lab-instance.mjs";

const CODE = /^[A-Za-z0-9._-]{1,64}$/u;
const ENDPOINT = /^\/api\/[a-z0-9][a-z0-9/_-]{0,119}$/u;
const code = (value) => (typeof value === "string" && CODE.test(value) ? value : null);

const SCREEN_MODULE = path.join(repositoryRoot, "packages", "test-contracts", "dist", "facility-failure-refusal.js");
const { isScreenedFacilityRefusal = () => false } = existsSync(SCREEN_MODULE) ? await import(pathToFileURL(SCREEN_MODULE).href) : {};

/**
 * A `core.refused` diagnostic's route, 4xx status and screened sentence, or
 * `null` for any other reason or a record without a valid route and status.
 * `refusal` is absent when the sentence is missing or fails screening.
 *
 * @returns {{ endpoint: string, httpStatus: number, refusal?: string } | null}
 */
export function coreRefusalOf(diagnostic) {
  if (diagnostic?.reason !== "core.refused") return null;
  const { endpoint, httpStatus, refusal } = diagnostic;
  if (typeof endpoint !== "string" || !ENDPOINT.test(endpoint) || !Number.isSafeInteger(httpStatus) || httpStatus < 400 || httpStatus > 499) return null;
  return { endpoint, httpStatus, ...(isScreenedFacilityRefusal(refusal) ? { refusal } : {}) };
}

/**
 * One line such as `http.timeout at control.request after 30000 ms
 * (finalized-bundle, scenario.execute)`, or `null` when the run named none. A
 * Core refusal reads `core.refused 400 at /api/... (finalized-bundle,
 * scenario.execute): "LLM execution limit is invalid."`.
 */
export function describeFacilityFailure(diagnostic) {
  const reason = code(diagnostic?.reason);
  if (reason === null) return null;
  const operation = code(diagnostic.operationStage);
  const timeoutMs = Number.isSafeInteger(diagnostic.timeoutMs) ? diagnostic.timeoutMs : null;
  const cause = code(diagnostic.causeCode);
  const where = [code(diagnostic.boundary), code(diagnostic.stage)].filter(Boolean).join(", ");
  const refused = coreRefusalOf(diagnostic);
  if (refused) {
    return `${reason} ${refused.httpStatus} at ${refused.endpoint}${where ? ` (${where})` : ""}${refused.refusal === undefined ? "" : `: "${refused.refusal}"`}`;
  }
  return `${reason}${operation ? ` at ${operation}` : ""}${timeoutMs !== null ? ` after ${timeoutMs} ms` : ""}${cause ? `, ${cause}` : ""}${where ? ` (${where})` : ""}`;
}
