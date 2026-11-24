import type { JsonObject } from "fluxiq/core";
import { scriptedTaskProcess } from "../../attempt-lane/scripted-model/scripts/index.js";

// Test fixtures, never model guidance: each written task's own conditions, order and columns as a processing
// declaration, naming the columns its instruction names. A task the scripted fixtures already declare keeps that one
// declaration (`scriptedTaskProcess`); these are the campaign tasks it does not cover. Nothing here is fitted to a run.
const DECLARATIONS: Readonly<Record<string, JsonObject>> = Object.freeze({
  // "Brightaisle Plus eligible, rated 4.0 or higher and priced under $50 ... Leave out sponsored placements and
  // accessories such as ear tips or charging cases ... keep the order the search results show them in."
  "everything-store-plus-earbuds-under-50": {
    where: [
      { field: "brightaisle_plus", is: "present" },
      { field: "rating", atLeast: 4 },
      { field: "price", lessThan: 50 },
      { field: "data-ad-id", is: "absent" },
      { field: "name", matches: "^(replacement )?(ear ?tips|charging case)\\b", not: true },
    ],
    columns: ["name", "price", "rating", "url"],
  },
  // "fully remote and based in the UK and offers Easily apply ... leave out any whose posting shows no salary ...
  // columns title, company and salary ... newest posting first, and where two postings show the same posting date,
  // in the order Rolefinch's results list them." The tag column has no site key, so it is named by the key every
  // recorded read wrote for it; its condition is the site's own words.
  "job-board-remote-easy-apply": {
    where: [
      { field: "location", equals: "Remote (UK)" },
      // Shown on the card or not: a card without the tag is a known no, and the tag shown must say Easily apply.
      { field: "easilyApply", is: "present" },
      { field: "easilyApply", contains: "Easily apply" },
      { field: "salary", is: "present" },
    ],
    sort: [{ field: "posted", order: "desc", as: "date" }],
    columns: ["title", "company", "salary"],
  },
  // "collect every person the search returns ... Leave out anything marked as promoted, and list each person once,
  // at the first place they appear among the remaining results, in the order the search shows them."
  "professional-network-netherlands-data-engineers": {
    where: [{ field: "data-ad-slot", is: "absent" }],
    columns: ["name", "headline", "location"],
  },
  // "every photo or carousel published in August 2026 with more than 1,300 likes, newest first, as a table with
  // columns date and likes."
  "photo-social-august-over-1300": {
    where: [
      { field: "date", atLeast: "2026-08-01", atMost: "2026-08-31", as: "date" },
      { field: "likes", greaterThan: 1300 },
    ],
    sort: [{ field: "date", order: "desc", as: "date" }],
    columns: ["date", "likes"],
  },
});

/** The declaration a task's recorded-oracle proof applies; an undeclared task is refused, never processed with nothing. */
export function recordedOracleTaskProcess(taskId: string): JsonObject {
  if (Object.hasOwn(DECLARATIONS, taskId)) return structuredClone(DECLARATIONS[taskId]!);
  try { return scriptedTaskProcess(taskId); }
  catch (error) { throw new Error("recorded_oracle_declaration_missing", { cause: error }); }
}
