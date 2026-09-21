import { escapeHtml, fixtureClient, page } from "../../../html.js";
import { STORE_PATHS } from "../catalog/index.js";
import { shellScript } from "../client/index.js";
import { storeStylesheet } from "../style/index.js";
import { headerMarkup } from "./header.js";
import type { PageKit } from "./page-kit.js";

export type StorePageInput = {
  title: string;
  body: string;
  script: string;
  keywords?: string;
  department?: string;
  /** Product pages only: the support chat opens itself. */
  autoOpenChat?: boolean;
};

/**
 * The consent banner, served with the page until it is answered. It is not a
 * modal -- the page behind it works -- but it is fixed along the bottom of the
 * viewport, so it covers whatever sits there.
 */
function consentBanner(kit: PageKit): string {
  const { css, ids } = kit;
  if (kit.state.consent !== "pending") return "";
  return `<div class="${css.consent}" id="${ids.consent}" role="region" aria-label="Cookie preferences">
<p><strong>Cookies and advertising choices.</strong> We use cookies and similar tools to provide our services, understand how customers use them, and show you relevant ads. You can accept all cookies, decline the ones that are not essential, or choose.</p>
<div data-consent-prefs hidden><label><input type="checkbox" checked disabled> Essential</label> <label><input type="checkbox"> Performance</label> <label><input type="checkbox"> Advertising</label> <button type="button" class="${css.button}" data-consent="save">Save preferences</button></div>
<div class="${css.consentActions}"><button type="button" class="${css.button} ${css.buttonPrimary}" data-consent="accept">Accept</button><button type="button" class="${css.button}" data-consent="decline">Decline</button><button type="button" class="${css.button}" data-consent="customize">Customize cookies</button></div>
</div>`;
}

/**
 * The footer, with a newsletter form that carries a honeypot: a "Website"
 * field moved off-screen, which a person never sees and a form-filler fills.
 */
function footer(kit: PageKit): string {
  const { css, ids } = kit;
  const column = (heading: string, links: readonly string[]) => `<div><p><strong>${escapeHtml(heading)}</strong></p>${links.map((label) => `<p><a href="${STORE_PATHS.home}#${label.toLowerCase().replace(/[^a-z]+/gu, "-")}">${escapeHtml(label)}</a></p>`).join("")}</div>`;
  return `<footer class="${css.footer}">
<p><a href="#top">Back to top</a></p>
<div class="${css.footerCols}">${column("Get to Know Us", ["Careers", "About Brightaisle", "Sustainability"])}${column("Make Money with Us", ["Sell on Brightaisle", "Become an Affiliate", "Advertise Your Products"])}${column("Let Us Help You", ["Your Account", "Your Orders", "Shipping Rates & Policies", "Returns & Replacements", "Help"])}</div>
<form class="${css.newsletter}" data-newsletter novalidate><label for="${ids.newsletterEmail}">Get deals in your inbox</label><input class="${css.input}" id="${ids.newsletterEmail}" type="email" name="email" autocomplete="email"><span class="${css.honeypot}"><label for="${ids.newsletterWebsite}">Website</label><input id="${ids.newsletterWebsite}" type="text" name="website" tabindex="-1" autocomplete="off"></span><button type="submit" class="${css.button}">Subscribe</button></form>
<p>&copy; 2026 Brightaisle, Inc. or its affiliates</p>
</footer>`;
}

/** A full store page: header, the page's own body, footer, the consent banner while it is unanswered, and the shared script. */
export function storePage(kit: PageKit, input: StorePageInput): string {
  const { css, ids } = kit;
  const body = `<div class="${css.root}" id="${ids.root}">
${headerMarkup(kit, input.keywords ?? "", input.department ?? "all")}
<main class="${css.main}">${input.body}</main>
${footer(kit)}
</div>
${consentBanner(kit)}
<style>${storeStylesheet(css)}</style>`;
  const script = `${fixtureClient(kit.runToken, "everything-store")}
${shellScript(kit.state, css, ids, { autoOpenChat: input.autoOpenChat === true })}
${input.script}`;
  return page(input.title, body, script);
}
