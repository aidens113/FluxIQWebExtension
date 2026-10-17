import type { ScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { peopleRecords, STORE_AT_START } from "../records.js";
import type { PeopleQuery } from "../search/index.js";
import { arrivalSteps } from "./arrival-steps.js";

/** The Netherlands as the location filter names it: the country, which covers every Dutch city and neither American Rotterdam. */
const NETHERLANDS = "102890719";

/** "data engineer", second degree, anywhere in the Netherlands: 32 people over four pages. */
const NETHERLANDS_ENGINEERS: PeopleQuery = { keywords: "data engineer", network: ["S"], geo: [NETHERLANDS], company: [], page: 1 };

const ORGANIC_RESULTS = `li[data-urn^="urn:gl:member:"]:not([data-ad-slot])`;
const ORGANIC_RESULTS_SHOWN = `section[aria-label="Search results"] ul[role="list"]:has(> ${ORGANIC_RESULTS})`;
const VISIBLE_SHOW_RESULTS = `div:text-is("Show results") >> visible=true`;
const FIELDS = {
  name: `a[href*="/in/"] span[aria-hidden="true"]`,
  headline: ":scope > div:nth-child(2) > div:nth-child(2)",
  location: ":scope > div:nth-child(2) > div:nth-child(3)",
};

/**
 * Every second-degree data engineer in the Netherlands, read across all four
 * pages: the people search's own match list, each person once in the order
 * the search first shows them. The country is one of the locations the
 * filter offers before anything is typed, so no typeahead is needed; what
 * makes the read hard is the length. Page 1 carries the advertisement and
 * Sanne de Wit promoted, who is also an organic result here; page 2 carries
 * Lars Hoekstra promoted, also organic, on page 3; pages 3 and 4 each open
 * with the last person of the page before.
 */
export const netherlandsEngineersWorkflow: ScenarioWorkflow = {
  id: "netherlands-engineers",
  recordingDescription: "Demonstrates a country-wide people search read across four pages.",
  description: "Search people for data engineer, narrow to second-degree connections anywhere in the Netherlands, and read every result across every page, each person once and no promoted entry.",
  recordingScript: [
    ...arrivalSteps("nl"),
    { id: "nl-type-keywords", operation: "type", target: "role:combobox:Search", value: NETHERLANDS_ENGINEERS.keywords },
    { id: "nl-submit-search", operation: "press", target: "role:combobox:Search", value: "Enter" },
    { id: "nl-all-results-shown", operation: "waitForState", target: "role:link:See all people results", timeoutMs: 5000 },
    { id: "nl-open-people-results", operation: "click", target: "role:link:See all people results" },
    { id: "nl-open-connections", operation: "click", target: `div[tabindex="0"]:text-is("Connections ▾")` },
    { id: "nl-choose-second-degree", operation: "check", target: "role:checkbox:2nd", value: true },
    { id: "nl-apply-connections", operation: "click", target: VISIBLE_SHOW_RESULTS },
    { id: "nl-second-degree-shown", operation: "waitForState", target: ORGANIC_RESULTS_SHOWN, timeoutMs: 6000 },
    { id: "nl-open-locations", operation: "click", target: `div[tabindex="0"]:text-is("Locations ▾")` },
    { id: "nl-choose-netherlands", operation: "check", target: "role:checkbox:Netherlands", value: true },
    { id: "nl-apply-locations", operation: "click", target: VISIBLE_SHOW_RESULTS },
    { id: "nl-netherlands-shown", operation: "waitForState", target: ORGANIC_RESULTS_SHOWN, timeoutMs: 6000 },
    {
      id: "extract-netherlands-engineers", operation: "extract", target: ORGANIC_RESULTS, fields: FIELDS,
      pagination: { mode: "numbered", pages: `section[aria-label="Search results"] li > button`, maxPages: 5 },
    },
    { id: "nl-engineers-extracted", operation: "checkpoint" },
  ],
  expected: {
    pageFacts: [{ id: "nl-starts-with-original-invitations", subject: "invitation-store", predicate: "text", value: STORE_AT_START }],
    extracted: [{ step: "extract-netherlands-engineers", count: 32, records: peopleRecords(NETHERLANDS_ENGINEERS), pages: 4 }],
    finalState: [{ id: "nl-search-changes-nothing", subject: "invitation-store", predicate: "text", value: STORE_AT_START }],
    allowedConsoleErrors: ["status of 429"],
  },
};
