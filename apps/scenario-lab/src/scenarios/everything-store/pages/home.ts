import { escapeHtml } from "../../../html.js";
import { CATALOG, EARBUDS, HOUSEHOLD, SEARCH_PARAMS, STORE_PATHS, formatMoney, type Product } from "../catalog/index.js";
import type { PageKit } from "./page-kit.js";
import { storePage } from "./shell.js";

const NO_FILTERS = { plus: false, stars4: false, band: null, low: null, high: null, brands: [] } as const;

function searchHref(keywords: string): string {
  return SEARCH_PARAMS.href({ keywords, department: "all", filters: NO_FILTERS, sort: "featured", page: 1 });
}

function tile(kit: PageKit, heading: string, products: readonly (Product | undefined)[], more: { label: string; href: string }): string {
  const { css } = kit;
  const items = products.filter((product): product is Product => product !== undefined).map((product) => `<li><a href="${STORE_PATHS.product(product)}"><img src="${STORE_PATHS.image(product.sku)}" alt="${escapeHtml(product.title)}" width="100" height="100"><br><span>${escapeHtml(product.title.split(",")[0] ?? product.title)}</span></a> <b>${formatMoney(product.priceCents)}</b></li>`).join("");
  return `<div class="${css.tile2}"><p class="${css.tileHead}">${escapeHtml(heading)}</p><ul style="list-style:none;padding:0">${items}</ul><a href="${escapeHtml(more.href)}">${escapeHtml(more.label)}</a></div>`;
}

/**
 * The storefront's home page, which is where every task starts: a rotating
 * hero and four tiles. "Keep shopping for" leads straight to the brand's
 * other kettle, the gooseneck, which is not the one either kettle task wants.
 */
export function renderHomePage(kit: PageKit): string {
  const { css } = kit;
  const slides = ["Kitchen upgrades: up to 25% off Tidewell", "New in headphones: this week's top-rated earbuds", "Stock up on everyday essentials"];
  const body = `<div class="${css.hero}" role="region" aria-roledescription="carousel" aria-label="Featured offers">${slides.map((slide, index) => `<div class="${css.heroSlide}"${index === 0 ? "" : " hidden"}>${escapeHtml(slide)}</div>`).join("")}</div>
<div class="${css.tiles}">
${tile(kit, "Keep shopping for", [CATALOG.bySku("B0TWGOOSE9"), EARBUDS[58]], { label: "View your browsing history", href: STORE_PATHS.home })}
${tile(kit, "Deals on kettles", [], { label: "Shop Tidewell kettles", href: searchHref("tidewell kettle") })}
${tile(kit, "Buy again", [HOUSEHOLD.batteries], { label: "See more in Buy Again", href: STORE_PATHS.home })}
${tile(kit, "Top picks in headphones", [], { label: "Shop wireless earbuds", href: searchHref("wireless earbuds") })}
</div>`;
  const script = `const slides = document.querySelectorAll('[aria-roledescription="carousel"] > div');
let shown = 0;
setInterval(() => { slides[shown].hidden = true; shown = (shown + 1) % slides.length; slides[shown].hidden = false; }, 5000);`;
  return storePage(kit, { title: "Brightaisle.com. Spend less. Smile more.", body, script });
}
