import { createScenarioManifest } from "../../types.js";
import {
  CATALOG_PLACEHOLDER_SLUG, cardShowsPrice, cardShowsRating, formatPrice, formatRating,
  productHref, productImageAlt, productImagePath, stockLabel,
} from "./format.js";
import { CATALOG_PAGE_SIZE, SHORT_CATALOG_SIZE } from "./listing.js";
import { catalogProducts } from "./products.js";
import type { CatalogProduct, CatalogVariant } from "./types.js";

const SEARCH_TERM = "lamp";

/** Name, price, and rating as text, and the product link's raw `href`, read inside each card. */
const cardFields = {
  name: "testid:product-name",
  price: "testid:product-price",
  rating: "testid:product-rating",
  url: "testid:product-link@href",
};

/** The card photo's own attributes: the loaded source, its alt text, and the source a lazy card defers into `data-src`. */
const imageFields = {
  name: "testid:product-name",
  image: "testid:product-image@src",
  imageAlt: "testid:product-image@alt",
  deferredImage: "testid:product-image@data-src",
};

const followNext = { next: "testid:pagination-next", maxPages: 5 };

/**
 * A plain CSS target rather than a `testid:` one. The page controls are
 * `pagination-page-1`, `-2` and `-3` -- one element each -- so no single test
 * id names the set, and a `testid:` target that meant "every id starting with
 * this" would be a new grammar invented for one fixture. `[data-testid^=...]`
 * is ordinary CSS, and `admin-console` already takes raw CSS targets the same
 * way for a row identified by a data attribute.
 */
const numberedPages = { mode: "numbered", pages: '[data-testid^="pagination-page-"]', maxPages: 5 } as const;

const resultCount = (value: string) => ({ id: "result-count", subject: "result-count", predicate: "text", value });
const pageStatus = (value: string) => ({ id: "page-status", subject: "page-status", predicate: "text", value });
const nextAbsent = { id: "next-absent", subject: "pagination-next", predicate: "exists", value: false };

/**
 * Corpus rows W04-W07 on one fixture. The manifest's own script is W04
 * (page 1); `workflows[]` holds W05 (every page via Next), W06 (search), and
 * W07 (in stock only), beside two extraction workflows that no corpus row
 * names: `with-images` reads attributes rather than text, and `numbered-pages`
 * reaches every page through the numbered controls instead of Next. Records
 * are built from the authored catalog with the page's own text formatting;
 * counts and fact texts are literal, so a catalog change has to be reviewed
 * here.
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
    actions: [{ action: "web.dom.extract_list" }],
    extracted: [{ step: "extract-page-one", count: 8, records: cardRecords(catalogProducts.slice(0, CATALOG_PAGE_SIZE), "baseline") }],
    finalState: [pageStatus("Page 1 of 3")],
  },
  variants: [
    {
      id: "text-variant",
      description: "Prices are rewritten from \"$1,249.00\" to \"1,249.00 USD\"; extraction must still succeed and return the new price text.",
      arm: { operation: "set-variant", payload: { variant: "text-variant" } },
      expected: {
        extracted: [{ step: "extract-page-one", count: 8, records: cardRecords(catalogProducts.slice(0, CATALOG_PAGE_SIZE), "text-variant") }],
      },
    },
    {
      id: "sparse-cards",
      description: "An out-of-stock card drops its price and a low-rated card drops its rating, so those elements are absent rather than empty and the fields read as no value.",
      arm: { operation: "set-variant", payload: { variant: "sparse-cards" } },
      expected: {
        extracted: [{
          step: "extract-page-one", count: 8,
          records: cardRecords(catalogProducts.slice(0, CATALOG_PAGE_SIZE), "sparse-cards"),
          optionalFields: ["price", "rating"],
        }],
      },
    },
    {
      id: "absolute-links",
      description: "Card links are written as absolute URLs against a fixed origin; the same field must return the href exactly as the page writes it.",
      arm: { operation: "set-variant", payload: { variant: "absolute-links" } },
      expected: {
        extracted: [{ step: "extract-page-one", count: 8, records: cardRecords(catalogProducts.slice(0, CATALOG_PAGE_SIZE), "absolute-links") }],
      },
    },
  ],
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
        actions: [{ action: "web.dom.extract_list" }],
        extracted: [{ step: "extract-all-pages", count: 23, records: cardRecords(catalogProducts, "baseline"), pages: 3 }],
        finalState: [pageStatus("Page 3 of 3"), nextAbsent],
      },
      variants: [
        {
          id: "short-catalog",
          description: "The catalog shrinks to five products on one page; Next never appears and extraction ends after that page.",
          arm: { operation: "set-variant", payload: { variant: "short-catalog" } },
          expected: {
            pageFacts: [resultCount("5 products")],
            extracted: [{ step: "extract-all-pages", count: 5, records: cardRecords(catalogProducts.slice(0, SHORT_CATALOG_SIZE), "baseline"), pages: 1 }],
            finalState: [pageStatus("Page 1 of 1"), nextAbsent],
          },
        },
        {
          id: "link-pagination",
          description: "Next is an anchor rather than a button, with the same test id and the same destination, so the same paginated read must still reach all three pages.",
          arm: { operation: "set-variant", payload: { variant: "link-pagination" } },
          expected: {
            extracted: [{ step: "extract-all-pages", count: 23, records: cardRecords(catalogProducts, "link-pagination"), pages: 3 }],
            finalState: [pageStatus("Page 3 of 3"), nextAbsent],
          },
        },
      ],
    },
    {
      id: "search",
      description: `Type "${SEARCH_TERM}" in the search box, submit with Enter, and extract every matching product.`,
      recordingScript: [
        { id: "type-search-term", operation: "type", target: "testid:search-input", value: SEARCH_TERM },
        { id: "submit-search", operation: "press", target: "testid:search-input", value: "Enter" },
        { id: "search-applied", operation: "waitForState", target: "testid:search-summary", timeoutMs: 2000 },
        // The no-results variant expects an empty list, which an extract step refuses unless it declares minItems: 0 (D4).
        { id: "extract-search-results", operation: "extract", target: "testid:product-card", fields: cardFields, minItems: 0 },
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
        actions: [{ action: "web.dom.extract_list" }],
        extracted: [{ step: "extract-in-stock", count: 18, records: cardRecords(catalogProducts.filter((product) => product.inStock), "baseline", true), pages: 3 }],
        finalState: [
          { id: "active-filters", subject: "active-filters", predicate: "text", value: "Filters: In stock only" },
          resultCount("18 products"),
          pageStatus("Page 3 of 3"),
        ],
      },
    },
    {
      id: "with-images",
      description: "Read each card's photo rather than its text: the loaded source, its alt text, and the source a deferred card keeps in data-src.",
      recordingScript: [
        { id: "extract-images", operation: "extract", target: "testid:product-card", fields: imageFields },
        { id: "images-extracted", operation: "checkpoint" },
      ],
      expected: {
        pageFacts: [resultCount("23 products")],
        extracted: [{
          step: "extract-images", count: 8,
          records: imageRecords(catalogProducts.slice(0, CATALOG_PAGE_SIZE), "baseline"),
          optionalFields: ["deferredImage"],
        }],
        finalState: [pageStatus("Page 1 of 3")],
      },
      variants: [{
        id: "lazy-images",
        description: "Every photo is deferred: src holds the shared placeholder and the real document waits in data-src, so the two attribute reads swap places.",
        arm: { operation: "set-variant", payload: { variant: "lazy-images" } },
        expected: {
          extracted: [{
            step: "extract-images", count: 8,
            records: imageRecords(catalogProducts.slice(0, CATALOG_PAGE_SIZE), "lazy-images"),
            optionalFields: ["deferredImage"],
          }],
        },
      }],
    },
    {
      id: "numbered-pages",
      description: "Extract every product by visiting each numbered page control in turn, rather than by following Next.",
      recordingScript: [
        {
          id: "extract-numbered-pages", operation: "extract", target: "testid:product-card",
          fields: cardFields, pagination: numberedPages,
        },
        { id: "numbered-pages-extracted", operation: "checkpoint" },
      ],
      expected: {
        pageFacts: [resultCount("23 products")],
        extracted: [{ step: "extract-numbered-pages", count: 23, records: cardRecords(catalogProducts, "baseline"), pages: 3 }],
        finalState: [pageStatus("Page 3 of 3")],
      },
    },
  ],
});

/**
 * What `cardFields` reads from each card under `variant`. A field whose
 * element the variant leaves off the card is `null`, not an empty string:
 * nothing was read, rather than something read as blank.
 */
function cardRecords(products: readonly CatalogProduct[], variant: CatalogVariant, withAvailability = false): Array<Record<string, string | null>> {
  return products.map((product) => {
    const record: Record<string, string | null> = {
      name: product.name,
      price: cardShowsPrice(product, variant) ? formatPrice(product.priceCents, variant) : null,
      rating: cardShowsRating(product, variant) ? formatRating(product.ratingTenths) : null,
      url: productHref(product, variant),
    };
    if (withAvailability) record.availability = stockLabel(product);
    return record;
  });
}

/** What `imageFields` reads: an eager card carries no `data-src`, so its deferred source is `null`. */
function imageRecords(products: readonly CatalogProduct[], variant: CatalogVariant): Array<Record<string, string | null>> {
  const deferred = variant === "lazy-images";
  return products.map((product) => ({
    name: product.name,
    image: productImagePath(deferred ? CATALOG_PLACEHOLDER_SLUG : product.slug),
    imageAlt: productImageAlt(product),
    deferredImage: deferred ? productImagePath(product.slug) : null,
  }));
}
