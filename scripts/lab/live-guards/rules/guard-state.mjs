// What every rule is given. Built once per admission by `admit-live-run.mjs`;
// the rules read it and touch no file themselves.

/**
 * @typedef {{
 *   now: number,
 *   launch: { instance: string, task: string },
 *   stopBalance: string | null,
 *   entries: import("../ledger.mjs").LedgerEntry[],
 *   fingerprint: string,
 *   devAncestry: { repository: import("../dev-ancestry.mjs").DevAncestry, core: import("../dev-ancestry.mjs").DevAncestry },
 *   hasDebug: (runId: string) => boolean,
 *   debugPath: (runId: string) => string,
 *   files: ReturnType<typeof import("../guard-files.mjs").guardFiles>,
 * }} GuardState
 * @typedef {{ rule: string, overridable: boolean, why: string, remedy: string }} Refusal
 */

/** Every rule's name, in the order the rules are asked. */
export const RULE_NAMES = ["balance", "behind-dev", "loop", "debug", "unchanged"];
