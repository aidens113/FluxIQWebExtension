import type { CompanyWebsiteState } from "../types.js";

/**
 * The last booking the server holds (branch, service, date, time, deposit) on
 * every page, in a hidden script element beside the account facts. The booking
 * confirmation is the only visible place the service and deposit are written,
 * and the page that sends the top window there is not one a run must stay on.
 * `none` before any booking. Self-contained for the page's script.
 */
export function companyBookingRecord(state: CompanyWebsiteState): string {
  const booking = state.bookings[state.bookings.length - 1];
  if (!booking) return "none";
  return JSON.stringify({ branchId: booking.branchId, serviceId: booking.serviceId, date: booking.date, time: booking.time, depositPence: booking.depositPence });
}
