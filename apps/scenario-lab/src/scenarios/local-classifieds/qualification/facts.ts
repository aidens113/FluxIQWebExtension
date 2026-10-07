import type { ClassifiedsState } from "../types.js";

/** Saved/hidden membership and every extra-contact collection; no message bodies or person data. */
export function soldSavesAccountFacts(state: ClassifiedsState): string {
  return JSON.stringify({ saved: state.saved, hidden: state.hidden, offerCount: state.offers.length, messageCount: state.messages.length, contactCount: state.contactLog.length, refusedContacts: state.refusedContacts });
}
