import type { CompanyWebsiteState } from "../types.js";

/** Complete synthetic account facts; no personal or message contents. */
export function companyReviewAccountFacts(state: CompanyWebsiteState): string {
  return JSON.stringify({ bookingCount: state.bookings.length, deposits: { count: state.deposits.count, totalPence: state.deposits.totalPence }, quoteCount: state.quotes.length, subscriberCount: state.newsletter.subscribers.length, discarded: { ...state.discarded }, drafts: state.drafts, refusedBookings: state.refusedBookings });
}
