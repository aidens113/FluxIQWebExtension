import { REPLY_TICKET, TRIAGE_AGENT } from "./support-desk/index.js";
import { LINE_ITEM_ORDER, REFUND_ORDER } from "./order-operations/index.js";

/**
 * Plain-English instructions for live Flow creation against the scenario
 * corpus: what a person would type, pointed at one fixture, and judged only by
 * what that fixture's manifest already declares.
 *
 * - `judgeBy: "playback-goal"` is judged by the manifest's `playbackGoal`, so
 *   only a scenario that declares one can carry it.
 * - `judgeBy: "expected-dataset"` is judged by the `expected.extracted` entry
 *   whose `step` is `expectedDatasetId`. That entry may belong to the primary
 *   workflow or to one `workflows[]` entry; its step id is unique across the
 *   scenario's workflows, so it names the workflow as well, and a `variantId`
 *   is always one of that workflow's own variants
 *   (`tests/live-instructions.test.ts` holds both).
 *
 * An instruction is a goal, never a recipe: no selectors, test ids, element
 * ids, URL paths or numbered steps. Where a dataset is judged, the instruction
 * names the columns the expectation uses, because that is what a person asking
 * for a table would say. A task never names a variant whose run is expected to
 * fail: every run here is judged on succeeding.
 */
export type LiveInstructionTask = {
  id: string;
  scenarioId: string;
  variantId?: string;
  kind: "form" | "navigate" | "extract" | "navigate-and-extract";
  instruction: string;
  judgeBy: "playback-goal" | "expected-dataset";
  expectedDatasetId?: string;
  /**
   * Arms `variantId` for the created Flow's playback only. The build explores
   * the unarmed page, and the Flow then meets the variant, the way a Flow
   * meets a site that changed after it was made. Such a row succeeds only
   * when its run repairs the drift, so it is the "created and repaired" row.
   */
  variantArmedAfterBuild?: true;
};

const PRODUCT_COLUMNS = "with columns name, price, rating and url";
const INVENTORY_COLUMNS = "with columns product, category, price and stock";
const POST_COLUMNS = "with columns title, author and published";
const RENAME_WORKSPACE = "Rename the workspace to Aurora Field Team and save the settings.";
const FIRST_CATALOG_PAGE = `Scrape the products shown on the first page of the catalog into a table ${PRODUCT_COLUMNS}.`;
const WHOLE_CATALOG = `Scrape every product in the catalog, across all of its pages, into a table ${PRODUCT_COLUMNS}.`;
const WHOLE_INVENTORY = `Scrape the whole inventory table ${INVENTORY_COLUMNS}.`;
const INVENTORY_MAY_BE_EMPTY = `Scrape the inventory table ${INVENTORY_COLUMNS}. If every product has been delisted, an empty table is the right answer.`;
const LAMP_SEARCH = `Search the catalog for "lamp" and scrape every product the search returns ${PRODUCT_COLUMNS}.`;
const PRODUCT_PHOTOS = "For each product on the first page of the catalog, collect its name, the address of the photo it shows, the photo's alt text, and the address of any photo the card is still holding back to load later, with columns name, image, imageAlt and deferredImage.";
const FIRST_FORTY_POSTS = `Scroll the neighbourhood feed until 40 posts are showing, or until the feed runs out, and collect every post that has loaded ${POST_COLUMNS}, where published is the post's exact timestamp.`;
const CUSTOMER_BOOK = "Scrape every customer in the customer list, not just the ones on screen, with columns company, reference, plan and mrr.";
const HOLLIS_ADMINS = "Find the members whose name matches \"hollis\" and who are admins, and scrape them with columns id, member, role, team and status.";
const SLA_BREACHES = "Show the tickets that are past their response target and collect all of them into a table with columns reference, requester, subject, priority, assignee and sla.";
const ORDER_BATCH = "Narrow the order book to paid orders that nobody has picked yet, placed between 1 March 2026 and 14 March 2026, and collect them into a table with columns reference, customer, placed, total and payment.";

const HOME_COLUMNS = "with columns price, address, bedrooms, floorArea, agent and listed";
const HOME_FLOOR_AREA_NOTE = "Where a home publishes no floor area, leave that cell empty rather than putting a figure in it.";
const FIRST_HOMES_PAGE = `Scrape the homes on the first page of the property search into a table ${HOME_COLUMNS}. ${HOME_FLOOR_AREA_NOTE}`;
const KELFORD_HOMES = `Narrow the property search to homes in Kelford and scrape every one of them, across every page of results, into a table ${HOME_COLUMNS}. ${HOME_FLOOR_AREA_NOTE}`;
const COMPANY_COLUMNS = "with columns name, sector, location and employees";
const COMPANY_HEADCOUNT_NOTE = "A company that has filed no headcount has no employees figure, so leave that cell empty.";
const LOGISTICS_SECTOR = `Open the Logistics sector of the business register and scrape every company filed under it, across every page, ${COMPANY_COLUMNS}. ${COMPANY_HEADCOUNT_NOTE}`;

const SCHEDULE_TRAIL_POST = "Schedule a post to the Northwind Trails account for the morning of 24 September at nine o'clock, saying: Trail clean-up on Saturday: meet at the Harbour Loop car park at nine, gloves and bags provided. Then confirm it is sitting in the queue.";
const RETRY_FAILED_POSTS = "Find every post that failed to go out in the last seven days, put all of them back in the publishing queue, and then give me a table of what was retried with columns account, post and status.";
const WEEK_AHEAD_SCHEDULE = "Export the coming week's schedule for the Northwind Trails account as a table with columns account, post, scheduled and status.";
const ANSWER_PRIYA_MENTION = "Reply to the mention from Priya Duval, thanking her and saying we will pass it on to the team who were on bar that morning, and make sure the conversation ends up marked as handled.";
const UNANSWERED_BACKLOG = "Collect everything still unanswered and more than three days old on the Harbor & Pine account on Chirp, loading the older conversations until there are none left, into a table with columns from, account, kind and age.";

const TASKS: LiveInstructionTask[] = [
  // Forms and single interactions, judged by the scenario's playback goal.
  {
    id: "instruction-only-form-submit",
    scenarioId: "instruction-only-form",
    kind: "form",
    instruction: "Fill in the form with Ada as the name and the Team plan, then submit it.",
    judgeBy: "playback-goal",
  },
  {
    id: "llm-target-drift-activate",
    scenarioId: "llm-target-drift",
    kind: "form",
    instruction: "Activate the recorded target exactly once, and leave the page's mode as it is.",
    judgeBy: "playback-goal",
  },
  {
    id: "identity-drift-rename",
    scenarioId: "identity-drift",
    kind: "form",
    instruction: RENAME_WORKSPACE,
    judgeBy: "playback-goal",
  },
  {
    id: "identity-drift-rename-moved-save",
    scenarioId: "identity-drift",
    variantId: "moved",
    kind: "form",
    instruction: RENAME_WORKSPACE,
    judgeBy: "playback-goal",
  },
  {
    id: "identity-drift-rename-relabelled-save",
    scenarioId: "identity-drift",
    variantId: "text-only",
    kind: "form",
    instruction: RENAME_WORKSPACE,
    judgeBy: "playback-goal",
  },
  {
    id: "identity-drift-rename-redesigned-save",
    scenarioId: "identity-drift",
    variantId: "renamed-redesign",
    kind: "form",
    instruction: RENAME_WORKSPACE,
    judgeBy: "playback-goal",
  },
  {
    id: "identity-drift-rename-redesigned-after-creation",
    scenarioId: "identity-drift",
    variantId: "renamed-redesign",
    variantArmedAfterBuild: true,
    kind: "form",
    instruction: RENAME_WORKSPACE,
    judgeBy: "playback-goal",
  },

  // Product catalog: one page, every page, search, filters and photos.
  {
    id: "product-catalog-first-page",
    scenarioId: "product-catalog",
    kind: "extract",
    instruction: FIRST_CATALOG_PAGE,
    judgeBy: "expected-dataset",
    expectedDatasetId: "extract-page-one",
  },
  {
    id: "product-catalog-first-page-reworded-prices",
    scenarioId: "product-catalog",
    variantId: "text-variant",
    kind: "extract",
    instruction: FIRST_CATALOG_PAGE,
    judgeBy: "expected-dataset",
    expectedDatasetId: "extract-page-one",
  },
  {
    id: "product-catalog-first-page-sparse-cards",
    scenarioId: "product-catalog",
    variantId: "sparse-cards",
    kind: "extract",
    instruction: FIRST_CATALOG_PAGE,
    judgeBy: "expected-dataset",
    expectedDatasetId: "extract-page-one",
  },
  {
    id: "product-catalog-first-page-absolute-links",
    scenarioId: "product-catalog",
    variantId: "absolute-links",
    kind: "extract",
    instruction: FIRST_CATALOG_PAGE,
    judgeBy: "expected-dataset",
    expectedDatasetId: "extract-page-one",
  },
  {
    id: "product-catalog-all-pages",
    scenarioId: "product-catalog",
    kind: "navigate-and-extract",
    instruction: WHOLE_CATALOG,
    judgeBy: "expected-dataset",
    expectedDatasetId: "extract-all-pages",
  },
  {
    id: "product-catalog-all-pages-short-catalog",
    scenarioId: "product-catalog",
    variantId: "short-catalog",
    kind: "navigate-and-extract",
    instruction: WHOLE_CATALOG,
    judgeBy: "expected-dataset",
    expectedDatasetId: "extract-all-pages",
  },
  {
    id: "product-catalog-all-pages-link-pagination",
    scenarioId: "product-catalog",
    variantId: "link-pagination",
    kind: "navigate-and-extract",
    instruction: WHOLE_CATALOG,
    judgeBy: "expected-dataset",
    expectedDatasetId: "extract-all-pages",
  },
  {
    id: "product-catalog-numbered-pages",
    scenarioId: "product-catalog",
    kind: "navigate-and-extract",
    instruction: `Scrape every product in the catalog by visiting each numbered page in turn, ${PRODUCT_COLUMNS}.`,
    judgeBy: "expected-dataset",
    expectedDatasetId: "extract-numbered-pages",
  },
  {
    id: "product-catalog-search-lamp",
    scenarioId: "product-catalog",
    kind: "navigate-and-extract",
    instruction: LAMP_SEARCH,
    judgeBy: "expected-dataset",
    expectedDatasetId: "extract-search-results",
  },
  {
    id: "product-catalog-search-no-results",
    scenarioId: "product-catalog",
    variantId: "no-results",
    kind: "navigate-and-extract",
    instruction: `${LAMP_SEARCH} If nothing matches, an empty table is the right answer.`,
    judgeBy: "expected-dataset",
    expectedDatasetId: "extract-search-results",
  },
  {
    id: "product-catalog-in-stock",
    scenarioId: "product-catalog",
    kind: "navigate-and-extract",
    instruction: "Show only the products that are in stock, then scrape all of them across every page with columns name, price, rating, url and availability.",
    judgeBy: "expected-dataset",
    expectedDatasetId: "extract-in-stock",
  },
  {
    id: "product-catalog-photos",
    scenarioId: "product-catalog",
    kind: "extract",
    instruction: PRODUCT_PHOTOS,
    judgeBy: "expected-dataset",
    expectedDatasetId: "extract-images",
  },
  {
    id: "product-catalog-photos-lazy",
    scenarioId: "product-catalog",
    variantId: "lazy-images",
    kind: "extract",
    instruction: PRODUCT_PHOTOS,
    judgeBy: "expected-dataset",
    expectedDatasetId: "extract-images",
  },

  // Inventory table: the whole table, drift, size, emptiness and sorting.
  {
    id: "data-table-inventory",
    scenarioId: "data-table",
    kind: "extract",
    instruction: WHOLE_INVENTORY,
    judgeBy: "expected-dataset",
    expectedDatasetId: "extract-inventory",
  },
  {
    id: "data-table-inventory-reordered-columns",
    scenarioId: "data-table",
    variantId: "column-reorder",
    kind: "extract",
    instruction: WHOLE_INVENTORY,
    judgeBy: "expected-dataset",
    expectedDatasetId: "extract-inventory",
  },
  {
    id: "data-table-inventory-large",
    scenarioId: "data-table",
    variantId: "large-table",
    kind: "extract",
    instruction: WHOLE_INVENTORY,
    judgeBy: "expected-dataset",
    expectedDatasetId: "extract-inventory",
  },
  {
    id: "data-table-inventory-may-be-empty",
    scenarioId: "data-table",
    kind: "extract",
    instruction: INVENTORY_MAY_BE_EMPTY,
    judgeBy: "expected-dataset",
    expectedDatasetId: "extract-any-inventory",
  },
  {
    id: "data-table-inventory-empty",
    scenarioId: "data-table",
    variantId: "no-rows",
    kind: "extract",
    instruction: INVENTORY_MAY_BE_EMPTY,
    judgeBy: "expected-dataset",
    expectedDatasetId: "extract-any-inventory",
  },
  {
    id: "data-table-cheapest-product",
    scenarioId: "data-table",
    kind: "navigate-and-extract",
    instruction: `Sort the inventory by price from lowest to highest and record only the cheapest product, ${INVENTORY_COLUMNS}.`,
    judgeBy: "expected-dataset",
    expectedDatasetId: "extract-cheapest",
  },

  // Infinite feed: scroll-to-load and a load-more control.
  {
    id: "infinite-feed-first-forty",
    scenarioId: "infinite-feed",
    kind: "navigate-and-extract",
    instruction: FIRST_FORTY_POSTS,
    judgeBy: "expected-dataset",
    expectedDatasetId: "extract-loaded-posts",
  },
  {
    id: "infinite-feed-first-forty-short-feed",
    scenarioId: "infinite-feed",
    variantId: "end-early",
    kind: "navigate-and-extract",
    instruction: FIRST_FORTY_POSTS,
    judgeBy: "expected-dataset",
    expectedDatasetId: "extract-loaded-posts",
  },
  {
    id: "infinite-feed-every-post",
    scenarioId: "infinite-feed",
    kind: "navigate-and-extract",
    instruction: `Collect every post in the neighbourhood feed, loading more until the feed says there is nothing left, ${POST_COLUMNS}, where published is the post's exact timestamp.`,
    judgeBy: "expected-dataset",
    expectedDatasetId: "extract-every-post",
  },
  {
    id: "infinite-feed-load-more",
    scenarioId: "infinite-feed",
    variantId: "load-more-button",
    kind: "navigate-and-extract",
    instruction: `Collect every post in the neighbourhood feed, pressing Load more until no more posts appear, ${POST_COLUMNS}, where published is the post's exact timestamp.`,
    judgeBy: "expected-dataset",
    expectedDatasetId: "extract-paged-posts",
  },

  // Multi-page and multi-tab journeys that end in a read.
  {
    id: "multi-tab-order-details",
    scenarioId: "multi-tab",
    kind: "navigate-and-extract",
    instruction: "Open the details of purchase order PO-4472, record its order number, supplier, status, buyer, delivery date and total with columns order, supplier, status, buyer, delivery and total, then go back to the order list and confirm the review of PO-4472.",
    judgeBy: "expected-dataset",
    expectedDatasetId: "extract-order-details",
  },
  {
    id: "auth-gate-account-summary",
    scenarioId: "auth-gate",
    kind: "navigate-and-extract",
    instruction: "Sign in as demo.user with the demo password you have been given, then read the account holder, plan and balance from the account page with columns holder, plan and balance.",
    judgeBy: "expected-dataset",
    expectedDatasetId: "read-account",
  },
  {
    id: "admin-console-customer-book",
    scenarioId: "admin-console",
    kind: "extract",
    instruction: CUSTOMER_BOOK,
    judgeBy: "expected-dataset",
    expectedDatasetId: "read-customer-book",
  },
  {
    id: "admin-console-customer-book-short",
    scenarioId: "admin-console",
    variantId: "short-book",
    kind: "extract",
    instruction: CUSTOMER_BOOK,
    judgeBy: "expected-dataset",
    expectedDatasetId: "read-customer-book",
  },
  {
    id: "member-directory-hollis-admins",
    scenarioId: "member-directory",
    kind: "navigate-and-extract",
    instruction: HOLLIS_ADMINS,
    judgeBy: "expected-dataset",
    expectedDatasetId: "extract-admins",
  },
  {
    id: "member-directory-hollis-admins-by-activity",
    scenarioId: "member-directory",
    variantId: "sorted-by-activity",
    kind: "navigate-and-extract",
    instruction: HOLLIS_ADMINS,
    judgeBy: "expected-dataset",
    expectedDatasetId: "extract-admins",
  },
  // Back-office work, where an automation earns its keep: every one of these
  // requires several steps, and four of them are judged on state the run left
  // behind rather than on anything it read.
  {
    id: "support-desk-triage-backlog",
    scenarioId: "support-desk",
    kind: "form",
    instruction: `Assign every unassigned ticket that is urgent or high priority to ${TRIAGE_AGENT}, and leave the queue showing that none of them are still waiting for an owner.`,
    judgeBy: "playback-goal",
  },
  {
    id: "support-desk-sla-breaches",
    scenarioId: "support-desk",
    kind: "navigate-and-extract",
    instruction: SLA_BREACHES,
    judgeBy: "expected-dataset",
    expectedDatasetId: "extract-sla-breaches",
  },
  {
    id: "support-desk-sla-breaches-recovered",
    scenarioId: "support-desk",
    variantId: "recovered-sla",
    kind: "navigate-and-extract",
    instruction: SLA_BREACHES,
    judgeBy: "expected-dataset",
    expectedDatasetId: "extract-sla-breaches",
  },
  {
    id: "support-desk-reply-and-resolve",
    scenarioId: "support-desk",
    kind: "navigate-and-extract",
    instruction: `Open the ticket raised by ${REPLY_TICKET.requester}, reply from the closing summary template, mark the ticket resolved, and then record that ticket with columns reference, requester, account, priority, status and assignee.`,
    judgeBy: "expected-dataset",
    expectedDatasetId: "read-resolved-ticket",
  },
  {
    id: "support-desk-escalate-longest-breach",
    scenarioId: "support-desk",
    kind: "navigate",
    instruction: "Find the ticket that has been past its response target for longer than any other, raise a critical escalation for it on the escalations screen, and then record what the escalation log shows with columns ticket, severity, requester and status.",
    judgeBy: "expected-dataset",
    expectedDatasetId: "extract-escalation-log",
  },
  {
    id: "order-operations-partial-refund",
    scenarioId: "order-operations",
    kind: "form",
    instruction: `Find the order placed by ${REFUND_ORDER.customer}, open it, refund the value of the first line on it, and leave the order showing that part of the money has been given back.`,
    judgeBy: "playback-goal",
  },
  {
    id: "order-operations-batch-export",
    scenarioId: "order-operations",
    kind: "navigate-and-extract",
    instruction: ORDER_BATCH,
    judgeBy: "expected-dataset",
    expectedDatasetId: "extract-order-batch",
  },
  {
    id: "order-operations-batch-export-quiet-week",
    scenarioId: "order-operations",
    variantId: "quiet-week",
    kind: "navigate-and-extract",
    instruction: ORDER_BATCH,
    judgeBy: "expected-dataset",
    expectedDatasetId: "extract-order-batch",
  },
  {
    id: "order-operations-line-items",
    scenarioId: "order-operations",
    kind: "navigate-and-extract",
    instruction: `Find the order placed by ${LINE_ITEM_ORDER.customer} in the order book, open it, and record the items on it with columns item, sku, quantity, unitPrice and lineTotal.`,
    judgeBy: "expected-dataset",
    expectedDatasetId: "extract-line-items",
  },
  {
    id: "order-operations-dispatch-run",
    scenarioId: "order-operations",
    kind: "navigate",
    instruction: "Start this week's dispatch run, mark every order it selects as dispatched, and then record the dispatch note that is left with columns order, customer, items and total.",
    judgeBy: "expected-dataset",
    expectedDatasetId: "extract-dispatch-note",
  },
  {
    id: "sensitive-input-card-labels",
    scenarioId: "sensitive-input",
    kind: "extract",
    instruction: "List the saved cards with columns label and expiry. Leave the unlock codes out entirely.",
    judgeBy: "expected-dataset",
    expectedDatasetId: "extract-cards",
  },

  // Property listings: one page of results, a whole neighbourhood across its
  // pages, a search with no answer, the cheapest match, and the facts that
  // live only on a home's own page.
  {
    id: "property-listings-newest-homes",
    scenarioId: "property-listings",
    kind: "extract",
    instruction: FIRST_HOMES_PAGE,
    judgeBy: "expected-dataset",
    expectedDatasetId: "extract-newest-homes",
  },
  {
    id: "property-listings-newest-homes-agent-withheld",
    scenarioId: "property-listings",
    variantId: "agent-withheld",
    kind: "extract",
    instruction: FIRST_HOMES_PAGE,
    judgeBy: "expected-dataset",
    expectedDatasetId: "extract-newest-homes",
  },
  {
    id: "property-listings-kelford-homes",
    scenarioId: "property-listings",
    kind: "navigate-and-extract",
    instruction: KELFORD_HOMES,
    judgeBy: "expected-dataset",
    expectedDatasetId: "extract-area-homes",
  },
  {
    id: "property-listings-kelford-homes-renamed-pagination",
    scenarioId: "property-listings",
    variantId: "renamed-pagination",
    kind: "navigate-and-extract",
    instruction: KELFORD_HOMES,
    judgeBy: "expected-dataset",
    expectedDatasetId: "extract-area-homes",
  },
  {
    id: "property-listings-no-matches",
    scenarioId: "property-listings",
    kind: "navigate-and-extract",
    instruction: `Search the property site for homes with five or more bedrooms priced up to £250,000 and scrape whatever it returns ${HOME_COLUMNS}. If no home matches, an empty table is the right answer.`,
    judgeBy: "expected-dataset",
    expectedDatasetId: "extract-no-matches",
  },
  {
    id: "property-listings-cheapest-home",
    scenarioId: "property-listings",
    kind: "navigate-and-extract",
    instruction: `Find the cheapest three-bedroom home in Kelford on the property site and record only that one ${HOME_COLUMNS}. ${HOME_FLOOR_AREA_NOTE}`,
    judgeBy: "expected-dataset",
    expectedDatasetId: "extract-cheapest-home",
  },
  {
    id: "property-listings-home-facts",
    scenarioId: "property-listings",
    kind: "navigate-and-extract",
    instruction: "Find the cheapest three-bedroom home in Kelford on the property site, open the home's own page, and record its address, its asking price, its tenure, its council tax band and its EPC rating, with columns address, price, tenure, councilTax and epc. A home with no council tax band has none, so leave that cell empty.",
    judgeBy: "expected-dataset",
    expectedDatasetId: "extract-home-facts",
  },
  {
    id: "property-listings-last-page",
    scenarioId: "property-listings",
    kind: "navigate",
    instruction: "Narrow the property search to three-bedroom homes in Kelford and show the last page of those results.",
    judgeBy: "playback-goal",
  },

  // Company directory: a page of the register, a whole sector across its
  // pages, a size band nobody in that sector has, and a company's own profile.
  {
    id: "company-directory-register-page",
    scenarioId: "company-directory",
    kind: "extract",
    instruction: `Scrape the first page of the business register into a table ${COMPANY_COLUMNS}, and add a url column holding the address of each company's own page. ${COMPANY_HEADCOUNT_NOTE}`,
    judgeBy: "expected-dataset",
    expectedDatasetId: "extract-first-register-page",
  },
  {
    id: "company-directory-logistics-sector",
    scenarioId: "company-directory",
    kind: "navigate-and-extract",
    instruction: LOGISTICS_SECTOR,
    judgeBy: "expected-dataset",
    expectedDatasetId: "extract-sector-companies",
  },
  {
    id: "company-directory-logistics-sector-relabelled",
    scenarioId: "company-directory",
    variantId: "relabelled-columns",
    kind: "navigate-and-extract",
    instruction: LOGISTICS_SECTOR,
    judgeBy: "expected-dataset",
    expectedDatasetId: "extract-sector-companies",
  },
  {
    id: "company-directory-no-companies",
    scenarioId: "company-directory",
    kind: "navigate-and-extract",
    instruction: `In the business register, show the independent retail companies in the largest employee band the register offers and scrape what you find ${COMPANY_COLUMNS}. If no company matches, an empty table is the right answer.`,
    judgeBy: "expected-dataset",
    expectedDatasetId: "extract-no-companies",
  },
  {
    id: "company-directory-company-profile",
    scenarioId: "company-directory",
    kind: "navigate-and-extract",
    instruction: "Find Quarrendon Software in the business register, open its profile, and record the company name, its sector, its employee band, the year it was founded, its website and its telephone number, with columns name, sector, employees, founded, website and telephone.",
    judgeBy: "expected-dataset",
    expectedDatasetId: "extract-company-profile",
  },
  {
    id: "company-directory-last-page",
    scenarioId: "company-directory",
    kind: "navigate",
    instruction: "Show the last page of the companies filed under the Logistics sector of the business register.",
    judgeBy: "playback-goal",
  },
  // Social scheduler: composing and scheduling a post, retrying a week of
  // failures in bulk, exporting one account's coming week, and reading a
  // 280-row queue whole.
  {
    id: "social-scheduler-schedule-post",
    scenarioId: "social-scheduler",
    kind: "form",
    instruction: SCHEDULE_TRAIL_POST,
    judgeBy: "playback-goal",
  },
  {
    id: "social-scheduler-schedule-post-restyled",
    scenarioId: "social-scheduler",
    variantId: "restyled",
    kind: "form",
    instruction: SCHEDULE_TRAIL_POST,
    judgeBy: "playback-goal",
  },
  {
    id: "social-scheduler-schedule-post-renamed-composer",
    scenarioId: "social-scheduler",
    variantId: "renamed-composer",
    kind: "form",
    instruction: SCHEDULE_TRAIL_POST,
    judgeBy: "playback-goal",
  },
  {
    id: "social-scheduler-retry-failed",
    scenarioId: "social-scheduler",
    kind: "navigate-and-extract",
    instruction: RETRY_FAILED_POSTS,
    judgeBy: "expected-dataset",
    expectedDatasetId: "extract-retried",
  },
  {
    id: "social-scheduler-retry-failed-quiet-week",
    scenarioId: "social-scheduler",
    variantId: "quiet-week",
    kind: "navigate-and-extract",
    instruction: RETRY_FAILED_POSTS,
    judgeBy: "expected-dataset",
    expectedDatasetId: "extract-retried",
  },
  {
    id: "social-scheduler-week-ahead",
    scenarioId: "social-scheduler",
    kind: "navigate-and-extract",
    instruction: WEEK_AHEAD_SCHEDULE,
    judgeBy: "expected-dataset",
    expectedDatasetId: "extract-week-ahead",
  },
  {
    id: "social-scheduler-week-ahead-reordered-columns",
    scenarioId: "social-scheduler",
    variantId: "reordered-columns",
    kind: "navigate-and-extract",
    instruction: WEEK_AHEAD_SCHEDULE,
    judgeBy: "expected-dataset",
    expectedDatasetId: "extract-week-ahead",
  },
  {
    id: "social-scheduler-whole-queue",
    scenarioId: "social-scheduler",
    kind: "extract",
    instruction: "Scrape the whole publishing queue, every post in it, into a table with columns account, post, scheduled and status.",
    judgeBy: "expected-dataset",
    expectedDatasetId: "extract-whole-queue",
  },

  // Social inbox: answering one person's mention among 320 conversations,
  // triaging an account's backlog across more than one screen, reading the
  // first screen, and following a conversation to its own page.
  {
    id: "social-inbox-answer-mention",
    scenarioId: "social-inbox",
    kind: "form",
    instruction: ANSWER_PRIYA_MENTION,
    judgeBy: "playback-goal",
  },
  {
    id: "social-inbox-answer-mention-restyled",
    scenarioId: "social-inbox",
    variantId: "restyled",
    kind: "form",
    instruction: ANSWER_PRIYA_MENTION,
    judgeBy: "playback-goal",
  },
  {
    id: "social-inbox-answer-mention-moved-send",
    scenarioId: "social-inbox",
    variantId: "moved-send",
    kind: "form",
    instruction: ANSWER_PRIYA_MENTION,
    judgeBy: "playback-goal",
  },
  {
    id: "social-inbox-unanswered-backlog",
    scenarioId: "social-inbox",
    kind: "navigate-and-extract",
    instruction: UNANSWERED_BACKLOG,
    judgeBy: "expected-dataset",
    expectedDatasetId: "extract-backlog",
  },
  {
    id: "social-inbox-unanswered-backlog-quiet",
    scenarioId: "social-inbox",
    variantId: "quiet-inbox",
    kind: "navigate-and-extract",
    instruction: UNANSWERED_BACKLOG,
    judgeBy: "expected-dataset",
    expectedDatasetId: "extract-backlog",
  },
  {
    id: "social-inbox-first-screen",
    scenarioId: "social-inbox",
    kind: "extract",
    instruction: "List the conversations the inbox opens with, before loading any older ones, with columns from, account, kind, age and status.",
    judgeBy: "expected-dataset",
    expectedDatasetId: "extract-first-screen",
  },
  {
    id: "social-inbox-open-conversation",
    scenarioId: "social-inbox",
    kind: "navigate",
    instruction: "Open the mention from Priya Duval and read the whole thing on its own page, recording who it is from, which account it came in on, what kind of message it is, its status and the message itself, with columns from, account, kind, status and message.",
    judgeBy: "expected-dataset",
    expectedDatasetId: "extract-conversation",
  },
];

export const LIVE_INSTRUCTION_TASKS: readonly LiveInstructionTask[] = Object.freeze(TASKS.map((task) => Object.freeze({ ...task })));
