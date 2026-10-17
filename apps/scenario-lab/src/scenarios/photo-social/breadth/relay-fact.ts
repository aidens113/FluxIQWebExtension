import type { ExpectedFact } from "@fluxiq-web-extension/test-contracts";

/** The relay texts a breadth oracle reads, by their oracle scripts' test ids (`relay.ts`). */
const SUBJECTS = { consent: "fl-relay-consent", blocked: "fl-relay-blocked" } as const;

/** A fact on one relay text: `consent` is pending, essential or all; `blocked` is clear or blocked. */
export function relayFact(id: string, key: keyof typeof SUBJECTS, value: string): ExpectedFact {
  return { id, subject: SUBJECTS[key], predicate: "text", value };
}
