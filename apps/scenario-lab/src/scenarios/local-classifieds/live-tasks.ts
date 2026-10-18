import type { LiveInstructionTask } from "../live-instructions.js";
import { TEST_RIDE_MESSAGE } from "./breadth/index.js";

const BIKES = "On Kerbfind Marketplace, find every bicycle for sale within 10 miles of Kelford that costs from £100 to £400 and is new, like new or in good condition. List each bike once, cheapest first, and leave out sponsored posts, in a table with columns title, price, location and url, where location is the place the listing names and url is the address of the listing's own page.";
const TABLES = "Save the three cheapest dining tables for sale within 5 miles of Kelford to my saved items, then give me a table of everything in my saved items, cheapest first, with columns title, price and status.";
/**
 * The offer dialog takes no payment and binds nothing: it sends the amount to
 * the seller's Marketplace inbox ("will see your offer in their Marketplace
 * inbox"), so it is a send, asked at the dialog's Send offer button.
 */
const OFFER_POINT = { consequence: "send_or_publish", control: "Send offer" } as const;
const OFFER = "Send the seller an offer of £140 for the cheapest folding bike listed within 10 miles of Kelford in the last 7 days that is in like-new condition. Sponsored posts are adverts, not listings, so leave them out, and don't send any other message.";

const NEARBY_FURNITURE = "On Kerbfind Marketplace, list every listing in the Furniture category that is for sale within 5 miles of Kelford and costs £100 or less, newest listings first. Leave out sponsored posts and list each listing once, in a table with columns title, price, location and url, where location is the place the listing names and url is the address of the listing's own page.";
/** A plain message to a seller is a send, asked at the listing's Send button. */
const MESSAGE_POINT = { consequence: "send_or_publish", control: "Send" } as const;
const TEST_RIDE = `On Kerbfind Marketplace, find the cheapest road bike for sale within 5 miles of Kelford that is new, like new or in good condition, and send its seller this message: "${TEST_RIDE_MESSAGE}" Sponsored posts are adverts, not listings, so leave them out. Send only that one message, with no offer and nothing else, then give me the bike as a table with columns title, price and seller, where seller is the seller's name.`;
const PRICE_CHECK = "On Kerbfind Marketplace, check the price of the carbon road bike for sale in Kelford Harbour. If it costs £350 or less, send the seller an offer of £320; if it costs more than that, don't make an offer or message the seller. Either way, give me the bike as a table with columns title, price and condition, where price is what it costs now and condition is the condition the listing states.";
const WITHIN_ALEX_PRICE = "On Kerbfind Marketplace, look in my Buying conversations for the price Alex Rowe said he would take for his road bike. Then find every listing in the Bicycles category that is for sale within 10 miles of Kelford, costs no more than that price and is new, like new or in good condition. Leave out sponsored posts, don't reply to Alex or message anyone, and list each listing once, cheapest first, in a table with columns title, price, location and url, where location is the place the listing names and url is the address of the listing's own page.";

/**
 * Plain-English tasks for the local-classifieds fixture, judged only by what
 * its manifest declares. The offer is consequential: a run nobody has given
 * permission to make offers should end in a request for that permission, and
 * the goal it is judged by here is the permitted run's.
 *
 * The two armed rows build on the site as it ships and then meet a changed
 * one, the way a Flow meets a site that changed after it was made.
 *
 * The last four are the breadth round's (`breadth/`): a filtered read across
 * both batches of a feed, one written message to a seller, a conditional
 * offer whose condition does not hold so nothing is sent, and a journey that
 * takes its price limit from the account's conversation with Alex Rowe.
 */
export const LOCAL_CLASSIFIEDS_LIVE_TASKS: readonly LiveInstructionTask[] = [
  { id: "local-classifieds-bike-search", scenarioId: "local-classifieds", kind: "navigate-and-extract", instruction: BIKES, judgeBy: "expected-dataset", expectedDatasetId: "extract-bike-results" },
  { id: "local-classifieds-bike-search-list-layout", scenarioId: "local-classifieds", variantId: "list-layout", variantArmedAfterBuild: true, kind: "navigate-and-extract", instruction: BIKES, judgeBy: "expected-dataset", expectedDatasetId: "extract-bike-results" },
  { id: "local-classifieds-bike-search-location-check", scenarioId: "local-classifieds", variantId: "location-check", variantArmedAfterBuild: true, kind: "navigate-and-extract", instruction: BIKES, judgeBy: "expected-dataset", expectedDatasetId: "extract-bike-results" },
  { id: "local-classifieds-save-dining-tables", scenarioId: "local-classifieds", kind: "navigate-and-extract", instruction: TABLES, judgeBy: "expected-dataset", expectedDatasetId: "extract-saved-items" },
  { id: "local-classifieds-make-offer", scenarioId: "local-classifieds", kind: "form", instruction: OFFER, judgeBy: "playback-goal", permissionPoint: OFFER_POINT },
  {
    id: "local-classifieds-remove-sold-saves",
    scenarioId: "local-classifieds",
    kind: "navigate-and-extract",
    instruction: "Remove listings marked Sold from my Kerbfind saved items, leaving every Available item saved. Do not hide listings, make an offer or message a seller. Then show everything still saved, with columns title, price and status exactly as the saved list shows them.",
    judgeBy: "expected-dataset",
    expectedDatasetId: "extract-available-saves",
    permissionPoint: { consequence: "delete", control: "Remove from saved items" },
  },
  { id: "local-classifieds-nearby-furniture", scenarioId: "local-classifieds", kind: "navigate-and-extract", instruction: NEARBY_FURNITURE, judgeBy: "expected-dataset", expectedDatasetId: "extract-nearby-furniture" },
  { id: "local-classifieds-test-ride-question", scenarioId: "local-classifieds", kind: "form", instruction: TEST_RIDE, judgeBy: "expected-dataset", expectedDatasetId: "extract-test-ride-listing", permissionPoint: MESSAGE_POINT },
  { id: "local-classifieds-carbon-price-check", scenarioId: "local-classifieds", kind: "navigate-and-extract", instruction: PRICE_CHECK, judgeBy: "expected-dataset", expectedDatasetId: "extract-price-check" },
  { id: "local-classifieds-bikes-within-alex-price", scenarioId: "local-classifieds", kind: "navigate-and-extract", instruction: WITHIN_ALEX_PRICE, judgeBy: "expected-dataset", expectedDatasetId: "extract-budget-bikes" },
];
