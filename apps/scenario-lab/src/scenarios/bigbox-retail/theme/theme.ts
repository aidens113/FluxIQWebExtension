import { buildClassNames } from "../../../build-classes.js";
import type { BigboxMode } from "../types.js";

/**
 * Every class on the site, the way its CSS-in-JS build emits them: a content
 * hash per role that says nothing about the role. The hash takes the build and
 * the lab seed, so every seed ships a different set of names, and the product
 * page redesign, being a new build, renames every class on the site at once.
 */
const CLASS_ROLES = [
  "page", "header", "headerRow", "logo", "logoMark", "searchForm", "searchInput", "searchButton", "headerLinks", "headerLink",
  "headerSmall", "cartLink", "cartBadge", "cartTotal", "miniCart", "miniCartList", "deptNav", "deptLink", "main", "footer",
  "footerCols", "footerLink", "buildNote", "srOnly", "hp", "btn", "btnPrimary", "btnSecondary", "btnLink", "btnQuiet",
  "scrim", "consent", "consentActions", "promo", "promoClose", "promoDecline", "promoForm",
  "hero", "heroSlide", "heroDots", "heroDot", "rail", "railHead", "railList", "railItem",
  "searchLayout", "sidebar", "facetGroup", "facetLegend", "facetOption", "facetCount", "clearAll", "resultsHead", "resultsTitle",
  "resultsMeta", "chips", "chip", "sortRow", "grid", "tile", "sponsoredTag", "badge", "badgeRollback", "tileLink", "tileImage",
  "img", "priceBlock", "priceNow", "priceMain", "priceSup", "priceWas", "unitPrice", "tileTitle", "ratingRow", "ratingValue",
  "stars", "reviewCount", "fulfil", "fulfilLine", "addButton", "optionsButton", "pagination", "pageLink", "pageCurrent", "pageArrow",
  "pageArrowOff", "emptyResults", "list", "row", "rowMedia", "rowMain", "rowTitle", "rowBuy", "rowPrice", "adPill", "rowFulfil",
  "breadcrumb", "pdpLayout", "gallery", "buyBox", "pdpTitle", "sellerLine", "pdpPrice", "variantLabel", "swatches", "swatch",
  "swatchOn", "swatchPrice", "fulfilOptions", "fulfilOption", "fulfilOptionOn", "fulfilOptionOff", "storeLine", "qtyStepper",
  "qtyControl", "qtyValue", "skeleton", "atcBar", "atcBarTitle", "atcButton", "buyNowButton", "addedPanel", "addedHead", "about",
  "specs", "reviews", "review", "moreReviews", "cartLayout", "cartGroup", "cartGroupHead", "cartLine", "cartLineMain",
  "cartLineActions", "qtySelect", "summaryCard", "summaryRow", "summaryTotal", "checkoutBar", "savedSection", "emptyCart",
  "checkoutLayout", "wall", "wallCard", "fieldRow", "field", "input", "label", "section", "sectionHead", "slotGrid", "slot",
  "slotOn", "slotFull", "spinner", "retry", "paymentOption", "paymentFrame", "placeOrder", "errorBanner", "confirm",
  "confirmHead", "orderNumber", "pickupBox", "orderItems", "orderItem", "totals", "robotPage", "robotCard", "holdButton",
  "holdFill", "robotNote", "chatPill", "chatPillClose", "chatCard", "chatCardClose", "chatPanel", "chatLog", "chatInput",
  "pickerChip", "pickerLabel", "pickerStore", "pickerFlyout", "pickerTabs", "pickerTab", "pickerTabOn", "pickerList",
  "pickerCard", "pickerSet", "pickerCurrent", "pickerClose", "toast", "buyBoxLive", "listLinks",
] as const;

export type BigboxClassRole = (typeof CLASS_ROLES)[number];
export type BigboxClasses = Record<BigboxClassRole, string>;

/** The two builds the site ships; the footer prints which one a page came from, as real sites do. */
export const BIGBOX_BUILDS = { baseline: "web-2026.38.1", redesigned: "web-2026.39.0" } as const;

export function buildOf(mode: BigboxMode): string {
  return mode === "redesigned-buy-box" ? BIGBOX_BUILDS.redesigned : BIGBOX_BUILDS.baseline;
}

/** The class names one build, under one lab seed, emits. */
export function bigboxClasses(mode: BigboxMode, seed: number): BigboxClasses {
  return buildClassNames(`${buildOf(mode)}~${seed}`, CLASS_ROLES);
}
