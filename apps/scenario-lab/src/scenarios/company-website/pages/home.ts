import { escapeHtml } from "../../../html.js";
import type { RenderContext } from "../../../types.js";
import { quoteScript } from "../client/index.js";
import { BRANCHES, COMPANY } from "../data/index.js";
import { siteClasses } from "../styles.js";
import type { CompanyWebsiteState } from "../types.js";
import { quoteDrawer, quoteDrawerIds } from "./quote-drawer.js";
import { sitePage } from "./shell.js";

const ROOT = COMPANY.root;

/**
 * The home page: a hero with the site's second "Get a free quote" button, the
 * services and reviews every trade site leads with, the branches, and the
 * quote drawer, shipped closed. Three controls open the drawer -- the
 * header's, the hero's and the footer's -- and two of them carry the same
 * words.
 */
export function renderHome(state: CompanyWebsiteState, context: RenderContext): string {
  const c = siteClasses(context.seed);
  const ids = quoteDrawerIds(context.seed);
  const teaser = (title: string, text: string, href: string, link: string) => `<article class="${c.teaser}"><h3>${title}</h3><p>${text}</p><a href="${href}">${link}</a></article>`;
  const reviews = [
    ["Boiler died on a Sunday night. Owen was here by nine the next morning and had it running by ten.", "Mrs J., Hollins Cross"],
    ["Clear quote, no upselling, tidy install. The powerflush made a real difference.", "Daniel R., Eastmoor"],
    ["Booked the annual service online in two minutes. Engineer rang ahead to say he was on his way.", "Aisha K., Wrenfield"],
  ].map(([text, who]) => `<blockquote class="${c.review}"><p>${escapeHtml(text!)}</p><footer class="${c.muted}">${escapeHtml(who!)}</footer></blockquote>`).join("");
  const branches = BRANCHES.map((branch) => `<li><strong>${escapeHtml(branch.name)}</strong> &middot; ${escapeHtml(branch.phone)}</li>`).join("");
  const main = `<section class="${c.hero}">
  <h1 class="${c.heroTitle}">Warm homes since ${COMPANY.founded}</h1>
  <p>Family-run heating and plumbing engineers across five branches. Boiler servicing, repairs, new boilers and heat pumps, fitted by our own Gas Safe registered team.</p>
  <div class="${c.heroActions}"><button type="button" class="${c.buttonPrimary}" data-open-quote>Get a free quote</button><a href="${ROOT}book">Book a service online</a></div>
</section>
<section class="${c.section}"><div class="${c.stats}"><div><strong>4.9 out of 5</strong><br><span class="${c.muted}">from 1,284 reviews</span></div><div><strong>40 vans</strong><br><span class="${c.muted}">on the road every day</span></div><div><strong>5 branches</strong><br><span class="${c.muted}">and a 24-hour emergency line</span></div></div></section>
<section class="${c.section}"><h2 class="${c.sectionTitle}">What we do</h2><div class="${c.teaserGrid}">
  ${teaser("Servicing", "Annual boiler services and landlord gas safety certificates.", `${ROOT}services`, "See servicing prices")}
  ${teaser("Repairs", "Fault finding and repairs on every major boiler brand.", `${ROOT}services`, "See repair prices")}
  ${teaser("New boilers", "Fixed-price replacements with a ten-year warranty.", `${ROOT}services`, "See installation prices")}
  ${teaser("Heat pumps", "Air source heat pumps designed and fitted by our renewables team.", `${ROOT}services`, "See heat pump prices")}
</div></section>
<section class="${c.section}"><h2 class="${c.sectionTitle}">What our customers say</h2>${reviews}</section>
<section class="${c.section}"><h2 class="${c.sectionTitle}">Our branches</h2><ul>${branches}</ul><p><a href="${ROOT}branches">Opening hours and directions</a></p></section>
${quoteDrawer(c, ids, state.mode)}`;
  return sitePage({ state, context, title: "Heating engineers and plumbers", section: "home", main, pageScript: quoteScript(ids, c, `${ROOT}quote/received`) });
}
