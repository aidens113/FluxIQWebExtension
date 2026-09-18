import { companyEntries, companySectors } from "./companies.js";
import { letterOf, sectorCode, sectorLabel } from "./format.js";
import { COMPANY_LETTERS, COMPANY_SIZE_OPTIONS } from "./options.js";
import type { CompanyBrowse, CompanyEntry, CompanyResults, CompanyVariant } from "./types.js";

/** Entries per page of the register. */
export const COMPANY_PAGE_SIZE = 15;

const MAX_QUERY_LENGTH = 60;

/** The whole register from the top: what the front page opens on. */
export function defaultCompanyBrowse(): CompanyBrowse {
  return { page: 1, letter: "", sector: "", size: "", query: "" };
}

/** Coerces untrusted browse input: a whole page from 1, a letter and a sector the register has, a size the filter offers, and a bounded query. */
export function normalizeCompanyBrowse(input: { page: unknown; letter: unknown; sector: unknown; size: unknown; query: unknown }): CompanyBrowse {
  const page = typeof input.page === "number" && Number.isSafeInteger(input.page) && input.page >= 1 ? input.page : 1;
  const letter = typeof input.letter === "string" ? input.letter.toUpperCase() : "";
  const sector = typeof input.sector === "string" ? input.sector : "";
  return {
    page,
    letter: COMPANY_LETTERS.includes(letter) ? letter : "",
    sector: companySectors.some((candidate) => sectorCode(candidate) === sector) ? sector : "",
    size: COMPANY_SIZE_OPTIONS.some((option) => option.value === input.size && option.value !== "") ? String(input.size) : "",
    query: typeof input.query === "string" ? input.query.trim().slice(0, MAX_QUERY_LENGTH) : "",
  };
}

/** Applies the A-Z letter, the sector, the size band and the search, then pages what is left, clamping the page to the last one. */
export function browseCompanies(browse: CompanyBrowse): CompanyResults {
  const matches = allMatchingCompanies(browse);
  const pageCount = Math.max(1, Math.ceil(matches.length / COMPANY_PAGE_SIZE));
  const page = Math.min(browse.page, pageCount);
  const start = (page - 1) * COMPANY_PAGE_SIZE;
  return {
    browse: { ...browse, page },
    matchCount: matches.length,
    pageCount,
    entries: matches.slice(start, start + COMPANY_PAGE_SIZE),
  };
}

/** Every entry a browse matches, in the register's order and across every page: what a read that follows pagination to its end collects. */
export function allMatchingCompanies(browse: CompanyBrowse): readonly CompanyEntry[] {
  const band = COMPANY_SIZE_OPTIONS.find((option) => option.value === browse.size)?.band;
  const needle = browse.query.toLowerCase();
  return companyEntries.filter((entry) =>
    (browse.letter === "" || letterOf(entry) === browse.letter)
    && (browse.sector === "" || sectorCode(entry.sector) === browse.sector)
    && (band === undefined || entry.employeeBand === band)
    && (needle === "" || entry.name.toLowerCase().includes(needle)));
}

/** The count above the table. */
export function companyCountText(matchCount: number): string {
  return `${matchCount} compan${matchCount === 1 ? "y" : "ies"} listed`;
}

export function companyPageStatusText(page: number, pageCount: number): string {
  return `Page ${page} of ${pageCount}`;
}

/**
 * What the register is showing, in the words the controls use, or nothing when
 * the whole register is showing. The sector is named as the armed rendering
 * names it, because the summary repeats what the visitor clicked.
 */
export function browseSummaryText(browse: CompanyBrowse, variant: CompanyVariant): string | undefined {
  const named = companySectors.find((candidate) => sectorCode(candidate) === browse.sector);
  const parts = [
    browse.letter === "" ? undefined : `Letter ${browse.letter}`,
    browse.sector === "" || named === undefined ? undefined : sectorLabel(named, variant),
    browse.size === "" ? undefined : COMPANY_SIZE_OPTIONS.find((option) => option.value === browse.size)?.label,
    browse.query === "" ? undefined : `Search "${browse.query}"`,
  ].filter((part): part is string => part !== undefined && part !== "");
  return parts.length === 0 ? undefined : `Showing: ${parts.join(" \u00b7 ")}`;
}
