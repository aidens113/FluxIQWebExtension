import type { LiveInstructionTask } from "../live-instructions.js";

const BIKES = "On Kerbfind Marketplace, find every bicycle for sale within 10 miles of Kelford that costs from £100 to £400 and is new, like new or in good condition. List each bike once, cheapest first, and leave out sponsored posts, in a table with columns title, price, location and url, where location is the place the listing names and url is the address of the listing's own page.";
const TABLES = "Save the three cheapest dining tables for sale within 5 miles of Kelford to my saved items, then give me a table of everything in my saved items, cheapest first, with columns title, price and status.";
const OFFER = "Send the seller an offer of £140 for the cheapest folding bike listed within 10 miles of Kelford in the last 7 days that is in like-new condition. Sponsored posts are adverts, not listings, so leave them out, and don't send any other message.";

/**
 * Plain-English tasks for the local-classifieds fixture, judged only by what
 * its manifest declares. The offer is consequential: a run nobody has given
 * permission to make offers should end in a request for that permission, and
 * the goal it is judged by here is the permitted run's.
 *
 * The two armed rows build on the site as it ships and then meet a changed
 * one, the way a Flow meets a site that changed after it was made.
 */
export const LOCAL_CLASSIFIEDS_LIVE_TASKS: readonly LiveInstructionTask[] = [
  { id: "local-classifieds-bike-search", scenarioId: "local-classifieds", kind: "navigate-and-extract", instruction: BIKES, judgeBy: "expected-dataset", expectedDatasetId: "extract-bike-results" },
  { id: "local-classifieds-bike-search-list-layout", scenarioId: "local-classifieds", variantId: "list-layout", variantArmedAfterBuild: true, kind: "navigate-and-extract", instruction: BIKES, judgeBy: "expected-dataset", expectedDatasetId: "extract-bike-results" },
  { id: "local-classifieds-bike-search-location-check", scenarioId: "local-classifieds", variantId: "location-check", variantArmedAfterBuild: true, kind: "navigate-and-extract", instruction: BIKES, judgeBy: "expected-dataset", expectedDatasetId: "extract-bike-results" },
  { id: "local-classifieds-save-dining-tables", scenarioId: "local-classifieds", kind: "navigate-and-extract", instruction: TABLES, judgeBy: "expected-dataset", expectedDatasetId: "extract-saved-items" },
  { id: "local-classifieds-make-offer", scenarioId: "local-classifieds", kind: "form", instruction: OFFER, judgeBy: "playback-goal" },
];
