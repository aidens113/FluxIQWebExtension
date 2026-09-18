import { escapeHtml, page } from "../../html.js";
import { COMPANY_ROOT, sectorLabel } from "./format.js";
import { COMPANY_STYLE } from "./markup.js";
import type { CompanyEntry, CompanyVariant } from "./types.js";

/**
 * One company's profile, served by the `route` hook at its link in the table.
 *
 * Four of its facts appear nowhere in the register table and only here: the
 * year it was founded, its website, its telephone number and its registered
 * office. A run that wants any of them for a company it found in the table has
 * to open the company, which is what makes an enrichment a page visit per row
 * rather than one read of a list.
 *
 * A company that has never filed a headcount has no Employees row at all, so
 * the answer for it is that there is no figure rather than that the figure is
 * blank.
 */
export function companyProfileMarkup(entry: CompanyEntry, variant: CompanyVariant): string {
  const employees = entry.employeeBand === undefined ? "" : `<dt>Employees</dt><dd class="employees">${entry.employeeBand}</dd>`;
  const body = `<main class="profile" data-testid="company-profile">
  <nav aria-label="Breadcrumb"><a data-testid="back-to-register" href="${COMPANY_ROOT}">Back to the register</a></nav>
  <h1 class="company-name">${escapeHtml(entry.name)}</h1>
  <p class="strapline">An entry in the Northbank Business Register, kept by the county chamber of commerce.</p>
  <h2>Company details</h2>
  <dl class="profile-facts">
    <dt>Sector</dt><dd class="sector">${escapeHtml(sectorLabel(entry.sector, variant))}</dd>
    <dt>Location</dt><dd class="location">${escapeHtml(entry.location)}</dd>
    ${employees}
    <dt>Founded</dt><dd class="founded">${entry.founded}</dd>
    <dt>Website</dt><dd class="website">${escapeHtml(entry.website)}</dd>
    <dt>Telephone</dt><dd class="telephone">${escapeHtml(entry.telephone)}</dd>
    <dt>Registered office</dt><dd class="registered-office">${escapeHtml(entry.registeredOffice)}</dd>
  </dl>
</main>
<style>${COMPANY_STYLE}</style>`;
  return page(`${entry.name} | Northbank Business Register`, body, "");
}
