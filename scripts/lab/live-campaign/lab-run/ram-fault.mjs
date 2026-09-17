// This machine has faulty RAM, so a child that died with one of its signatures
// is retried rather than reported. A child that reported a run outcome is never
// retried: that is a real result.

import { parseLabResult, parseRunnerRefusal } from "./output.mjs";

const PNPM_OWN_CODE = /[\\/]pnpm(?:[\\/][\d.]+)?[\\/](?:dist|bin|lib)[\\/][^\s:'"]*\.c?js/iu;
const JS_ERROR = /\b(?:SyntaxError|TypeError|ReferenceError|RangeError)\b/u;

/**
 * Why an attempt should be retried as this machine's memory fault, or `null`
 * when it is a real outcome. An attempt that printed a run result is real
 * unless the runner itself classified it `process.startup`.
 *
 * @param {{ code: number | null, signal?: string | null, stdout: string, stderr: string }} attempt
 */
export function ramFaultSignature(attempt) {
  const result = parseLabResult(attempt.stdout);
  if (result && result.failureCategory !== "process.startup") return null;
  const output = `${attempt.stdout}\n${attempt.stderr}`;
  if ((result?.failureCategory ?? parseRunnerRefusal(attempt.stderr)?.category) === "process.startup") return "process.startup facility failure";
  if (attempt.code === 3221225477 || attempt.code === -1073741819 || /(?<![\d-])(?:3221225477|-1073741819)(?!\d)/u.test(output)) return "exit 3221225477 (access violation)";
  if (attempt.code === 139 || attempt.signal === "SIGSEGV" || /segmentation fault/iu.test(output)) return "segmentation fault";
  if (PNPM_OWN_CODE.test(output) && JS_ERROR.test(output)) return "error inside pnpm's own code";
  return null;
}
