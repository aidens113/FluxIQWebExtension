import { escapeHtml, page } from "../../../html.js";
import type { RenderContext } from "../../../types.js";
import { formatMoney, SITE_ROOT } from "../catalog/index.js";
import { cartTotals } from "../cart/index.js";
import { shellScript } from "../client/index.js";
import type { BigboxState, PageKind, TileDefault } from "../types.js";
import { consentDialogMarkup } from "./consent-dialog.js";
import { elementId } from "../theme/index.js";
import { miniCartMarkup } from "./mini-cart.js";
import { storePickerMarkup } from "./store-picker.js";
import { bigboxStylesheet } from "../theme/index.js";
import { supportChatMarkup } from "./support-chat.js";
import { bigboxClasses, buildOf, type BigboxClasses } from "../theme/index.js";

export type ShellInput = {
  state: BigboxState;
  context: RenderContext;
  kind: PageKind;
  title: string;
  /** The search box's text, on a results page. */
  query?: string;
  /** What each quick-add button on the page adds, by item id. */
  tileDefaults?: Readonly<Record<string, TileDefault>>;
  main(c: BigboxClasses): string;
  /** This page's own script, run after the shell's. */
  script?(c: BigboxClasses): string;
};

const DEPARTMENTS = ["Departments", "Services", "Get it Fast", "Rollbacks & More", "New Arrivals", "Back to School", "Household Essentials", "Pharmacy Delivery", "Registry"];
const FOOTER_LINKS = ["All Departments", "Store Directory", "Careers", "Our Company", "Sell on ValueRidge", "Help", "Product Recalls", "Accessibility", "Tax Exempt Program", "Get the ValueRidge App", "Privacy choices", "Terms of Use", "Notice at Collection"];

/**
 * One whole page of the store: header, department bar, the page itself,
 * footer, and what floats over all of them -- the consent dialog until it is
 * answered, and the support widget always. The header's count badge is drawn
 * here, from state, and nothing redraws it until the next page load.
 */
export function renderShell(input: ShellInput): string {
  const { state, context, kind } = input;
  const c = bigboxClasses(state.mode, context.seed);
  const totals = cartTotals(state.cart, state.storeId);
  const departments = DEPARTMENTS.map((label) => `<a class="${c.deptLink}" href="${label === "Rollbacks & More" ? `${SITE_ROOT}search?q=paper+towels&amp;facet=special_offers%3ARollback` : "#"}">${escapeHtml(label)}</a>`).join("");
  const weeklyAd = `<a class="${c.deptLink}" href="${SITE_ROOT}weekly-ad" target="_blank" rel="noopener">Weekly Ad</a>`;
  const footer = FOOTER_LINKS.map((label) => `<a class="${c.footerLink}" href="#">${escapeHtml(label)}</a>`).join("");
  const body = `<style>${bigboxStylesheet(c)}</style><div class="${c.page}">
<header class="${c.header}"><div class="${c.headerRow}">
<a class="${c.logo}" href="${SITE_ROOT}"><span class="${c.logoMark}"></span>ValueRidge</a>
${storePickerMarkup(state.storeId, c)}
<form class="${c.searchForm}" action="${SITE_ROOT}search" method="get" role="search"><input class="${c.searchInput}" type="search" name="q" value="${escapeHtml(input.query ?? "")}" placeholder="Search everything at ValueRidge online and in store" aria-label="Search" autocomplete="off"><button class="${c.searchButton}" type="submit" aria-label="Search">&#9906;</button></form>
<nav class="${c.headerLinks}"><a class="${c.headerLink}" href="#"><span class="${c.headerSmall}">Reorder</span>My Items</a><a class="${c.headerLink}" href="#"><span class="${c.headerSmall}">Sign In</span>Account</a>
<a class="${c.cartLink}" href="${SITE_ROOT}cart"><span aria-hidden="true">&#128722;</span><span class="${c.cartBadge}">${totals.itemCount}</span><span class="${c.cartTotal}">${formatMoney(totals.subtotalCents)}</span></a></nav>
<div class="${c.miniCart}" data-testid="mini-cart" hidden>${miniCartMarkup(state, c)}</div>
</div><nav class="${c.deptNav}" aria-label="Departments">${departments}${weeklyAd}</nav></header>
<main class="${c.main}">${input.main(c)}</main>
<footer class="${c.footer}"><div class="${c.footerCols}">${footer}</div><small class="${c.buildNote}">&copy; 2026 ValueRidge Stores, Inc. · ${escapeHtml(buildOf(state.mode))}</small></footer>
</div>${state.consent === "pending" ? consentDialogMarkup(c, elementId(context.seed, "consent-title")) : ""}${supportChatMarkup(c, kind !== "cart")}`;
  const script = `${shellScript({ runToken: context.runToken, classes: c, kind, consent: state.consent, promo: state.promo, chatCard: state.chatCard, tileDefaults: input.tileDefaults ?? {} })}\n${input.script?.(c) ?? ""}`;
  return page(`${input.title} - ValueRidge`, body, script);
}
