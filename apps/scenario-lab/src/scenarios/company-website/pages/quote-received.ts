import { escapeHtml } from "../../../html.js";
import type { RenderContext } from "../../../types.js";
import { COMPANY } from "../data/index.js";
import { siteClasses } from "../styles.js";
import type { CompanyWebsiteState } from "../types.js";
import { sitePage } from "./shell.js";

/**
 * Where the quote drawer lands. With the reference of a request the server
 * kept, it confirms it and shows back what was received, as the office's CRM
 * stored it. Without one -- a submission the spam filter dropped, or a stale
 * link -- it is the same polite thank-you with nothing behind it.
 */
export function renderQuoteReceived(state: CompanyWebsiteState, context: RenderContext, reference: string | null): string {
  const c = siteClasses(context.seed);
  const request = reference === null ? undefined : [...state.quotes].reverse().find((candidate) => candidate.reference === reference);
  if (!request) {
    const main = `<h1 class="${c.sectionTitle}" style="font-size:2rem">Thank you</h1><p class="${c.lead}">Thanks for getting in touch. We will be in touch soon.</p><p><a href="${COMPANY.root}">Back to the home page</a></p>`;
    return sitePage({ state, context, title: "Thank you", section: null, main });
  }
  const row = (label: string, testId: string, value: string) => `<dt>${escapeHtml(label)}</dt><dd data-testid="${testId}">${escapeHtml(value)}</dd>`;
  const main = `<h1 class="${c.sectionTitle}" style="font-size:2rem">Thanks, ${escapeHtml(request.fullName.split(" ")[0] ?? request.fullName)}. Your request is in.</h1>
<p class="${c.lead}">Your reference is <strong data-testid="quote-reference">${escapeHtml(request.reference)}</strong>. Someone from the branch nearest you will reply within one working day.</p>
<h2 class="${c.sectionTitle}">What you sent us</h2>
<dl class="${c.summary}">
${row("Name", "quote-name", request.fullName)}
${row("Email", "quote-email", request.email)}
${row("Phone", "quote-phone", request.phone)}
${row("Postcode", "quote-postcode", request.postcode)}
${row("Service", "quote-service", request.service)}
${row("Contact by", "quote-contact", request.contactBy)}
${row("Offers by email", "quote-marketing", request.marketing ? "Yes" : "No")}
${row("About the job", "quote-details", request.details || "Nothing added")}
</dl>
<p><a href="${COMPANY.root}">Back to the home page</a></p>`;
  return sitePage({ state, context, title: "Quote request received", section: null, main });
}
