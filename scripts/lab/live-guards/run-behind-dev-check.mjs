// The `behind-dev` question as an exit code, for launchers that start a browser
// or a product run without going through `run-lab.mjs` (`ui:e2e`, `demo:*`, the
// Playwright `test:e2e` scripts). It reuses `admitDevAncestry`, so the rule,
// the override file and the refusal text are the Lab's own.

import { admitDevAncestry } from "./admit-dev-ancestry.mjs";
import { formatRefusals } from "./format-refusal.mjs";

/**
 * @param {{
 *   repositoryRoot: string, coreRoot: string, slotsDirectory?: string,
 *   devAncestry?: (root: string) => Promise<import("./dev-ancestry.mjs").DevAncestry>,
 *   stderr?: { write: (text: string) => unknown },
 * }} options
 * @returns {Promise<number>} 0 when admitted (nothing printed), 1 when refused
 */
export async function runBehindDevCheck(options) {
  const { stderr = process.stderr, ...rest } = options;
  let admission;
  try {
    admission = await admitDevAncestry({ args: ["run"], ...rest });
  } catch (error) {
    admission = { refusals: [{ rule: "guard-error", why: `the dev ancestry could not be evaluated: ${error instanceof Error ? error.message : String(error)}`, remedy: "Fix the checkout the message names, then run again." }] };
  }
  if (admission === null || admission.refusals.length === 0) return 0;
  const refusal = formatRefusals(admission.refusals, "run");
  stderr.write(refusal.text);
  stderr.write(refusal.line);
  return 1;
}
