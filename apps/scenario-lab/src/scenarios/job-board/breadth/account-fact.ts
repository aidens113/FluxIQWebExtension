import type { ExpectedFact } from "@fluxiq-web-extension/test-contracts";

/** One fact on the account read-out every Rolefinch page carries. */
export function accountFact(id: string, value: string): ExpectedFact {
  return { id, subject: "job-closed-account", predicate: "text", value };
}
