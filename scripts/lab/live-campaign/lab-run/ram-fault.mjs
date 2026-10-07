// This machine has faulty RAM, so a child that died with one of its signatures
// is retried rather than reported. A child that reported a run outcome is never
// retried: that is a real result.

import path from "node:path";
import { repositoryRoot } from "../../lab-instance.mjs";
import { coreControlResponse } from "./core-control-response.mjs";
import { readFirstFailure as readFirstFailureOfRun } from "./first-failure.mjs";
import { parseLabResult, parseRunnerRefusal } from "./output.mjs";

/**
 * The one signature that is a classified failure rather than a bare crash: the
 * Lab ran and said a facility failed to start. The memory fault can cause that,
 * but so can a real defect, and only a repetition tells them apart
 * (`attempt-failure.mjs`). A facility that failed because Core answered an
 * HTTP request is never this signature: Core was running and decided.
 */
export const STARTUP_FAILURE = "process.startup facility failure";

const PNPM_OWN_CODE = /[\\/]pnpm(?:[\\/][\d.]+)?[\\/](?:dist|bin|lib)[\\/][^\s:'"]*\.c?js/iu;
const JS_ERROR = /\b(?:SyntaxError|TypeError|ReferenceError|RangeError)\b/u;

/**
 * Why an attempt should be retried as this machine's memory fault, or `null`
 * when it is a real outcome. An attempt that printed a run result is real
 * unless the runner itself classified it `process.startup`, and even then it
 * is real when the run's first failure, or the runner's refusal, is Core
 * control answering with an HTTP error (t342: Core's identity endpoint
 * answered 400 on every run, and the campaign called it possibly the memory).
 *
 * @param {{ code: number | null, signal?: string | null, stdout: string, stderr: string }} attempt
 * @param {{ readFirstFailure?: (runPath: string) => string | null }} [options]
 */
export function ramFaultSignature(attempt, { readFirstFailure = readFirstFailureOfRun } = {}) {
  const result = parseLabResult(attempt.stdout);
  if (result && result.failureCategory !== "process.startup") return null;
  const output = `${attempt.stdout}\n${attempt.stderr}`;
  const refusal = parseRunnerRefusal(attempt.stderr);
  if ((result?.failureCategory ?? refusal?.category) === "process.startup") {
    const first = result?.path ? readFirstFailure(path.resolve(repositoryRoot, result.path)) : null;
    return coreControlResponse(first ?? refusal?.message) ? null : STARTUP_FAILURE;
  }
  if (attempt.code === 3221225477 || attempt.code === -1073741819 || /(?<![\d-])(?:3221225477|-1073741819)(?!\d)/u.test(output)) return "exit 3221225477 (access violation)";
  if (attempt.code === 139 || attempt.signal === "SIGSEGV" || /segmentation fault/iu.test(output)) return "segmentation fault";
  if (PNPM_OWN_CODE.test(output) && JS_ERROR.test(output)) return "error inside pnpm's own code";
  return null;
}
