import { escapeHtml, page } from "../../html.js";
import { councilTaxBand, formatPrice, PROPERTY_ROOT } from "./format.js";
import { agentLine, attributes, PROPERTY_STYLE } from "./markup.js";
import type { PropertyListing } from "./types.js";

/**
 * One home's own page, served by the `route` hook at the card's link.
 *
 * Three of its facts appear nowhere on the results card and only here: the
 * tenure, the council tax band, and the EPC rating. A run that wants them for
 * a home it found in a search has to open the home, which is what makes this a
 * two-page read rather than a list read.
 *
 * A new build has no council tax band until it is first occupied, so its row
 * is absent from the key facts rather than empty: the answer for that home is
 * that there is no band, not that the band is blank.
 */
export function listingPageMarkup(listing: PropertyListing): string {
  const band = councilTaxBand(listing);
  const body = `<main class="listing" data-testid="listing-detail">
  <nav aria-label="Breadcrumb"><a data-testid="back-to-results" href="${PROPERTY_ROOT}">Back to search results</a></nav>
  <p class="price">${formatPrice(listing.priceGbp)}</p>
  <h1 class="address">${escapeHtml(listing.address)}</h1>
  ${attributes(listing)}
  <p class="reference"><span class="label">Reference</span> <span class="reference-code">${listing.reference}</span></p>
  <h2>Key facts</h2>
  <dl class="key-facts">
    <dt>Tenure</dt><dd class="tenure">${escapeHtml(listing.tenure)}</dd>
    ${band === undefined ? "" : `<dt>Council tax</dt><dd class="council-tax">${band}</dd>`}
    <dt>EPC rating</dt><dd class="epc">${listing.epcRating}</dd>
    <dt>Local authority</dt><dd class="local-authority">${escapeHtml(listing.area)} District Council</dd>
  </dl>
  <h2>About this home</h2>
  <p class="description">${escapeHtml(description(listing))}</p>
  ${agentLine(listing)}
</main>
<style>${PROPERTY_STYLE}</style>`;
  return page(`${listing.address} | Harbourline Property`, body, "");
}

function description(listing: PropertyListing): string {
  const build = listing.newBuild ? "newly built" : "well kept";
  return `A ${build} ${listing.propertyType.toLowerCase()} on a quiet street in ${listing.area},`
    + ` arranged over the usual layout for the area and ready to view by appointment.`;
}
