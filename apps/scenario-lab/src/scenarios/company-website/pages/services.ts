import { escapeHtml } from "../../../html.js";
import type { RenderContext } from "../../../types.js";
import { servicesScript } from "../client/index.js";
import { COMPANY, PRICE_LIST, priceText, type PriceBasis } from "../data/index.js";
import { generatedId, siteClasses, type SiteClasses } from "../styles.js";
import type { CompanyWebsiteState } from "../types.js";
import { sitePage } from "./shell.js";

/**
 * "Services & prices". The price list is not in the document the server
 * sends: skeleton rows hold its place while the page's script fetches it, and
 * the VAT switch -- two `div`s -- fetches it again and redraws every table,
 * so rows read before a switch are gone after it.
 */
export function renderServices(state: CompanyWebsiteState, context: RenderContext): string {
  const c = siteClasses(context.seed);
  const id = (name: string) => generatedId(context.seed, `services:${name}`);
  const ids = { list: id("list"), vat: id("vat") };
  const skeleton = Array.from({ length: 6 }, () => `<div class="${c.skeletonLine}"></div>`).join("");
  const main = `<h1 class="${c.sectionTitle}" style="font-size:2rem">Services &amp; prices</h1>
<p class="${c.lead}">Fixed prices for most jobs, agreed before we start. Homeowner prices include VAT at 20%. Landlords and businesses can see our prices excluding VAT.</p>
<div class="${c.vatSwitch}" id="${ids.vat}"><div class="${c.vatOption} ${c.vatActive}" data-basis="inc">Homeowners (inc. VAT)</div><div class="${c.vatOption}" data-basis="ex">Landlords &amp; business (ex. VAT)</div></div>
<p class="${c.muted}">Heat pump installations carry 0% VAT. Partner products are provided and priced by our partners.</p>
<div id="${ids.list}" aria-busy="true">${skeleton}</div>
<p class="${c.muted}">Not sure what you need? <span class="${c.linkButton}" data-open-quote>Get a free quote</span> and we will tell you.</p>`;
  return sitePage({ state, context, title: "Services and prices", section: "services", main, pageScript: servicesScript(ids, c, `${COMPANY.root}services/prices`) });
}

/**
 * The price list as its endpoint returns it on one basis: one accordion per
 * category, each a table whose rows are the services with any partner advert
 * slotted in among them. Every category arrives collapsed except the first;
 * the page's script keeps whichever the visitor has opened open.
 */
export function priceListFragment(c: SiteClasses, basis: PriceBasis): string {
  return PRICE_LIST.map((category, index) => {
    const rows = category.rows.map((entry) => entry.partner
      ? `<tr class="${c.partnerRow}"><th scope="row">${escapeHtml(entry.name)}<span class="${c.sponsoredTag}">Sponsored</span></th><td>${escapeHtml(entry.detail)}</td><td class="${c.priceCell}">${escapeHtml(priceText(entry, basis))}</td></tr>`
      : `<tr><th scope="row">${escapeHtml(entry.name)}</th><td>${escapeHtml(entry.detail)}</td><td class="${c.priceCell}">${escapeHtml(priceText(entry, basis))}</td></tr>`).join("");
    const open = index === 0;
    return `<section class="${c.accordion}" data-category="${category.id}"><button type="button" class="${c.accordionHead}" aria-expanded="${open}"><span>${escapeHtml(category.title)}</span><span aria-hidden="true">${open ? "&minus;" : "+"}</span></button><div class="${c.accordionBody}"${open ? "" : " hidden"}><table class="${c.priceTable}"><thead><tr><th>Service</th><th>What is included</th><th>Price</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
  }).join("");
}
