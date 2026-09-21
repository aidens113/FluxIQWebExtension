import { buildClassNames } from "../../../build-classes.js";
import type { MarketMode } from "../state/index.js";

/**
 * Every class the storefront uses, by the role it plays. None of these names
 * reaches the page: each is emitted as a build hash (`css-1x7ab3f`) derived
 * from the lab seed and the build, the way a CSS-in-JS bundle emits them. A
 * different seed is a different bundle, so nothing about a class name survives
 * from one to the next, and a class says which component drew an element --
 * the same `chipOption` hash sits on every variant chip on the page -- never
 * which element it is.
 */
const CLASS_ROLES = [
  "page", "topbar", "topInner", "logo", "logoMark", "searchForm", "searchCategory", "searchInput", "searchButton", "shipTo",
  "account", "flyout", "flyoutTitle", "flyoutLine", "flyoutEmpty", "cartIcon", "cartBadge", "subnav", "subnavLink", "main", "footer", "footerCol",
  "btn", "btnPrimary", "btnGhost", "linkish", "toastRegion", "toast", "spinner",
  "consent", "consentText", "consentActions", "scrim", "modal", "modalClose", "modalTitle", "modalBody", "couponTile",
  "notifyCard", "chatPill", "chatPanel", "chatMinimized", "chatHead", "chatBody", "flashModal",
  "homeGrid", "catMenu", "catLink", "hero", "heroSlide", "sectionTitle", "dealsRow", "feed", "feedStatus", "retry",
  "searchLayout", "sidebar", "filterGroup", "filterTitle", "filterOption", "filterBox", "filterBoxOn", "priceInputs", "priceInput",
  "resultsHead", "resultCount", "chips", "chip", "sortBar", "sortTab", "sortTabOn", "grid", "listView",
  "card", "cardLink", "cardImage", "cardBody", "cardTitle", "price", "priceOriginal", "discount", "metaRow", "stars", "starsFill",
  "ratingValue", "soldCount", "shippingNote", "badges", "badge", "choiceBadge", "storeName", "adTag", "skeleton", "listAside",
  "pager", "pagerItem", "pagerCurrent", "pagerDisabled", "pagerJump", "related",
  "breadcrumb", "itemLayout", "gallery", "galleryMain", "thumbs", "thumb", "itemInfo", "itemTitle", "reviewLine", "priceBlock", "bigPrice",
  "skuGroup", "skuLabel", "swatches", "swatch", "optionOn", "optionOff", "chipOption", "qtyRow", "qtyButton", "qtyInput", "stockNote",
  "sideCard", "deliveryBox", "descFrame", "reviewList", "reviewItem", "buyBar", "buyTotal", "buyNow", "addCart", "errorTip",
  "cartLayout", "cartStore", "cartLine", "cartCheck", "cartSummary",
  "checkoutLayout", "panel", "panelTitle", "addressCard", "shipSelect", "noteBox", "trap", "payFrame", "payMethod", "payRadio",
  "summaryRow", "summaryTotal", "placeOrder", "orderCard", "orderLine", "orderMeta", "verifyBox", "verifyCheck",
] as const;

export type MarketClassRole = (typeof CLASS_ROLES)[number];
export type MarketClasses = Record<MarketClassRole, string>;

/** The two front-end builds: the one that ships, and the buy-bar redesign `basket-redesign` renders. */
export const MARKET_BUILDS = { baseline: "24.37.1", redesign: "24.38.0" } as const;

export function buildFor(mode: MarketMode): string {
  return mode === "basket-redesign" ? MARKET_BUILDS.redesign : MARKET_BUILDS.baseline;
}

/** The components the buy-bar redesign restyled. */
const REDESIGNED_ROLES = ["buyBar", "buyTotal", "buyNow", "addCart"] as const;

/**
 * A CSS-in-JS hash is a hash of a component's styles, so a release that
 * restyles one component renames that component's classes and leaves every
 * other hash where it was. The redesign build is exactly that: the buy bar's
 * four classes are new, and nothing else on the page changes name.
 */
export function marketClasses(seed: number, mode: MarketMode): MarketClasses {
  const shipped = buildClassNames(`farbazaar:${seed}:${MARKET_BUILDS.baseline}`, CLASS_ROLES);
  return mode === "basket-redesign" ? { ...shipped, ...buildClassNames(`farbazaar:${seed}:${MARKET_BUILDS.redesign}`, REDESIGNED_ROLES) } : shipped;
}
