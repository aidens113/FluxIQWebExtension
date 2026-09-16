import { escapeHtml, page } from "../../html.js";
import {
  CATALOG_PLACEHOLDER_SLUG, CATALOG_ROOT, cardShowsPrice, cardShowsRating, formatPrice, formatRating,
  productHref, productImageAlt, productImagePath, stockLabel,
} from "./format.js";
import type { CatalogListing, CatalogProduct, CatalogVariant } from "./types.js";

const CATALOG_STYLE = `
  article { display: grid; gap: .1rem; }
  article h3, article p { margin: 0; }
  .badge { font-size: .85rem; padding: 0 .4rem; border-radius: .25rem; background: #e6f4ea; }
  .badge.out { background: #fde8e8; }
  [aria-busy="true"] { opacity: .6; }`;

/** The start page body: search, the in-stock filter, and the `results` region holding the first view. */
export function catalogPageBody(listing: CatalogListing, variant: CatalogVariant): string {
  return `<header><h1>Product catalog</h1><p>A loopback storefront with a fixed catalog for extraction workflows.</p></header>
<main>
  <form role="search" aria-label="Product search" data-testid="search-form">
    <label for="search-input">Search products</label>
    <input id="search-input" name="q" type="search" autocomplete="off" data-testid="search-input">
    <button type="submit" data-testid="search-submit">Search</button>
  </form>
  <fieldset data-testid="filters"><legend>Filters</legend>
    <label><input type="checkbox" name="stock" autocomplete="off" data-testid="in-stock-only"> In stock only</label>
  </fieldset>
  <section data-testid="results" aria-labelledby="results-heading" aria-busy="false">${resultsMarkup(listing, variant)}</section>
</main>
<style>${CATALOG_STYLE}</style>`;
}

/** The inside of the `results` region for one listing. The start page and the `results` route share it. */
export function resultsMarkup(listing: CatalogListing, variant: CatalogVariant): string {
  const { view, resultCount, items } = listing;
  const searching = view.query !== "";
  return [
    `<h2 id="results-heading">${searching ? "Search results" : "All products"}</h2>`,
    `<p data-testid="result-count" role="status">${countLabel(resultCount, searching ? "result" : "product")}</p>`,
    searching ? `<p data-testid="search-summary">${escapeHtml(`Results for "${view.query}"`)}</p>` : "",
    view.inStockOnly ? `<p data-testid="active-filters">Filters: In stock only</p>` : "",
    items.length > 0
      ? `<ul data-testid="product-list" aria-label="Products">${items.map((product) => productCard(product, variant)).join("")}</ul>`
      : `<p data-testid="empty-results">${searching ? "No products match your search." : "No products to show."}</p>`,
    resultCount > 0 ? pagination(listing, variant) : "",
  ].join("");
}

/** A product page, served by the `route` hook at the card's link. */
export function productPageMarkup(product: CatalogProduct, variant: CatalogVariant): string {
  const body = `<main>
  <nav aria-label="Breadcrumb"><a data-testid="back-to-catalog" href="${CATALOG_ROOT}">Back to catalog</a></nav>
  <h1 data-testid="product-title">${escapeHtml(product.name)}</h1>
  <p data-testid="product-price">${formatPrice(product.priceCents, variant)}</p>
  <p data-testid="product-rating">${formatRating(product.ratingTenths)}</p>
  <p>${stockBadge(product)}</p>
</main>
<style>${CATALOG_STYLE}</style>`;
  return page(`${product.name} | Product catalog`, body, "");
}

/**
 * Field elements hold only their text (the name only its link), so read text
 * needs no whitespace normalization. Under `sparse-cards` the price and rating
 * elements are absent rather than empty, which is what makes an optional field
 * read as no value at all.
 */
function productCard(product: CatalogProduct, variant: CatalogVariant): string {
  const nameId = `product-${product.id}-name`;
  return `<li data-testid="product-card" data-product-id="${product.id}"><article aria-labelledby="${nameId}">`
    + productImage(product, variant)
    + `<h3 id="${nameId}" data-testid="product-name"><a data-testid="product-link" href="${productHref(product, variant)}">${escapeHtml(product.name)}</a></h3>`
    + (cardShowsPrice(product, variant) ? `<p data-testid="product-price">${formatPrice(product.priceCents, variant)}</p>` : "")
    + (cardShowsRating(product, variant) ? `<p data-testid="product-rating">${formatRating(product.ratingTenths)}</p>` : "")
    + `<p>${stockBadge(product)}</p>`
    + `</article></li>`;
}

/**
 * The card photo. `lazy-images` defers it as a lazy loader does: `src` holds
 * the shared placeholder and the real document waits in `data-src`. An eager
 * card carries no `data-src` at all, so a read of that attribute finds no
 * value rather than an empty string.
 */
function productImage(product: CatalogProduct, variant: CatalogVariant): string {
  const common = `data-testid="product-image" alt="${escapeHtml(productImageAlt(product))}" width="48" height="48"`;
  return variant === "lazy-images"
    ? `<img ${common} src="${productImagePath(CATALOG_PLACEHOLDER_SLUG)}" data-src="${productImagePath(product.slug)}" loading="lazy">`
    : `<img ${common} src="${productImagePath(product.slug)}">`;
}

/** A card photo document. The card needs one that loads; an extraction reads the attribute and never the bytes. */
export function catalogImageSvg(slug: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" role="img" aria-label="${escapeHtml(slug)}">`
    + `<rect width="48" height="48" fill="#dfe6ef"></rect></svg>`;
}

function stockBadge(product: CatalogProduct): string {
  return `<span data-testid="stock-badge" class="badge${product.inStock ? "" : " out"}">${stockLabel(product)}</span>`;
}

/** Numbered pages and a Next control that is absent, not disabled, on the last page. */
function pagination({ view, pageCount }: CatalogListing, variant: CatalogVariant): string {
  const numbers = Array.from({ length: pageCount }, (_, index) => index + 1).map((number) =>
    `<button type="button" data-testid="pagination-page-${number}" data-page="${number}" aria-label="Page ${number}"${number === view.page ? ' aria-current="page"' : ""}>${number}</button>`);
  const next = view.page < pageCount ? nextControl(view.page + 1, variant) : "";
  return `<nav aria-label="Pagination" data-testid="pagination"><p data-testid="page-status">Page ${view.page} of ${pageCount}</p>${numbers.join("")}${next}</nav>`;
}

/**
 * Next as a button, or as a real link under `link-pagination`. Both carry the
 * same test id and `data-page`, so the client follows either and only the
 * element kind changes.
 */
function nextControl(nextPage: number, variant: CatalogVariant): string {
  return variant === "link-pagination"
    ? `<a data-testid="pagination-next" data-page="${nextPage}" href="${CATALOG_ROOT}?page=${nextPage}" aria-label="Next page">Next</a>`
    : `<button type="button" data-testid="pagination-next" data-page="${nextPage}" aria-label="Next page">Next</button>`;
}

function countLabel(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}
