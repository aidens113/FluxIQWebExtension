// The `behind-dev` question for every Lab run that is not already asked it by
// the live-run guards: scripted-model attempts, provider-free runs, `lab run`,
// interactive and the rest. A lane that tested code without a merge `dev`
// already had is the failure (user, 2026-11-25: "merge all test runs before
// doing more tests"). The check is the one in `rules/behind-dev.mjs`, over
// `readDevAncestry`; this module only decides whether it applies and reads the
// user's override file. It reads git and one file, and starts nothing.

import { existsSync } from "node:fs";
import { readDevAncestry } from "./dev-ancestry.mjs";
import { DEFAULT_LAB_SLOTS_DIRECTORY, guardFiles } from "./guard-files.mjs";
import { READ_ONLY_LAB_COMMANDS } from "./read-only-commands.mjs";
import { checkBehindDev } from "./rules/index.mjs";

/**
 * @param {{
 *   args: string[], repositoryRoot: string, coreRoot: string, slotsDirectory?: string,
 *   devAncestry?: (root: string) => Promise<import("./dev-ancestry.mjs").DevAncestry>,
 * }} options
 * @returns {Promise<null | { refusals: import("./rules/guard-state.mjs").Refusal[], overridden: string[] }>} null for a read-only command
 */
export async function admitDevAncestry(options) {
  const { args, repositoryRoot, coreRoot, slotsDirectory = DEFAULT_LAB_SLOTS_DIRECTORY, devAncestry = readDevAncestry } = options;
  if (READ_ONLY_LAB_COMMANDS.has(args[0] ?? "")) return null;
  const files = guardFiles(slotsDirectory);
  const [repository, core] = await Promise.all([devAncestry(repositoryRoot), devAncestry(coreRoot)]);
  const refusal = checkBehindDev({ devAncestry: { repository, core }, files });
  if (refusal === null) return { refusals: [], overridden: [] };
  return existsSync(files.override(refusal.rule))
    ? { refusals: [], overridden: [refusal.rule] }
    : { refusals: [refusal], overridden: [] };
}
