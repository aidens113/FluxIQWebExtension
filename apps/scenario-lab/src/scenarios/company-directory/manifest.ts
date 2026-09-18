import { createScenarioManifest } from "../../types.js";
import { allMatchingCompanies, browseCompanies, browseSummaryText, companyCountText, COMPANY_PAGE_SIZE, companyPageStatusText, defaultCompanyBrowse } from "./browse.js";
import { companyEntries } from "./companies.js";
import { profilePath, sectorCode, RENAMED_SECTOR } from "./format.js";
import { enrichmentRecords, profileRecords, registerRecords } from "./records.js";
import type { CompanyBrowse, CompanyEntry, CompanyVariant } from "./types.js";

/** Every row of the register, the first of them, its profile link, and a profile page, addressed as the page presents them rather than by a test hook. */
const REGISTER_ROWS = "table.register tbody > tr";
const FIRST_ROW_LINK = "table.register tbody > tr:first-child .company-link";
const PROFILE_PAGE = "main.profile";

/**
 * What a person copying the register into a table would take from each row,
 * read by the column headings rather than by position, so a reordered table
 * still yields the same columns. The headcount is read as the element it is,
 * because a company that has filed none has an empty cell, and a column read
 * of an empty cell is blank text rather than no value.
 */
const registerFields = {
  name: "column:Company",
  sector: "column:Sector",
  location: "column:Location",
  employees: ".employees",
  url: ".company-link@href",
};

/** The same four values read by the words in the row rather than by the headings above it. */
const rowFields = {
  name: ".company-link",
  sector: ".sector",
  location: ".location",
  employees: ".employees",
};

/** What a company's own profile yields. Founded, the website and the telephone number appear in no column of the register. */
const profileFields = {
  name: ".company-name",
  sector: ".sector",
  employees: ".employees",
  founded: ".founded",
  website: ".website",
  telephone: ".telephone",
};

/** The two facts a per-row enrichment goes to a profile for. */
const enrichmentFields = {
  name: ".company-name",
  founded: ".founded",
  website: ".website",
};

const followNext = { next: "testid:next-page", maxPages: 8 };

const browse = (overrides: Partial<CompanyBrowse>): CompanyBrowse => ({ ...defaultCompanyBrowse(), ...overrides });
const LOGISTICS = browse({ sector: sectorCode(RENAMED_SECTOR.from) });
const NO_COMPANIES = browse({ sector: "independent-retail", size: "1001-plus" });
const SEARCHED_NAME = "Quarrendon Software";
const BY_NAME = browse({ query: SEARCHED_NAME });

const OPENING_PAGE = browseCompanies(defaultCompanyBrowse());
const LOGISTICS_MATCHES = allMatchingCompanies(LOGISTICS);
const SEARCHED = allMatchingCompanies(BY_NAME);
const ENRICHED = OPENING_PAGE.entries.slice(0, 3);

const pagesFor = (matchCount: number) => Math.max(1, Math.ceil(matchCount / COMPANY_PAGE_SIZE));
const listed = (matchCount: number) => ({ id: "result-count", subject: "result-count", predicate: "text", value: companyCountText(matchCount) });
const pageStatus = (page: number, pageCount: number) => ({ id: "page-status", subject: "page-status", predicate: "text", value: companyPageStatusText(page, pageCount) });
const lastPage = (matchCount: number) => pageStatus(pagesFor(matchCount), pagesFor(matchCount));
const showing = (applied: CompanyBrowse, variant: CompanyVariant) => ({ id: "browse-summary", subject: "browse-summary", predicate: "text", value: browseSummaryText(applied, variant) ?? "" });
const nextAbsent = { id: "next-absent", subject: "next-page", predicate: "exists", value: false };
const backOnRegister = { id: "back-on-register", subject: "company-rows", predicate: "exists", value: true };
const profileOpen = { id: "profile-open", subject: "company-profile", predicate: "exists", value: true };
const onProfilePage = (entry: CompanyEntry) => ({ id: "on-profile-page", subject: "document", predicate: "path", value: profilePath(entry) });

const enrichedRecords = enrichmentRecords(ENRICHED);

/**
 * One row of the per-row enrichment: open company `position + 1` in the
 * register, read the two facts the table has no column for, and come back
 * before the next one. The steps are generated because the three rows differ
 * in one number, and three hand-written copies would be three places for that
 * number to be wrong.
 */
function enrichmentRow(position: number) {
  const entry = ENRICHED[position];
  const record = enrichedRecords[position];
  if (!entry || !record) throw new Error(`company-directory: the register's first page has no company ${position + 1}`);
  const ordinal = position + 1;
  return {
    steps: [
      { id: `open-company-${ordinal}`, operation: "click" as const, target: `table.register tbody > tr:nth-child(${ordinal}) .company-link` },
      { id: `company-${ordinal}-open`, operation: "waitForState" as const, target: "testid:company-profile", timeoutMs: 3000 },
      { id: `extract-company-${ordinal}-details`, operation: "extract" as const, target: PROFILE_PAGE, fields: enrichmentFields },
      { id: `leave-company-${ordinal}`, operation: "click" as const, target: "testid:back-to-register" },
      { id: `register-after-company-${ordinal}`, operation: "waitForState" as const, target: "testid:company-rows", timeoutMs: 3000 },
    ],
    expected: { step: `extract-company-${ordinal}-details`, count: 1, records: [record] },
  };
}

const ENRICHMENT = [0, 1, 2].map(enrichmentRow);

/**
 * A regional business register at the size of a real one: 320 companies over
 * eight sectors, fifteen to a page, an A-Z index and a sector list that browse
 * it, a name search and a size band that filter it, and a profile per company
 * carrying four facts the table has no column for.
 *
 * Five workflows, every one of which has to build and run a real automation.
 * The primary one reads the register's first page by its column headings.
 * `sector-sweep` opens one sector and follows pagination to its end.
 * `no-companies` asks for a size no company in that sector has and must return
 * nothing. `profile-lookup` searches for a company, opens it, and reads the
 * facts only its profile has. `enrich-register` does that for each of the
 * first three companies in turn, one page visit per row.
 *
 * Every expected record is built from the authored register with the page's
 * own formatting, so a change to the register has to be reviewed here.
 */
export const companyDirectoryManifest = createScenarioManifest({
  id: "company-directory",
  title: "Company directory",
  tags: ["directory", "extraction", "pagination", "table", "profile-page", "scraping"],
  seed: 163,
  startPath: "/scenarios/company-directory/",
  capabilities: ["navigation", "forms", "mutation"],
  playbackGoal: {
    id: "last-page-of-logistics",
    description: "Show the last page of the companies filed under the Logistics sector.",
    successFacts: [showing(LOGISTICS, "baseline"), lastPage(LOGISTICS_MATCHES.length), nextAbsent],
  },
  recordingScript: [
    { id: "extract-first-register-page", operation: "extract", target: REGISTER_ROWS, fields: registerFields },
    { id: "first-register-page-extracted", operation: "checkpoint" },
  ],
  expected: {
    pageFacts: [listed(companyEntries.length), pageStatus(1, OPENING_PAGE.pageCount)],
    actions: [{ action: "web.dom.extract_list" }],
    extracted: [{
      step: "extract-first-register-page",
      count: COMPANY_PAGE_SIZE,
      records: registerRecords(OPENING_PAGE.entries, "baseline", true),
      optionalFields: ["employees"],
    }],
    finalState: [listed(companyEntries.length), pageStatus(1, OPENING_PAGE.pageCount)],
    allowedConsoleErrors: [],
  },
  workflows: [
    {
      id: "sector-sweep",
      description: "Open the Logistics sector and collect every company filed under it by following the pagination control until it is gone.",
      recordingScript: [
        { id: "open-logistics-sector", operation: "click", target: `testid:sector-${sectorCode(RENAMED_SECTOR.from)}` },
        { id: "sector-shown", operation: "waitForState", target: "testid:browse-summary", timeoutMs: 3000 },
        { id: "extract-sector-companies", operation: "extract", target: REGISTER_ROWS, fields: rowFields, pagination: followNext },
        { id: "sector-companies-extracted", operation: "checkpoint" },
      ],
      expected: {
        pageFacts: [listed(companyEntries.length), pageStatus(1, OPENING_PAGE.pageCount)],
        recordingEvents: [{ type: "web.element.clicked" }],
        actions: [{ action: "web.dom.click", outcome: "succeeded" }, { action: "web.dom.extract_list" }],
        extracted: [{
          step: "extract-sector-companies",
          count: LOGISTICS_MATCHES.length,
          records: registerRecords(LOGISTICS_MATCHES, "baseline"),
          pages: pagesFor(LOGISTICS_MATCHES.length),
          optionalFields: ["employees"],
        }],
        finalState: [showing(LOGISTICS, "baseline"), listed(LOGISTICS_MATCHES.length), lastPage(LOGISTICS_MATCHES.length), nextAbsent],
        allowedConsoleErrors: [],
      },
      variants: [
        {
          id: "relabelled-columns",
          description: "The table was relabelled and reordered: Sector is headed \"Industry\", Employees \"Team size\", and Location now comes before the industry. Every value is the value it was, so the same companies must still be collected under the same column names.",
          arm: { operation: "set-variant", payload: { variant: "relabelled-columns" } },
          expected: {
            pageFacts: [
              { id: "industry-heading", subject: "register", predicate: "contains", value: "Industry" },
              { id: "size-heading", subject: "register", predicate: "contains", value: "Team size" },
              listed(companyEntries.length),
            ],
            finalState: [showing(LOGISTICS, "relabelled-columns"), listed(LOGISTICS_MATCHES.length), lastPage(LOGISTICS_MATCHES.length), nextAbsent],
          },
        },
        {
          id: "resectored",
          description: `The register renamed the sector: Logistics is now "${RENAMED_SECTOR.to}", in the sector list and in every row. The recorded click has nothing to land on until it is re-pointed at the renamed link, which is the same sector under a new name.`,
          arm: { operation: "set-variant", payload: { variant: "resectored" } },
          expected: {
            pageFacts: [
              { id: "old-sector-link-gone", subject: `sector-${sectorCode(RENAMED_SECTOR.from)}`, predicate: "exists", value: false },
              { id: "renamed-sector-link", subject: `sector-${sectorCode(RENAMED_SECTOR.to)}`, predicate: "text", value: RENAMED_SECTOR.to },
            ],
            extracted: [{
              step: "extract-sector-companies",
              count: LOGISTICS_MATCHES.length,
              records: registerRecords(LOGISTICS_MATCHES, "resectored"),
              pages: pagesFor(LOGISTICS_MATCHES.length),
              optionalFields: ["employees"],
            }],
            finalState: [showing(LOGISTICS, "resectored"), listed(LOGISTICS_MATCHES.length), lastPage(LOGISTICS_MATCHES.length), nextAbsent],
          },
        },
      ],
    },
    {
      id: "no-companies",
      description: "Ask the independent retail sector for companies of a thousand staff or more, which none of them has, and report that nothing matched rather than the nearest thing to it.",
      recordingScript: [
        { id: "open-retail-sector", operation: "click", target: "testid:sector-independent-retail" },
        { id: "retail-shown", operation: "waitForState", target: "testid:browse-summary", timeoutMs: 3000 },
        { id: "choose-largest-size", operation: "select", target: "testid:size-filter", value: "1001-plus" },
        { id: "run-size-search", operation: "click", target: "testid:search-submit" },
        { id: "no-companies-shown", operation: "waitForState", target: "testid:empty-results", timeoutMs: 3000 },
        // The right answer here is an empty table, which an extract step refuses unless it declares minItems: 0 (D4).
        { id: "extract-no-companies", operation: "extract", target: REGISTER_ROWS, fields: rowFields, minItems: 0 },
        { id: "no-companies-extracted", operation: "checkpoint" },
      ],
      expected: {
        actions: [{ action: "web.dom.click", outcome: "succeeded" }, { action: "web.dom.select", outcome: "succeeded" }],
        extracted: [{ step: "extract-no-companies", count: 0, records: [] }],
        finalState: [
          showing(NO_COMPANIES, "baseline"),
          listed(0),
          { id: "no-companies", subject: "empty-results", predicate: "contains", value: "No companies match this search." },
        ],
        allowedConsoleErrors: [],
      },
    },
    {
      id: "profile-lookup",
      description: `Find ${SEARCHED_NAME} in the register, open its profile, and read the year it was founded, its website and its telephone number, none of which the table has a column for.`,
      recordingScript: [
        { id: "type-company-name", operation: "type", target: "testid:search-input", value: SEARCHED_NAME },
        { id: "run-name-search", operation: "click", target: "testid:search-submit" },
        { id: "name-results-shown", operation: "waitForState", target: "testid:browse-summary", timeoutMs: 3000 },
        { id: "open-company-profile", operation: "click", target: FIRST_ROW_LINK },
        { id: "company-profile-open", operation: "waitForState", target: "testid:company-profile", timeoutMs: 3000 },
        { id: "extract-company-profile", operation: "extract", target: PROFILE_PAGE, fields: profileFields },
        { id: "company-profile-extracted", operation: "checkpoint" },
      ],
      expected: {
        recordingEvents: [{ type: "web.element.input_changed" }, { type: "web.element.clicked" }],
        actions: [{ action: "web.dom.type", outcome: "succeeded" }, { action: "web.dom.click", outcome: "succeeded" }],
        extracted: [{
          step: "extract-company-profile",
          count: 1,
          records: profileRecords(SEARCHED, "baseline"),
          optionalFields: ["employees"],
        }],
        finalState: [onProfilePage(searchedCompany()), profileOpen],
        allowedConsoleErrors: [],
      },
    },
    {
      id: "enrich-register",
      description: "For each of the first three companies in the register, open its profile, read the year it was founded and its website, and return to the register before the next one.",
      recordingScript: [
        ...ENRICHMENT.flatMap(({ steps }) => steps),
        { id: "enrichment-done", operation: "checkpoint" },
      ],
      expected: {
        recordingEvents: [{ type: "web.element.clicked" }],
        actions: [{ action: "web.dom.click", outcome: "succeeded" }, { action: "web.dom.extract_list" }],
        extracted: ENRICHMENT.map(({ expected }) => expected),
        finalState: [backOnRegister, listed(companyEntries.length)],
        allowedConsoleErrors: [],
      },
    },
  ],
});

/** The one company the name search returns; a register without it would be a defect in the authored data, not a run. */
function searchedCompany(): CompanyEntry {
  const entry = SEARCHED[0];
  if (!entry || SEARCHED.length !== 1) throw new Error(`company-directory: the register must hold exactly one ${SEARCHED_NAME}`);
  return entry;
}
