import { escapeHtml, fixtureClient } from "../../../html.js";
import type { RenderContext } from "../../../types.js";
import { shellScript } from "../client/index.js";
import { REGIONS } from "../locale/index.js";
import type { MarketState } from "../state/index.js";
import { buildFor, marketStylesheet, type MarketClasses } from "../styles/index.js";
import { accountFlyoutMarkup, miniCartMarkup } from "./flyouts.js";
import { MARKET_ROOT } from "./links.js";
import { overlayMarkup } from "./overlays.js";

export type PageKind = "home" | "search" | "item" | "cart" | "checkout" | "order" | "verify";

export type ShellInput = {
  state: MarketState;
  context: RenderContext;
  c: MarketClasses;
  kind: PageKind;
  title: string;
  body: string;
  /** The page's own behaviour, run after the shell's. */
  pageScript: string;
  /** What the header search box holds: the query on a results page, empty elsewhere. */
  query?: string;
  /** The store whose chat widget a product page shows. */
  chatStore?: string;
};

/** The storefront's icon, inline, so a tab never asks the lab server for a `/favicon.ico` it does not have. */
export const FAVICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Crect width='16' height='16' rx='4' fill='%23e62e04'/%3E%3C/svg%3E";

const SUBNAV = ["SuperDeals", "Choice", "Top Brands", "New Arrivals", "Home & Garden", "Computer & Office", "Phones & Telecommunications", "Consumer Electronics", "Sports & Entertainment", "Toys & Hobbies"];
const CATEGORIES = ["All Categories", "Computer & Office", "Consumer Electronics", "Phones & Telecommunications", "Home & Garden", "Sports & Entertainment"];

/**
 * An element id that changes on every page load, the way ids a front-end
 * framework mints per render do. They exist so a label can point at its
 * input; nothing else should rely on them, and a Flow that does fails on the
 * next load.
 */
export function rotatingId(state: MarketState, key: string): string {
  let value = 0x811c9dc5;
  for (const character of `${state.seed}:${state.views}:${key}`) {
    value ^= character.charCodeAt(0);
    value = Math.imul(value, 0x01000193) >>> 0;
  }
  return `fb${value.toString(36)}`;
}

/** The footer's build line: the one place a page says which front-end build drew it. */
export function buildMarkerText(build: string): string {
  return `Farbazaar web ${build}`;
}

/** A whole storefront document: header with flyouts, the page, footer, interruptions, and one module script. */
export function marketDocument(input: ShellInput): string {
  const { state, context, c } = input;
  const region = REGIONS[state.region];
  const boot = {
    root: MARKET_ROOT,
    kind: input.kind,
    css: c,
    region: state.region,
    consent: state.consent,
    welcome: state.welcome,
    notifications: state.notifications,
    chat: state.chat,
    flashDeal: state.mode === "flash-deal" ? state.flashDeal : "none",
    build: buildFor(state.mode),
  };
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(input.title)}</title>
<link rel="icon" href="${FAVICON}">
<style>${marketStylesheet(c)}</style>
</head>
<body>
<div class="${c.page}">
<header class="${c.topbar}">
<div class="${c.topInner}">
<a class="${c.logo}" href="${MARKET_ROOT}"><span class="${c.logoMark}"></span>farbazaar</a>
<form class="${c.searchForm}" action="${MARKET_ROOT}search" method="get">
<select class="${c.searchCategory}" name="cat">${CATEGORIES.map((name, index) => `<option value="${index === 0 ? "" : index}">${escapeHtml(name)}</option>`).join("")}</select>
<input class="${c.searchInput}" id="${rotatingId(state, "q")}" name="q" value="${escapeHtml(input.query ?? "")}" placeholder="Autumn Mega Sale: up to 70% off" autocomplete="off">
<div class="${c.searchButton}"><svg viewBox="0 0 24 24"><path d="M10 3a7 7 0 1 0 4.2 12.6l5.1 5.1 1.4-1.4-5.1-5.1A7 7 0 0 0 10 3zm0 2a5 5 0 1 1 0 10 5 5 0 0 1 0-10z"/></svg></div>
</form>
<div class="${c.shipTo}"><fb-region region="${state.region}" country="${escapeHtml(region.country)}" currency="${region.currency}"></fb-region></div>
<div class="${c.account}"><span>Welcome back<br><b>Mara</b></span>${accountFlyoutMarkup(state, c)}</div>
<div class="${c.account}"><a class="${c.cartIcon}" href="${MARKET_ROOT}cart"><svg width="26" height="26" viewBox="0 0 24 24"><path d="M7 18a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm10 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM3 2h2l3.6 9.6-1.4 2.4A2 2 0 0 0 9 17h11v-2H9.4l1.1-2h7.4a2 2 0 0 0 1.8-1.1L23 5H6.2L5.3 2.6A1 1 0 0 0 4.4 2z"/></svg><span class="${c.cartBadge}">${state.cart.reduce((sum, line) => sum + line.quantity, 0)}</span><span>Cart</span></a>${miniCartMarkup(state, c)}</div>
</div>
<nav class="${c.subnav}">${SUBNAV.map((label) => `<a class="${c.subnavLink}" href="${MARKET_ROOT}search?q=${encodeURIComponent(label.toLowerCase())}">${escapeHtml(label)}</a>`).join("")}</nav>
</header>
<main class="${c.main}">
${input.body}
</main>
<footer class="${c.footer}">
<div class="${c.footerCol}"><b>Customer service</b><br>Help Centre<br>Transaction Services Agreement<br>Take our feedback survey</div>
<div class="${c.footerCol}"><b>Shopping with us</b><br>Making payments<br>Delivery options<br>Buyer protection</div>
<div class="${c.footerCol}"><b>Collaborate with us</b><br>Partnerships<br>Affiliate programme<br>Sell on Farbazaar</div>
<div class="${c.footerCol}"><b>Pay with</b><br>Visa · Mastercard · Farbazaar balance<br><br>© 2010-2026 Farbazaar. All rights reserved.<br><small data-testid="build-marker">${buildMarkerText(buildFor(state.mode))}</small></div>
</footer>
</div>
<div class="${c.toastRegion}" aria-live="polite"></div>
${overlayMarkup(state, c, input.kind, input.chatStore ?? null)}
<script type="module">
${fixtureClient(context.runToken, "crossborder-marketplace")}
const boot = ${JSON.stringify(boot)};
${shellScript()}
${input.pageScript}
</script>
</body>
</html>`;
}
