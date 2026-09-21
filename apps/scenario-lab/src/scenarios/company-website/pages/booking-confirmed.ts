import { escapeHtml } from "../../../html.js";
import type { RenderContext } from "../../../types.js";
import { bookableServiceById, branchById, COMPANY, formatPence, longDate } from "../data/index.js";
import { siteClasses } from "../styles.js";
import type { CompanyWebsiteState } from "../types.js";
import { sitePage } from "./shell.js";

/**
 * The site's own confirmation page, which the booking widget sends the top
 * window to once the deposit is taken. It is rendered from the booking the
 * server holds, so it says what was actually booked, not what the widget
 * thought it was booking.
 */
export function renderBookingConfirmed(state: CompanyWebsiteState, context: RenderContext, reference: string | null): string {
  const c = siteClasses(context.seed);
  const booking = reference === null ? undefined : state.bookings.find((candidate) => candidate.reference === reference);
  if (!booking) {
    const main = `<h1 class="${c.sectionTitle}" style="font-size:2rem">We could not find that booking</h1><p class="${c.lead}">If you have just booked, check your email for the confirmation, or call ${COMPANY.phone}.</p>`;
    return sitePage({ state, context, title: "Booking", section: "book", main });
  }
  const service = bookableServiceById(booking.serviceId);
  const row = (label: string, testId: string, value: string) => `<dt>${escapeHtml(label)}</dt><dd data-testid="${testId}">${escapeHtml(value)}</dd>`;
  const main = `<h1 class="${c.sectionTitle}" style="font-size:2rem">Your visit is booked</h1>
<p class="${c.lead}">We have sent the details to ${escapeHtml(booking.email)}. Your engineer will ring about 30 minutes before arriving.</p>
<dl class="${c.summary}">
${row("Reference", "booking-reference", booking.reference)}
${row("Branch", "booking-branch", branchById(booking.branchId).name)}
${row("Service", "booking-service", service ? `${service.service}: ${service.variant}` : booking.serviceId)}
${row("Date", "booking-date", longDate(booking.date))}
${row("Time", "booking-time", booking.time)}
${row("Engineer", "booking-engineer", booking.engineer)}
${row("Deposit paid", "booking-deposit", formatPence(booking.depositPence))}
</dl>
<p class="${c.muted}">Need to change it? Call the branch at least 48 hours before your visit and we will refund the deposit in full.</p>`;
  return sitePage({ state, context, title: "Booking confirmed", section: "book", main });
}
