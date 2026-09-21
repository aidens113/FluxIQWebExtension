import { escapeHtml } from "../../../html.js";
import { CATEGORIES } from "../catalog/index.js";
import { buyingCount } from "../readouts.js";
import { CLASSIFIEDS_ROOT } from "../root.js";
import type { ClassifiedsState } from "../types.js";
import type { ClassSheet, IdName } from "./classes.js";

export type ShellSection = "browse" | "notifications" | "inbox" | "buying" | "selling" | "saved" | "category" | "listing" | "other";

export type ShellInput = {
  sheet: ClassSheet;
  ids: Record<IdName, string>;
  state: ClassifiedsState;
  section: ShellSection;
  category?: string;
  /** Extra sidebar content between the navigation and the categories: the filters, on a results page. */
  sidebarExtra?: string;
  main: string;
};

const ICONS = {
  home: `<path d="M3 11 12 3l9 8v10h-6v-6H9v6H3z"/>`,
  shop: `<path d="M4 8h16l-1 12H5zM8 8a4 4 0 0 1 8 0"/>`,
  bell: `<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 20h4"/>`,
  chat: `<path d="M4 5h16v11H9l-5 4z"/>`,
  grid: `<path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"/>`,
} as const;

function icon(name: keyof typeof ICONS): string {
  return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">${ICONS[name]}</svg>`;
}

/**
 * The frame every page of the marketplace shares: the social network's top
 * bar, with its own "Search Kerbfind" box that searches people and groups,
 * and the Marketplace sidebar with the "Search Marketplace" box that searches
 * listings. The two boxes look alike; only one of them finds anything for sale.
 *
 * Two counts sit in the sidebar. Buying follows the session live. Saved is
 * written when the page is served and never touched again, so after a save it
 * is wrong until the next page load: a stale badge, exactly as shipped.
 */
export function shellMarkup(input: ShellInput): string {
  const { sheet, ids, state } = input;
  const c = sheet.names;
  const nav = (section: ShellSection, href: string, label: string, badge = "") =>
    `<li><a class="${c.navItem}${input.section === section ? ` ${c.navCurrent}` : ""}" href="${href}"${input.section === section ? ` aria-current="page"` : ""}>${label}${badge}</a></li>`;
  const categories = CATEGORIES.map((category) =>
    `<li><a class="${c.categoryLink}${input.category === category.slug ? ` ${c.navCurrent}` : ""}" href="${CLASSIFIEDS_ROOT}category/${category.slug}/">${escapeHtml(category.label)}</a></li>`).join("");
  return `<div class="${c.app}">
<header class="${c.topbar}">
  <a class="${c.brand}" href="${CLASSIFIEDS_ROOT}" aria-label="Kerbfind"><span class="${c.brandMark}">kerbfind</span></a>
  <div class="${c.topSearch}"><input class="${c.topSearchInput}" type="search" placeholder="Search Kerbfind" aria-label="Search Kerbfind" autocomplete="off"></div>
  <nav class="${c.topNav}" aria-label="Kerbfind">
    <a class="${c.topNavItem}" href="${CLASSIFIEDS_ROOT}" aria-label="Home">${icon("home")}</a>
    <a class="${c.topNavItem} ${c.topNavCurrent}" href="${CLASSIFIEDS_ROOT}" aria-label="Marketplace">${icon("shop")}</a>
    <a class="${c.topNavItem}" href="${CLASSIFIEDS_ROOT}notifications/" aria-label="Groups">${icon("grid")}</a>
  </nav>
  <div class="${c.topActions}">
    <div class="${c.iconButton}" role="button" tabindex="0" aria-label="Messenger">${icon("chat")}</div>
    <div class="${c.iconButton}" role="button" tabindex="0" aria-label="Notifications">${icon("bell")}<span class="${c.iconBadge}">3</span></div>
    <div class="${c.avatar}" role="button" tabindex="0" aria-label="Your profile">RA</div>
  </div>
</header>
<div class="${c.layout}">
<aside class="${c.sidebar}">
  <h1 class="${c.sideTitle}">Marketplace</h1>
  <div class="${c.sideSearch}"><input class="${c.sideSearchInput}" type="search" placeholder="Search Marketplace" aria-label="Search Marketplace" autocomplete="off"></div>
  <ul class="${c.navList}">
    ${nav("browse", CLASSIFIEDS_ROOT, "Browse all")}
    ${nav("notifications", `${CLASSIFIEDS_ROOT}notifications/`, "Notifications")}
    ${nav("inbox", `${CLASSIFIEDS_ROOT}inbox/`, "Inbox")}
    ${nav("buying", `${CLASSIFIEDS_ROOT}buying/`, "Buying", ` <span class="${c.navBadge}" data-testid="marketplace_buying_count">${buyingCount(state)}</span>`)}
    ${nav("selling", `${CLASSIFIEDS_ROOT}selling/`, "Selling")}
    ${nav("saved", `${CLASSIFIEDS_ROOT}saved/`, "Saved", ` <span class="${c.navBadge}" data-testid="marketplace_saved_badge">${state.saved.length}</span>`)}
  </ul>
  <div class="${c.createButton}" role="button" tabindex="0">+ Create new listing</div>
  ${input.sidebarExtra ?? ""}
  <div class="${c.sideSection}">
    <h2 class="${c.sideHeading}">Categories</h2>
    <ul class="${c.categoryList}">${categories}</ul>
  </div>
</aside>
<main class="${c.main}">${input.main}</main>
</div>
</div>
<div class="${c.toastRegion}" role="status" aria-live="polite"></div>
${overlays(input)}`;
}

/**
 * What stands in front of the page when it is served: the cookie question
 * until it is answered, and in the `location-check` rendering the location
 * question behind it, revealed once the cookie question is gone.
 */
function overlays({ sheet, ids, state }: ShellInput): string {
  const c = sheet.names;
  const consent = state.consent !== "pending" ? "" : `<div class="${c.scrim}">
  <div class="${c.dialog}" role="dialog" aria-modal="true" aria-labelledby="${ids.consentTitle}">
    <h2 class="${c.dialogTitle}" id="${ids.consentTitle}">Allow the use of cookies from Kerbfind on this browser?</h2>
    <div class="${c.dialogBody}">
      <p>We use cookies and similar technologies to help provide and improve content on Kerbfind, to measure how people use our products, and to show you more relevant listings and adverts.</p>
      <p>Essential cookies keep you signed in and keep the site secure. You can review your choices at any time in your cookie settings.</p>
    </div>
    <div class="${c.dialogFoot}">
      <div class="${c.buttonPlain}" role="button" tabindex="0">Decline optional cookies</div>
      <div class="${c.buttonPrimary}" role="button" tabindex="0">Allow all cookies</div>
    </div>
  </div>
</div>`;
  const locationCheck = state.mode !== "location-check" || state.locationCheck !== "pending" ? "" : `<div class="${c.scrim}" data-testid="marketplace_location_prompt"${state.consent === "pending" ? " hidden" : ""}>
  <div class="${c.dialog}" role="dialog" aria-modal="true" aria-labelledby="${ids.locationTitle}">
    <h2 class="${c.dialogTitle}" id="${ids.locationTitle}">Are you still in Kelford?</h2>
    <div class="${c.dialogBody}"><p>We show you listings within 20 mi of Kelford. If you have moved, change your location so we can show you what is for sale near you.</p></div>
    <div class="${c.dialogFoot}">
      <div class="${c.buttonPlain}" role="button" tabindex="0">Change location</div>
      <div class="${c.buttonPrimary}" role="button" tabindex="0">Yes, that's right</div>
    </div>
  </div>
</div>`;
  return `${consent}${locationCheck}`;
}
