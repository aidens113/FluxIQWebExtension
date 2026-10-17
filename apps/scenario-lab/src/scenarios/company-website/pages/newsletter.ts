import { escapeHtml } from "../../../html.js";
import type { RenderContext } from "../../../types.js";
import { newsletterScript } from "../client/index.js";
import { generatedId, siteClasses } from "../styles.js";
import { newsletterCode } from "../data/index.js";
import type { CompanyWebsiteState } from "../types.js";
import { sitePage } from "./shell.js";

/**
 * "Offers & reminders", the newsletter's own page, linked from the footer:
 * the sign-up form the timed offer also stands in for, and, once the visitor
 * has signed up, every address the list holds for them with its 10% code and
 * an "Unsubscribe" button. Signing up again with an address already on the
 * list changes nothing.
 */
export function renderNewsletter(state: CompanyWebsiteState, context: RenderContext): string {
  const c = siteClasses(context.seed);
  const field = generatedId(context.seed, "newsletter:email");
  const rows = state.newsletter.subscribers.map((email) => `<tr><td>${escapeHtml(email)}</td><td>${escapeHtml(newsletterCode(email))}</td><td><button type="button" class="${c.buttonGhost}" data-unsubscribe="${escapeHtml(email)}">Unsubscribe</button></td></tr>`).join("");
  const subscriptions = rows
    ? `<section class="${c.section}" aria-label="Your subscriptions"><h2 class="${c.sectionTitle}">You are subscribed</h2><table class="${c.priceTable}"><thead><tr><th>Email</th><th>Your 10% code</th><th></th></tr></thead><tbody>${rows}</tbody></table><p class="${c.muted}">Quote your code when you book your next service. One code per address.</p></section>`
    : "";
  const main = `<h1 class="${c.sectionTitle}" style="font-size:2rem">Offers &amp; reminders</h1>
<p class="${c.lead}">One email a month: a reminder when your boiler service is due, seasonal advice, and 10% off your next service.</p>
${subscriptions}
<form class="${c.section}" data-newsletter-form novalidate><h2 class="${c.sectionTitle}">${rows ? "Add another address" : "Sign up"}</h2>
<label class="${c.field}" for="${field}"><span class="${c.fieldLabel}">Email address</span><input class="${c.input}" id="${field}" name="email" type="email" autocomplete="email"></label>
<p class="${c.fieldError}" role="alert" data-newsletter-error></p>
<button type="submit" class="${c.buttonPrimary}">Sign me up</button>
<p class="${c.muted}">By signing up you agree to receive marketing email from Kestrel Lane. Unsubscribe at any time on this page.</p></form>`;
  return sitePage({ state, context, title: "Offers and reminders", section: null, main, pageScript: newsletterScript() });
}
