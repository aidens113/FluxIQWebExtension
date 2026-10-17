import type { ExpectedFact } from "@fluxiq-web-extension/test-contracts";
import { CLASSIFIEDS_ROOT } from "../root.js";
import { createClassifiedsState } from "../state.js";
import type { ClassifiedsState } from "../types.js";

/** The subject of the account fact every page carries, kept current by every change the page reports. */
export const ACCOUNT_CONTACTS_SUBJECT = "classifieds-account-contacts";

/**
 * What the session has done that lasts: what is saved and hidden, and every
 * offer and message the site accepted, with which listing it went to and
 * whether it was delivered or held by the honeypot. A message's text is kept
 * because the task that sends one names it word for word; a contact the rate
 * limit refused never went, so it is not here.
 *
 * The page serialises this function into its own script (`pages/document.ts`),
 * so it may use nothing from outside its own body.
 */
export function accountContactsFacts(state: ClassifiedsState): string {
  return JSON.stringify({
    saved: state.saved,
    hidden: state.hidden,
    offers: state.offers.map((offer) => ({ listingId: offer.listingId, amount: offer.amount, delivered: offer.delivered })),
    messages: state.messages.map((message) => ({ listingId: message.listingId, text: message.text, delivered: message.delivered })),
  });
}

/** The account fact as `state` would leave it. */
export const accountIs = (id: string, state: ClassifiedsState): ExpectedFact => ({ id, subject: ACCOUNT_CONTACTS_SUBJECT, predicate: "text", value: accountContactsFacts(state) });

/** The account as a person arrives, before anything is saved, hidden or sent. */
export const ACCOUNT_AT_ARRIVAL = (id: string): ExpectedFact => accountIs(id, createClassifiedsState());

/** What the front page holds on arrival in every breadth workflow: where it is, and the account untouched. */
export const BREADTH_ARRIVAL: ExpectedFact[] = [
  { id: "front-page", subject: "document", predicate: "path", value: CLASSIFIEDS_ROOT },
  ACCOUNT_AT_ARRIVAL("account-at-arrival"),
];
