import type { Collection, PhotoRelay, PhotoState } from "./types.js";

/** The subjects final-state facts read, as `data-testid`s on the page's oracle scripts. */
export const RELAY_SUBJECTS: Readonly<Record<keyof PhotoRelay, string>> = {
  consent: "fl-relay-consent",
  collections: "fl-relay-collections",
  outbox: "fl-relay-outbox",
  blocked: "fl-relay-blocked",
};

/** Every collection, by name, each with its posts' codes sorted, so the order posts were added in never matters. */
export function collectionsText(collections: readonly Collection[]): string {
  return [...collections]
    .sort((a, b) => a.name.localeCompare(b.name, "en"))
    .map(({ name, codes }) => (codes.length === 0 ? `${name}: (empty)` : `${name}: ${[...codes].sort().join(" ")}`))
    .join(" | ");
}

/**
 * What the oracle scripts say for a state: the consent answer, every
 * collection and what it holds, how many messages the visitor sent to each
 * thread, and whether the account is action-blocked.
 */
export function relayFor(state: Omit<PhotoState, "relay">): PhotoRelay {
  const sent = new Map<string, number>();
  for (const message of state.messages) if (message.from === "me") sent.set(message.thread, (sent.get(message.thread) ?? 0) + 1);
  const outbox = [...sent].sort(([a], [b]) => a.localeCompare(b)).map(([thread, count]) => `${thread} ${count}`).join(" | ");
  return {
    consent: state.consent,
    collections: collectionsText(state.collections),
    outbox: outbox === "" ? "none" : outbox,
    blocked: state.blocked ? "blocked" : "clear",
  };
}
