import type { ExpectedFact } from "@fluxiq-web-extension/test-contracts";
import { UNTOUCHED_ACCOUNT } from "./untouched-account.js";

/**
 * A fact on the whole account (`photo-studio-account`): the untouched account
 * with `changes` laid over it. The subject is the oracle script every page
 * carries and the page's script rewrites after each change the server accepts.
 */
export function accountFact(id: string, changes: Partial<typeof UNTOUCHED_ACCOUNT> = {}): ExpectedFact {
  return { id, subject: "photo-studio-account", predicate: "text", value: JSON.stringify({ ...UNTOUCHED_ACCOUNT, ...changes }) };
}
