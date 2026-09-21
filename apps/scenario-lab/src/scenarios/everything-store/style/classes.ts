import { buildClassNames } from "../../../build-classes.js";

/**
 * Every class the store's pages use, by the role it plays. A role name never
 * reaches the page: the page carries only the hash, which is derived from the
 * lab seed, so a different seed renames every class at once. Nothing a person
 * reads depends on them.
 */
const ROLES = [
  "root", "header", "logo", "deliver", "searchForm", "searchDept", "searchInput", "searchSubmit", "searchExtra", "honeypot",
  "headerLink", "headerStrong", "cartLink", "cartBadge", "subnav", "subnavLink", "main", "footer", "footerCols", "newsletter",
  "input", "button", "buttonPrimary", "buttonSmall", "linkish", "srOnly", "consent", "consentActions", "appBanner",
  "scrim", "dialog", "dialogHead", "dialogBody", "dialogFoot", "toast", "popover", "suggestList", "suggestItem",
  "searchLayout", "rail", "railGroup", "railHeading", "railLink", "railBox", "railBoxOn", "priceForm", "priceInput",
  "resultsBar", "sortSelect", "results", "card", "skeleton", "skelBlock", "cardImgLink", "cardImg", "cardBody",
  "brandLine", "cardTitle", "titleLink", "reviews", "stars", "ratingNum", "ratingCount", "social", "priceRow", "priceLink",
  "price", "offscreen", "priceSym", "priceWhole", "priceDec", "priceFrac", "listPrice", "strike", "coupon", "couponBadge",
  "delivery", "plusBadge", "adLabel", "adInfo", "carousel", "carouselHead", "carouselTrack", "carouselItem", "widget",
  "sentinel", "pagination", "pageLink", "pageCurrent", "pageDisabled", "pageGap", "noResults", "wheel", "wheelDisc",
  "productLayout", "gallery", "galleryMain", "thumbs", "center", "productTitle", "byline", "pick", "priceBlock", "savings",
  "variations", "variationLabel", "swatchList", "swatch", "swatchOn", "swatchOff", "tileList", "tile", "tileOn", "tilePrice",
  "bullets", "buyBox", "buyPrice", "stock", "stockLow", "qtySelect", "addButton", "buyNowButton", "protection", "soldBy",
  "otherSellers", "sidePanel", "offerRow", "fbt", "fbtRow", "related", "specs", "reviewsBlock", "loginWall", "sideSheet",
  "spinner", "cartLayout", "cartMain", "cartRow", "cartCheck", "cartTitle", "variationLine", "cartActions", "qtyControl",
  "qtyButton", "qtyValue", "rowPrice", "subtotal", "cartAside", "savedGrid", "savedItem", "rowError", "rowBusy",
  "checkoutLayout", "section", "sectionHead", "changeLink", "optionList", "optionRow", "upsell", "summary", "summaryRow",
  "summaryTotal", "placeButton", "paymentFrame", "confirmBox", "confirmLine", "challengePage", "challengeBox",
  "captchaCanvas", "challengeError", "hero", "heroSlide", "tiles", "tile2", "tileHead",
] as const;

export type StoreClassRole = (typeof ROLES)[number];
export type StoreClasses = Record<StoreClassRole, string>;

/** The class names of one seed's build. */
export function storeClasses(seed: number): StoreClasses {
  return buildClassNames(`brightaisle:${seed}`, ROLES);
}
