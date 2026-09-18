import { browseCompanies, defaultCompanyBrowse, normalizeCompanyBrowse } from "./browse.js";
import { companyEntries } from "./companies.js";
import { companyVariants, type CompanyDirectoryState, type CompanyResults, type CompanyVariant } from "./types.js";

const HISTORY_LIMIT = 50;

/** The register as it ships, showing the whole of itself from the top. The lab seed reaches none of it (see `companies.ts`). */
export function createCompanyState(): CompanyDirectoryState {
  return withResults({ variant: "baseline", browseHistory: [], profileViews: [] }, browseCompanies(defaultCompanyBrowse()));
}

/**
 * `show` records a browse the page served; `set-variant` arms a rendering
 * (`baseline` restores) and returns the register to the top, which is where a
 * run begins; `view-profile` records a profile that was opened. Any other
 * operation, or a payload the page could not have sent, leaves the state
 * unchanged.
 */
export function mutateCompanyState(state: CompanyDirectoryState, operation: string, payload: unknown): CompanyDirectoryState {
  if (!isRecord(payload)) return state;
  if (operation === "show") {
    const results = browseCompanies(normalizeCompanyBrowse({
      page: payload.page, letter: payload.letter, sector: payload.sector, size: payload.size, query: payload.query,
    }));
    return { ...withResults(state, results), browseHistory: [...state.browseHistory, results.browse].slice(-HISTORY_LIMIT) };
  }
  const variant = payload.variant;
  if (operation === "set-variant" && isCompanyVariant(variant)) {
    return withResults({ ...state, variant }, browseCompanies(defaultCompanyBrowse()));
  }
  const slug = payload.slug;
  if (operation === "view-profile" && typeof slug === "string" && companyEntries.some((entry) => entry.slug === slug)) {
    return { ...state, profileViews: [...state.profileViews, slug].slice(-HISTORY_LIMIT) };
  }
  return state;
}

function withResults(state: Omit<CompanyDirectoryState, "browse" | "oracle">, results: CompanyResults): CompanyDirectoryState {
  return {
    ...state,
    browse: results.browse,
    oracle: {
      matchCount: results.matchCount,
      pageCount: results.pageCount,
      slugs: results.entries.map((entry) => entry.slug),
    },
  };
}

function isCompanyVariant(value: unknown): value is CompanyVariant {
  return typeof value === "string" && (companyVariants as readonly string[]).includes(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
