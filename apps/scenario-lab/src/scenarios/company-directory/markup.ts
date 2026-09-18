import { escapeHtml } from "../../html.js";
import { browseSummaryText, companyCountText, companyPageStatusText } from "./browse.js";
import { companyEntries, companySectors } from "./companies.js";
import { letterOf, profilePath, registerColumns, sectorCode, sectorLabel, type RegisterColumn } from "./format.js";
import { COMPANY_LETTERS, COMPANY_SIZE_OPTIONS } from "./options.js";
import type { CompanyEntry, CompanyResults, CompanyVariant } from "./types.js";

/** The register's stylesheet, which the front page and every profile share. */
export const COMPANY_STYLE = `
  .register-search { display: flex; flex-wrap: wrap; gap: .75rem; align-items: end; margin: 0 0 .75rem; }
  .register-search .field { display: grid; gap: .15rem; }
  .alphabet { display: flex; flex-wrap: wrap; gap: .35rem; margin: 0 0 .75rem; }
  .alphabet a, .alphabet span { padding: 0 .35rem; }
  .alphabet span { color: #9aa4b1; }
  .sectors ul { list-style: none; display: flex; flex-wrap: wrap; gap: .75rem; padding: 0; }
  .sectors li { display: inline; }
  table.register { border-collapse: collapse; width: 100%; }
  table.register th, table.register td { border-bottom: 1px solid #e2e7ee; padding: .35rem .5rem; text-align: left; vertical-align: top; }
  table.register th { color: #55616f; font-weight: 600; }
  .profile-facts { display: grid; grid-template-columns: max-content 1fr; gap: .25rem 1rem; }
  .profile-facts dt { color: #6b7684; }
  .profile-facts dd { margin: 0; }
  .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
  [aria-busy="true"] { opacity: .6; }`;

/** The register's front page: the search, the A-Z index, the sector list, and the results region holding the whole register. */
export function companyPageBody(results: CompanyResults, variant: CompanyVariant): string {
  return `<header>
  <p class="brand">Northbank Business Register</p>
  <h1>Company register</h1>
  <p class="strapline">${companyEntries.length} businesses across ${companySectors.length} sectors, kept by the county chamber of commerce.</p>
</header>
<main>
  ${searchForm()}
  ${alphabetIndex()}
  ${sectorList(variant)}
  <section data-testid="results" aria-labelledby="register-heading" aria-busy="false">${companyResultsMarkup(results, variant)}</section>
</main>
<style>${COMPANY_STYLE}</style>`;
}

/** The inside of the results region for one browse. The front page and the `results` route share it. */
export function companyResultsMarkup(results: CompanyResults, variant: CompanyVariant): string {
  const { browse, matchCount, entries } = results;
  const summary = browseSummaryText(browse, variant);
  return [
    `<h2 id="register-heading">Companies</h2>`,
    `<p class="result-count" data-testid="result-count" role="status">${companyCountText(matchCount)}</p>`,
    summary === undefined ? "" : `<p class="browse-summary" data-testid="browse-summary">${escapeHtml(summary)}</p>`,
    entries.length > 0
      ? registerTable(entries, variant)
      : `<p class="no-results" data-testid="empty-results">No companies match this search. Try another sector or a wider size band.</p>`,
    matchCount > 0 ? pagination(results) : "",
  ].join("");
}

/**
 * The register table. Every value a reader wants is an ordinary cell under an
 * ordinary heading -- no cell carries a test hook -- so a read has to go by
 * the column headings or by the words in the row.
 *
 * A company that has never filed a headcount has an empty cell with no element
 * in it, so a read of that value finds nothing rather than finding blank text.
 */
function registerTable(entries: readonly CompanyEntry[], variant: CompanyVariant): string {
  const columns = registerColumns(variant);
  const headings = columns.map((column) => `<th scope="col">${escapeHtml(column.heading)}</th>`).join("");
  const rows = entries.map((entry) => companyRow(entry, columns, variant)).join("");
  return `<table class="register" data-testid="register">
<caption class="sr-only">Companies in the register</caption>
<thead><tr>${headings}</tr></thead>
<tbody data-testid="company-rows">${rows}</tbody>
</table>`;
}

function companyRow(entry: CompanyEntry, columns: readonly RegisterColumn[], variant: CompanyVariant): string {
  const cells = columns.map((column) => cell(entry, column.field, variant)).join("");
  return `<tr class="company" data-company="${entry.slug}">${cells}</tr>`;
}

function cell(entry: CompanyEntry, field: RegisterColumn["field"], variant: CompanyVariant): string {
  if (field === "name") return `<td class="company-cell"><a class="company-link" href="${profilePath(entry)}">${escapeHtml(entry.name)}</a></td>`;
  if (field === "sector") return `<td class="sector">${escapeHtml(sectorLabel(entry.sector, variant))}</td>`;
  if (field === "location") return `<td class="location">${escapeHtml(entry.location)}</td>`;
  return `<td class="employees-cell">${entry.employeeBand === undefined ? "" : `<span class="employees">${entry.employeeBand}</span>`}</td>`;
}

function searchForm(): string {
  const sizes = COMPANY_SIZE_OPTIONS.map((option) => `<option value="${option.value}">${escapeHtml(option.label)}</option>`).join("");
  return `<form class="register-search" role="search" aria-label="Search the register" data-testid="search-form">
  <span class="field"><label for="company-search">Company name</label><input id="company-search" data-testid="search-input" name="q" type="search" autocomplete="off"></span>
  <span class="field"><label for="size-filter">Size</label><select id="size-filter" data-testid="size-filter" name="size" autocomplete="off">${sizes}</select></span>
  <button type="submit" data-testid="search-submit">Search</button>
</form>`;
}

/** The A-Z index. Three letters have no company filed under them, and those are plain text rather than links, as an index shows them. */
function alphabetIndex(): string {
  const filed = new Set(companyEntries.map((entry) => letterOf(entry)));
  const links = COMPANY_LETTERS.map((letter) => filed.has(letter)
    ? `<a data-testid="letter-${letter.toLowerCase()}" data-letter="${letter}" href="?letter=${letter}">${letter}</a>`
    : `<span aria-disabled="true">${letter}</span>`).join("");
  return `<nav class="alphabet" aria-label="A to Z index" data-testid="alphabet">${links}</nav>`;
}

/**
 * The sector list. A sector's link carries its code, which a renaming does not
 * change, while its words and its hook follow the name the register now uses.
 */
function sectorList(variant: CompanyVariant): string {
  const items = companySectors.map((sector) => {
    const label = sectorLabel(sector, variant);
    return `<li><a data-testid="sector-${sectorCode(label)}" data-sector="${sectorCode(sector)}" href="?sector=${sectorCode(sector)}">${escapeHtml(label)}</a></li>`;
  }).join("");
  return `<nav class="sectors" aria-label="Sectors" data-testid="sector-list"><h2>Sectors</h2><ul>${items}</ul></nav>`;
}

function pagination({ browse, pageCount }: CompanyResults): string {
  const status = `<p class="page-status" data-testid="page-status">${companyPageStatusText(browse.page, pageCount)}</p>`;
  const next = browse.page < pageCount
    ? `<button type="button" data-testid="next-page" data-page="${browse.page + 1}">Next</button>`
    : "";
  return `<nav class="pagination" aria-label="Register pages" data-testid="pagination">${status}${next}</nav>`;
}
