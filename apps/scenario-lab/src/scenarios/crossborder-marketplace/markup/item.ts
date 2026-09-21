import { escapeHtml } from "../../../html.js";
import type { RenderContext } from "../../../types.js";
import { defaultChoice, ORGANIC_LISTINGS, skuOriginalCents, skuPriceCents, skuStock, specOptions, storeById, type Listing, type Shipping, type SkuChoice } from "../catalog/index.js";
import { itemScript } from "../client/index.js";
import { deliveryWindow, formatMoney, priceParts, REGIONS, type RegionCode } from "../locale/index.js";
import type { MarketState } from "../state/index.js";
import type { MarketClasses } from "../styles/index.js";
import { resultCard } from "./cards.js";
import { itemHref, MARKET_ROOT, searchHref } from "./links.js";
import { marketDocument, rotatingId } from "./shell.js";

const REVIEWS = [
  ["M***a", "Germany", 5, "Works with my monitor at 4K, gets warm but not hot. Arrived in three days from the Spanish warehouse."],
  ["J***k", "Poland", 4, "Good hub, the cable is a bit short. Card reader is fast."],
  ["A***o", "Spain", 5, "Exactly as described, well packed. Seller answered my question in an hour."],
  ["P***l", "France", 3, "HDMI works, but the charging pass-through tops out lower than advertised."],
] as const;

/**
 * A product page. The options are div chips and image swatches; the swatches
 * are named only by a `title`. Choosing an option that is already chosen
 * clears it, as the live site does, and a combination the listing has none of
 * is shown struck through and refuses the click. The buy bar is fixed to the
 * bottom of the window, which is where the chat pill and, until answered, the
 * consent banner also live (`styles/stylesheet.ts`). The description is a
 * separate document in a frame, and the store's coupon is a web component with
 * its own shadow root.
 *
 * `basket-redesign` renders the redesigned buy bar: "Add to basket" without
 * the test id "Add to cart" carried, moved to the left, with "Buy now" where
 * it used to be.
 */
export function renderItemPage(state: MarketState, context: RenderContext, c: MarketClasses, listing: Listing): string {
  const store = storeById(listing.storeId);
  const region = state.region;
  const choice = defaultChoice(listing);
  const price = skuPriceCents(listing, choice) ?? listing.priceCents;
  const parts = priceParts(price, region);
  const original = skuOriginalCents(listing, choice) ?? listing.originalCents;
  const specs = specOptions(listing);
  const coupon = store.coupon
    ? `<fb-store-coupon store="${store.id}" off="${escapeHtml(formatMoney(store.coupon.offCents, region))}" minimum="${escapeHtml(formatMoney(store.coupon.minimumCents, region))}" collected="${state.coupons.stores.includes(store.id) ? "yes" : "no"}"></fb-store-coupon>`
    : "";
  const redesigned = state.mode === "basket-redesign";
  const buttons = redesigned
    ? `<div class="${c.addCart}">Add to basket</div><div class="${c.buyNow}">Buy now</div>`
    : `<div class="${c.buyNow}">Buy now</div><div class="${c.addCart}" data-testid="add-to-cart">Add to cart</div>`;
  const moreFromStore = ORGANIC_LISTINGS.filter((candidate) => candidate.storeId === listing.storeId && candidate.id !== listing.id).slice(0, 4);
  const body = `<div class="${c.breadcrumb}"><a href="${MARKET_ROOT}">Home</a> › ${listing.category.map((part, index) => index === listing.category.length - 1 ? `<a href="${searchHref({ q: part.toLowerCase() })}">${escapeHtml(part)}</a>` : escapeHtml(part)).join(" › ")}</div>
<div class="${c.itemLayout}">
<div class="${c.gallery}"><img class="${c.galleryMain}" src="${MARKET_ROOT}img/${listing.id}.svg" alt=""><div class="${c.thumbs}">${[1, 2, 3, 4, 5].map(() => `<div class="${c.thumb}"></div>`).join("")}</div></div>
<div class="${c.itemInfo}">
<h1 class="${c.itemTitle}">${escapeHtml(listing.title)}</h1>
<div class="${c.reviewLine}">${listing.rating === null ? "<span>No reviews yet</span>" : `<span>★ ${(listing.rating / 10).toFixed(1)}</span><span>${listing.reviews.toLocaleString("en-US")} Reviews</span>`}${listing.sold === "" ? "" : `<span>${escapeHtml(listing.sold)}</span>`}</div>
<div class="${c.priceBlock}"><div class="${c.bigPrice}"><span>${escapeHtml(parts.lead)}</span><span>${parts.whole}</span><span>${parts.fraction}</span><span>${escapeHtml(parts.trail)}</span></div><div><span class="${c.priceOriginal}">${escapeHtml(formatMoney(original, region))}</span><span class="${c.discount}">-${Math.round((1 - price / original) * 100)}%</span></div><div class="${c.stockNote}">Tax excluded, add at checkout if applicable</div></div>
${coupon}
<div class="${c.skuGroup}" id="${rotatingId(state, "sku-color")}"><div class="${c.skuLabel}">Color: <b>${escapeHtml(choice.color)}</b></div><div class="${c.swatches}">${listing.colors.map((color) => `<div class="${c.swatch}" title="${escapeHtml(color)}"><img src="${MARKET_ROOT}img/swatch-${slug(color)}.svg" alt=""></div>`).join("")}</div></div>
${specs.length === 0 ? "" : `<div class="${c.skuGroup}" id="${rotatingId(state, "sku-spec")}"><div class="${c.skuLabel}">Specification: <b>${escapeHtml(choice.spec)}</b></div><div class="${c.swatches}">${specs.map((spec) => `<div class="${c.chipOption}">${escapeHtml(spec)}</div>`).join("")}</div></div>`}
<div class="${c.skuGroup}" id="${rotatingId(state, "sku-origin")}"><div class="${c.skuLabel}">Ships From: <b>${escapeHtml(choice.origin)}</b></div><div class="${c.swatches}">${listing.origins.map((origin) => `<div class="${c.chipOption}">${escapeHtml(origin)}</div>`).join("")}</div></div>
<div class="${c.skuGroup}"><div class="${c.skuLabel}">Quantity</div><div class="${c.qtyRow}"><div class="${c.qtyButton}">−</div><input class="${c.qtyInput}" id="${rotatingId(state, "qty")}" type="text" inputmode="numeric" value="1"><div class="${c.qtyButton}">+</div><span class="${c.stockNote}">${skuStock(listing, choice)} pieces available</span></div></div>
<div class="${c.errorTip}"></div>
</div>
<div>
<div class="${c.sideCard}"><b>${escapeHtml(store.name)}</b><br>${store.positiveFeedback} positive feedback · ${store.followers} followers<br><span class="${c.linkish}">Visit store</span> · <span class="${c.linkish}">Follow</span></div>
<div class="${c.sideCard} ${c.deliveryBox}">Ship to <b>${escapeHtml(REGIONS[region].country)}</b><br><span>${escapeHtml(shippingText(listing.shipping, region))}</span><br>Delivery: <span>${escapeHtml(deliveryWindow(choice.origin, region))}</span><br><span>Ships from ${escapeHtml(choice.origin)}</span></div>
<div class="${c.sideCard}"><b>Return &amp; refund policy</b><br>Free returns within 15 days for items shipped from EU warehouses.<br><b>Security &amp; privacy</b><br>Safe payments: we do not share your card details with sellers.</div>
</div>
</div>
<iframe class="${c.descFrame}" title="Item description" src="${itemHref(listing.id)}/description"></iframe>
<div class="${c.reviewList}"><div class="${c.panelTitle}">Customer reviews (${listing.reviews.toLocaleString("en-US")})</div>${listing.rating === null ? "<p>This item has no reviews yet.</p>" : REVIEWS.map(([name, country, stars, text], index) => `<div class="${c.reviewItem}"><b>${name}</b> · ${country} · ${"★".repeat(stars)}${"☆".repeat(5 - stars)} · ${reviewDate(index, region)}<br>${escapeHtml(text)}</div>`).join("")}</div>
${moreFromStore.length === 0 ? "" : `<div class="${c.sectionTitle}">More from ${escapeHtml(store.name)}</div><div class="${c.grid}">${moreFromStore.map((candidate) => resultCard({ listing: candidate, sponsored: false }, c, region)).join("")}</div>`}
<div class="${c.buyBar}"><div class="${c.buyTotal}">Total: <b>${escapeHtml(formatMoney(price, region))}</b></div>${buttons}</div>`;
  const pageData = {
    listingId: listing.id,
    storeId: store.id,
    colors: listing.colors,
    specs,
    origins: listing.origins,
    initial: choice,
    skus: skuTable(listing, region),
    redesigned,
    cart: state.cart,
  };
  return marketDocument({
    state, context, c, kind: "item", chatStore: store.name,
    title: `${listing.title} - Farbazaar`,
    body,
    pageScript: `const pageData = ${JSON.stringify(pageData)};\n${itemScript()}`,
  });
}

/** Every option set's price, stock and delivery, pre-formatted for the region, so the page can switch between them without a request. */
function skuTable(listing: Listing, region: RegionCode): Record<string, { parts: string[]; original: string; off: number; unit: number; stock: number; delivery: string }> {
  const table: Record<string, { parts: string[]; original: string; off: number; unit: number; stock: number; delivery: string }> = {};
  const specs = specOptions(listing);
  for (const color of listing.colors) {
    for (const spec of specs.length === 0 ? [""] : specs) {
      for (const origin of listing.origins) {
        const choice: SkuChoice = { color, spec, origin };
        const price = skuPriceCents(listing, choice)!;
        const original = skuOriginalCents(listing, choice)!;
        const parts = priceParts(price, region);
        table[`${color}|${spec}|${origin}`] = {
          parts: [parts.lead, parts.whole, parts.fraction, parts.trail],
          original: formatMoney(original, region),
          off: Math.round((1 - price / original) * 100),
          unit: price,
          stock: skuStock(listing, choice),
          delivery: deliveryWindow(origin, region),
        };
      }
    }
  }
  return table;
}

function shippingText(shipping: Shipping, region: RegionCode): string {
  if (shipping.kind === "free") return "Free shipping";
  if (shipping.kind === "paid") return `Shipping: ${formatMoney(shipping.cents, region)}`;
  return `Free shipping over ${formatMoney(shipping.cents, region)}`;
}

function reviewDate(index: number, region: RegionCode): string {
  const day = [14, 9, 2, 27][index] ?? 1;
  const month = index === 3 ? "Aug" : "Sep";
  return region === "US" ? `${month} ${day}, 2026` : `${day} ${month} 2026`;
}

function slug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/gu, "-");
}
