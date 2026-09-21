import { escapeHtml } from "../../../html.js";
import { STORE_PATHS } from "../catalog/index.js";
import { ACCOUNT } from "../state/index.js";
import type { PageKit } from "./page-kit.js";

const MAGNIFIER = `<svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" focusable="false"><circle cx="8" cy="8" r="6" fill="none" stroke="#111" stroke-width="2"/><path d="M13 13l5 5" stroke="#111" stroke-width="2"/></svg>`;
const CAMERA = `<svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" focusable="false"><rect x="2" y="5" width="16" height="11" rx="2" fill="none" stroke="#111" stroke-width="1.6"/><circle cx="10" cy="10.5" r="3" fill="none" stroke="#111" stroke-width="1.6"/></svg>`;
const MICROPHONE = `<svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" focusable="false"><rect x="7" y="2" width="6" height="10" rx="3" fill="none" stroke="#111" stroke-width="1.6"/><path d="M4 10a6 6 0 0 0 12 0M10 16v2" fill="none" stroke="#111" stroke-width="1.6"/></svg>`;

const DEPARTMENTS: ReadonlyArray<readonly [string, string]> = [["all", "All"], ["electronics", "Electronics"], ["home", "Home & Kitchen"], ["grocery", "Grocery"], ["toys", "Toys & Games"]];

/**
 * The search form. Three things about it are what a real one ships and what
 * automation trips on.
 *
 * The first text field in the form is not the search box: it is an
 * off-screen honeypot named the way search fields are usually named, hidden
 * from people and from assistive technology, and a request that comes back
 * with it filled tells the store it was not typed by a person. The real box
 * comes after it.
 *
 * The baseline submit button is the one control on the site with a test id,
 * because that is what the recording lane names and what a redesign takes
 * away. `redesigned-header` removes it, relabels the button "Search
 * Brightaisle" -- the same name the search box itself has -- moves it left,
 * and puts "Search with your camera" and "Search by voice" where it was.
 */
function searchForm(kit: PageKit, keywords: string, department: string): string {
  const { css, ids, state } = kit;
  const options = DEPARTMENTS.map(([value, label]) => `<option value="${value}"${value === department ? " selected" : ""}>${escapeHtml(label)}</option>`).join("");
  const submit = state.mode === "redesigned-header"
    ? `<button class="${css.searchSubmit}" type="submit" aria-label="Search Brightaisle">${MAGNIFIER}</button><button class="${css.searchExtra}" type="button" aria-label="Search by voice" data-action="voice-search">${MICROPHONE}</button><button class="${css.searchExtra}" type="button" aria-label="Search with your camera" data-action="camera-search">${CAMERA}</button>`
    : `<button class="${css.searchSubmit}" type="submit" aria-label="Go" data-testid="nav-search-submit">${MAGNIFIER}</button>`;
  return `<form class="${css.searchForm}" role="search" action="${STORE_PATHS.search}" method="get" autocomplete="off">
<label class="${css.srOnly}" for="${ids.searchDept}">Search in</label><select class="${css.searchDept}" id="${ids.searchDept}" name="i">${options}</select>
<input class="${css.honeypot}" type="text" name="field-keywords" value="" tabindex="-1" autocomplete="off" aria-hidden="true">
<label class="${css.srOnly}" for="${ids.searchInput}">Search Brightaisle</label><input class="${css.searchInput}" id="${ids.searchInput}" type="text" name="k" value="${escapeHtml(keywords)}" placeholder="Search Brightaisle" autocomplete="off" spellcheck="false">
${submit}
<div class="${css.suggestList}" id="${ids.suggest}" role="listbox" aria-label="Search suggestions" hidden></div>
</form>`;
}

/** Everything in the cart counts toward the badge, quantity by quantity, as of this page load. */
function cartCount(kit: PageKit): number {
  return kit.state.cart.reduce((sum, line) => sum + line.quantity, 0);
}

/**
 * The store header: logo, a "Deliver to" control that is a `div` with a
 * click handler and no role, the search form, the account links, and the
 * cart. The cart badge is right when a page loads and is updated afterwards by
 * a script with a bug in it.
 */
export function headerMarkup(kit: PageKit, keywords = "", department = "all"): string {
  const { css } = kit;
  const count = cartCount(kit);
  return `<header class="${css.header}">
<a class="${css.logo}" href="${STORE_PATHS.home}" aria-label="Brightaisle">brightaisle</a>
<div class="${css.deliver}" data-action="deliver-to" tabindex="0">Deliver to ${escapeHtml(ACCOUNT.firstName)}<br><b>${escapeHtml(ACCOUNT.deliverTo)}</b></div>
${searchForm(kit, keywords, department)}
<a class="${css.headerLink}" href="${STORE_PATHS.home}#account">Hello, ${escapeHtml(ACCOUNT.firstName)}<span class="${css.headerStrong}">Account &amp; Lists</span></a>
<a class="${css.headerLink}" href="${STORE_PATHS.home}#orders">Returns<span class="${css.headerStrong}">&amp; Orders</span></a>
<a class="${css.cartLink}" href="${STORE_PATHS.cart}" aria-label="${count} items in cart"><span class="${css.cartBadge}" data-testid="cart-count">${count}</span>Cart</a>
</header>
<nav class="${css.subnav}" aria-label="Shop by">${["All", "Today's Deals", "Customer Service", "Registry", "Gift Cards", "Sell"].map((label) => `<a class="${css.subnavLink}" href="${STORE_PATHS.home}#${label.toLowerCase().replace(/[^a-z]+/gu, "-")}">${escapeHtml(label)}</a>`).join("")}</nav>`;
}
