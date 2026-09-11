import { createScenarioManifest } from "../../types.js";
import { formatPrice, formatRating, productPath, stockLabel } from "./format.js";
import { CATALOG_PAGE_SIZE, SHORT_CATALOG_SIZE } from "./listing.js";
import { catalogProducts } from "./products.js";
import type { CatalogProduct, CatalogVariant } from "./types.js";

const SEARCH_TERM = "lamp";

/** Name, price, and rating as text, and the product link's raw root-relative `href`, read inside each card. */
const cardFields = {
  name: "testid:product-name",
  price: "testid:product-price",
  rating: "testid:product-rating",
  url: "testid:product-link@href",
};
const followNext = { next: "testid:pagination-next", maxPages: 5 };

const resultCount = (value: string) => ({ id: "result-count", subject: "result-count", predicate: "text", value });
const pageStatus = (value: string) => ({ id: "page-status", subject: "page-status", predicate: "text", value });
const nextAbsent = { id: "next-absent", subject: "pagination-next", predicate: "exists", value: false };

/**
 * Corpus rows W04-W07 on one fixture. The manifest's own script is W04
 * (page 1); `workflows[]` holds W05 (every page via Next), W06 (search), and
 * W07 (in stock only). Records are built from the authored catalog with the
 * page's own text formatting; counts and fact texts are literal, so a catalog
 * change has to be reviewed here.
 */
export const productCatalogManifest = createScenarioManifest({
  id: "product-catalog",
  title: "Product catalog",
  tags: ["catalog", "extraction", "pagination", "search", "filter"],
  seed: 114,
  startPath: "/scenarios/product-catalog/",
  capabilities: ["forms", "mutation"],
  recordingScript: [
    { id: "extract-page-one", operation: "extract", target: "testid:product-card", fields: cardFields },
    { id: "page-one-extracted", operation: "checkpoint" },
  ],
  expected: {
    pageFacts: [resultCount("23 products")],
    extracted: [{ step: "extract-page-one", count: 8, records: cardRecords(catalogProducts.slice(0, CATALOG_PAGE_SIZE), "baseline") }],
    finalState: [pageStatus("Page 1 of 3")],
  },
  variants: [{
    id: "text-variant",
    description: "Prices are rewritten from \"$1,249.00\" to \"1,249.00 USD\"; extraction must still succeed and return the new price text.",
    arm: { operation: "set-variant", payload: { variant: "text-variant" } },
    expected: {
      extracted: [{ step: "extract-page-one", count: 8, records: cardRecords(catalogProducts.slice(0, CATALOG_PAGE_SIZE), "text-variant") }],
    },
  }],
  workflows: [
    {
      id: "paginated-extraction",
      description: "Extract name, price, rating, and URL from every catalog page by following Next until it is absent.",
      recordingScript: [
        { id: "extract-all-pages", operation: "extract", target: "testid:product-card", fields: cardFields, pagination: followNext },
        { id: "all-pages-extracted", operation: "checkpoint" },
      ],
      expected: {
        pageFacts: [resultCount("23 products")],
        extracted: [{ step: "extract-all-pages", count: 23, records: cardRecords(catalogProducts, "baseline") }],
        finalState: [pageStatus("Page 3 of 3"), nextAbsent],
      },
      variants: [{
        id: "short-catalog",
        description: "The catalog shrinks to five products on one page; Next never appears and extraction ends after that page.",
        arm: { operation: "set-variant", payload: { variant: "short-catalog" } },
        expected: {
          pageFacts: [resultCount("5 products")],
          extracted: [{ step: "extract-all-pages", count: 5, records: cardRecords(catalogProducts.slice(0, SHORT_CATALOG_SIZE), "baseline") }],
          finalState: [pageStatus("Page 1 of 1"), nextAbsent],
        },
      }],
    },
    {
      id: "search",
      description: `Type "${SEARCH_TERM}" in the search box, submit with Enter, and extract every matching product.`,
      recordingScript: [
        { id: "type-search-term", operation: "type", target: "testid:search-input", value: SEARCH_TERM },
        { id: "submit-search", operation: "press", target: "testid:search-input", value: "Enter" },
        { id: "search-applied", operation: "waitForState", target: "testid:search-summary", timeoutMs: 2000 },
        { id: "extract-search-results", operation: "extract", target: "testid:product-card", fields: cardFields },
        { id: "search-results-extracted", operation: "checkpoint" },
      ],
      expected: {
        extracted: [{
          step: "extract-search-results",
          count: 4,
          records: cardRecords(catalogProducts.filter((product) => product.name.toLowerCase().includes(SEARCH_TERM)), "baseline"),
        }],
        finalState: [resultCount("4 results"), { id: "search-summary", subject: "search-summary", predicate: "text", value: `Results for "${SEARCH_TERM}"` }],
      },
      variants: [{
        id: "no-results",
        description: "The search matches nothing: the list is empty, the count reads 0 results, and extraction succeeds with no records.",
        arm: { operation: "set-variant", payload: { variant: "no-results" } },
        expected: {
          extracted: [{ step: "extract-search-results", count: 0, records: [] }],
          finalState: [resultCount("0 results"), { id: "empty-results", subject: "empty-results", predicate: "text", value: "No products match your search." }],
        },
      }],
    },
    {
      id: "in-stock-only",
      description: "Tick In stock only, then extract every in-stock product across all pages together with its stock badge.",
      recordingScript: [
        { id: "filter-in-stock", operation: "check", target: "testid:in-stock-only", value: true },
        { id: "filter-applied", operation: "waitForState", target: "testid:active-filters", timeoutMs: 2000 },
        {
          id: "extract-in-stock", operation: "extract", target: "testid:product-card",
          fields: { ...cardFields, availability: "testid:stock-badge" }, pagination: followNext,
        },
        { id: "in-stock-extracted", operation: "checkpoint" },
      ],
      expected: {
        extracted: [{ step: "extract-in-stock", count: 18, records: cardRecords(catalogProducts.filter((product) => product.inStock), "baseline", true) }],
        finalState: [
          { id: "active-filters", subject: "active-filters", predicate: "text", value: "Filters: In stock only" },
          resultCount("18 products"),
          pageStatus("Page 3 of 3"),
        ],
      },
    },
  ],
});

function cardRecords(products: readonly CatalogProduct[], variant: CatalogVariant, withAvailability = false): Array<Record<string, string>> {
  return products.map((product) => {
    const record: Record<string, string> = {
      name: product.name,
      price: formatPrice(product.priceCents, variant),
      rating: formatRating(product.ratingTenths),
      url: productPath(product),
    };
    if (withAvailability) record.availability = stockLabel(product);
    return record;
  });
}
