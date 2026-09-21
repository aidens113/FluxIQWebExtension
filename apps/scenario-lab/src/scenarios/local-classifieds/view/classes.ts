import { fnv } from "../catalog/index.js";

/**
 * The marketplace's class names, the way an atomic-CSS build emits them.
 *
 * Every element carries a handful of short hashes -- `x1lliihq x6ikm8r
 * x10wlt62` -- and none of them says what the element is. One of each set is
 * the rule that styles it; the rest are atoms shared across unrelated
 * components, so the same hash sits on a card, a filter and a dialog at once.
 * All of them are derived from the lab seed, so every seed is a different
 * build: nothing a Flow learns from one seed's class names survives another.
 */
const ROLES = [
  "app", "topbar", "brand", "brandMark", "topSearch", "topSearchInput", "topNav", "topNavItem", "topNavCurrent", "topActions", "iconButton", "iconBadge", "avatar",
  "layout", "sidebar", "sideTitle", "sideSearch", "sideSearchInput", "navList", "navItem", "navCurrent", "navBadge", "createButton", "sideSection", "sideHeading", "categoryList", "categoryLink",
  "main", "toastRegion", "toast", "srOnly", "scrim", "dialog", "dialogTitle", "dialogBody", "dialogFoot", "buttonPrimary", "buttonPlain", "linkButton", "closeX", "fieldError", "honeypot",
  "resultsHead", "resultsTitle", "resultsCount", "filterBlock", "filterLabel", "filterToggle", "filterPanel", "priceRow", "priceInput", "choiceRow", "combobox", "listbox", "option",
  "feed", "grid", "list", "cardWrap", "card", "cardMedia", "cardImage", "cardSponsor", "cardPriceRow", "cardPrice", "cardWas", "cardTitle", "cardPlace",
  "rowCard", "rowMedia", "rowBody", "rowTitle", "rowMeta", "skeleton", "loadMore", "retry", "feedEnd", "outsideHead", "challenge", "spinner",
  "pdp", "pdpMedia", "pdpPhoto", "pdpThumbs", "pdpThumb", "pdpArrow", "heart", "pdpPanel", "pdpTitle", "pdpPriceRow", "pdpPrice", "pdpWas", "pdpListed", "pdpActions", "actionButton", "actionPrimary",
  "pdpSection", "pdpSectionTitle", "detailRow", "detailKey", "detailValue", "description", "seeMore", "distance", "mapFrame", "sellerCard", "sellerName", "sellerMeta",
  "stickyBar", "messageBox", "messageLabel", "messageInput", "sendButton", "offerButton", "receipt", "offerRow", "offerInput", "textarea",
  "chatDock", "chatHead", "chatName", "chatBody", "chatBubble", "chatBubbleMine", "chatInput", "chatControl",
  "pageHead", "pageTitle", "savedTotal", "select", "savedList", "savedRow", "savedMedia", "savedTitle", "savedPrice", "savedStatus", "savedMeta", "chip",
  "threadList", "thread", "threadName", "threadSnippet", "emptyState", "shopHead", "shopBody",
] as const;

export type ClassRole = (typeof ROLES)[number];

/** `names[role]` is the full class attribute; `keys[role]` is the one hash the stylesheet selects on. */
export type ClassSheet = { names: Record<ClassRole, string>; keys: Record<ClassRole, string> };

const SHARED_ATOMS = 18;

export function classifiedsClasses(seed: number): ClassSheet {
  const atom = (text: string) => `x${fnv(`${seed}:${text}`).toString(36)}`;
  const shared = Array.from({ length: SHARED_ATOMS }, (_, index) => atom(`shared:${index}`));
  const names = {} as Record<ClassRole, string>;
  const keys = {} as Record<ClassRole, string>;
  for (const role of ROLES) {
    const key = atom(`role:${role}`);
    const extra = 1 + (fnv(`${seed}:count:${role}`) % 4);
    const picked = Array.from({ length: extra }, (_, index) => shared[fnv(`${seed}:${role}:${index}`) % SHARED_ATOMS]!);
    keys[role] = key;
    names[role] = [...new Set([picked[0]!, key, ...picked.slice(1)])].join(" ");
  }
  return { names, keys };
}

/**
 * The ids a page needs to tie a label to its field, React `useId` style:
 * `:r1k:`. They count up from a base the seed picks, so they are unique on a
 * page and different on every seed, and they are not a valid CSS id selector
 * without escaping, which is true of the real thing too.
 */
const ID_NAMES = ["consentTitle", "locationTitle", "notifyTitle", "sortLabel", "sortList", "conditionPanel", "datePanel", "availabilityPanel", "deliveryPanel",
  "dateGroup", "availabilityGroup", "deliveryGroup", "offerTitle", "offerAmount", "offerNote", "messageInput", "savedSort", "chatTitle", "radiusSelect", "shareTitle"] as const;

export type IdName = (typeof ID_NAMES)[number];

export function classifiedsIds(seed: number): Record<IdName, string> {
  const base = 40 + (fnv(`${seed}:ids`) % 900);
  return Object.fromEntries(ID_NAMES.map((name, index) => [name, `:r${(base + index * 3).toString(32)}:`])) as Record<IdName, string>;
}
