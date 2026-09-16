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
  {
    id: "sensitive-input-card-labels",
    scenarioId: "sensitive-input",
    kind: "extract",
    instruction: "List the saved cards with columns label and expiry. Leave the unlock codes out entirely.",
    judgeBy: "expected-dataset",
    expectedDatasetId: "extract-cards",
  },
];

export const LIVE_INSTRUCTION_TASKS: readonly LiveInstructionTask[] = Object.freeze(TASKS.map((task) => Object.freeze({ ...task })));
