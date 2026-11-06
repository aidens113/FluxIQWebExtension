import type { CompanyWebsiteState } from "../types.js";

/**
 * The last quote request the server kept, as the confirmation page shows it
 * (reference, service, contact method, offers flag, postcode), readable on
 * every page in a hidden script element beside the account facts. The
 * confirmation page is the only visible place these exist, and a run is free to
 * leave it once the request is sent. `none` before any request.
 *
 * The page serialises this function into its own script (`pages/shell.ts`), so
 * it may use nothing from outside its own body.
 */
export function companyQuoteRecord(state: CompanyWebsiteState): string {
  const quote = state.quotes[state.quotes.length - 1];
  if (!quote) return "none";
  return JSON.stringify({ reference: quote.reference, service: quote.service, contactBy: quote.contactBy, offers: quote.marketing || state.newsletter.subscribers.includes(quote.email), postcode: quote.postcode });
}
