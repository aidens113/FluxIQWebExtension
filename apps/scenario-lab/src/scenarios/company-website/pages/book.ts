import type { RenderContext } from "../../../types.js";
import { COMPANY, DEPOSIT_PENCE, formatPence } from "../data/index.js";
import { siteClasses } from "../styles.js";
import type { CompanyWebsiteState } from "../types.js";
import { sitePage } from "./shell.js";

/** The booking widget's document, on the vendor's own origin. */
export const BOOKING_WIDGET_PATH = "booking-widget";

/**
 * "Book a service": the site's page around a third-party booking widget,
 * embedded from the vendor's own origin. When the widget reports a booking,
 * this page sends the visitor to the site's own confirmation.
 */
export function renderBook(state: CompanyWebsiteState, context: RenderContext): string {
  const c = siteClasses(context.seed);
  const src = `${context.alternateOrigin ?? ""}${COMPANY.root}${BOOKING_WIDGET_PATH}`;
  const main = `<h1 class="${c.sectionTitle}" style="font-size:2rem">Book a service online</h1>
<p class="${c.lead}">Pick a branch, a service and a time that suits you. For repairs that cannot wait, ring ${COMPANY.emergencyPhone}.</p>
<p class="${c.notice}">A ${formatPence(DEPOSIT_PENCE)} deposit is taken when you book and comes off your final bill. Cancel at least 48 hours before your visit for a full refund.</p>
<iframe class="${c.widgetFrame}" title="Slotwise booking" src="${src}"></iframe>`;
  const pageScript = `window.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || data.type !== 'slotwise:booked' || typeof data.reference !== 'string') return;
  location.href = ${JSON.stringify(`${COMPANY.root}booking/confirmed?ref=`)} + encodeURIComponent(data.reference);
});`;
  return sitePage({ state, context, title: "Book a service", section: "book", main, pageScript });
}
