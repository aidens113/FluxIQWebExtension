import { buildClassNames } from "../../../build-classes.js";
import { escapeHtml, fixtureClient, page } from "../../../html.js";
import type { RenderContext } from "../../../types.js";
import { referenceStampText } from "../catalog/index.js";
import { shellClientScript } from "../client/index.js";
import { MARKET_ROOT, RESULTS_SUBPATH, WATCHLIST_SUBPATH } from "../paths.js";
import type { AuctionState } from "../types.js";
import { flyoutListsMarkup } from "./flyouts.js";
import { auctionStylesheet, type AuctionClasses } from "./styles.js";

export type ShellKind = "home" | "results" | "item" | "watchlist" | "other";

export type ShellInput = {
  css: AuctionClasses;
  state: AuctionState;
  context: RenderContext;
  kind: ShellKind;
  title: string;
  main: string;
  /** Page-owned overlays: the app promotion, the survey, the bid drawer. */
  overlays?: string;
  pageScript?: string;
  query?: string;
};

/**
 * An element id the way a component framework generates one: opaque, and
 * different on every results page served, so no id a run saw once can be
 * relied on the next time.
 */
export function rotatingId(context: RenderContext, state: AuctionState, name: string): string {
  return (buildClassNames(`id:${context.seed}:${state.resultsViews}`, [name])[name] ?? name).replace("css-", "r-");
}

/**
 * Every page's frame: the signed-in top bar with its two flyout menus, the
 * logo and the search form, the page, the footer, and the three things that
 * sit over every page until the person deals with them -- the cookie banner
 * across the bottom of the window, the assistant's chat launcher in the
 * bottom-right corner, and the greeting it opens a few seconds after load.
 */
export function renderShell(input: ShellInput): string {
  const { css, state, context } = input;
  const lists = flyoutListsMarkup(css, state);
  const body = `<div class="${css.shell}">
<div class="${css.topBar}">
<div class="${css.topLinks}"><span>Hi <strong>Sam</strong>! <a class="${css.topLink}" href="#signout">Sign out</a></span><a class="${css.topLink}" href="#deals">Daily Deals</a><a class="${css.topLink}" href="#help">Help &amp; Contact</a></div>
<div class="${css.topLinks}">
<a class="${css.topLink}" href="#sell">Sell</a>
<div class="${css.menuWrap}"><button class="${css.menuButton}" type="button" aria-expanded="false">Watchlist<span class="${css.badge}">${state.watched.length}</span></button>
<div class="${css.flyout}" hidden><p class="${css.flyoutHead}">Watchlist</p>${lists.watch}<a class="${css.topLink}" href="${MARKET_ROOT}${WATCHLIST_SUBPATH}">See all in Watchlist</a></div></div>
<div class="${css.menuWrap}"><button class="${css.menuButton}" type="button" aria-expanded="false">My Hammerline</button>
<div class="${css.flyout}" hidden><p class="${css.flyoutHead}">Bids &amp; offers</p>${lists.bids}<p class="${css.flyoutHead}">Purchases</p>${lists.purchases}<p class="${css.flyoutHead}">Saved sellers</p>${lists.followed}<a class="${css.topLink}" href="${MARKET_ROOT}${WATCHLIST_SUBPATH}">Watchlist</a></div></div>
<span class="${css.topLink}" title="Notifications">&#128276;</span><span class="${css.topLink}" title="Basket">&#128722;</span>
</div>
</div>
<header class="${css.headerMain}">
<a class="${css.logo}" href="${MARKET_ROOT}">hammerline</a>
<form class="${css.searchForm}" role="search" action="${MARKET_ROOT}${RESULTS_SUBPATH}" method="get">
<input class="${css.searchInput}" type="text" name="_nkw" value="${escapeHtml(input.query ?? "")}" placeholder="Search for anything" aria-label="Search for anything" autocomplete="off">
<select class="${css.searchSelect}" name="_sacat" aria-label="Select a category for search"><option value="0">All Categories</option><option value="625">Cameras &amp; Photography</option><option value="15230">Film Photography</option></select>
<button class="${css.searchButton}" type="submit">Search</button>
</form>
<a class="${css.advanced}" href="#advanced">Advanced</a>
</header>
<main class="${css.main}">${input.main}</main>
<footer class="${css.footer}"><p class="${css.footNote}">Copyright © 2002-2026 Hammerline Marketplaces Ltd. All rights reserved.</p><p class="${css.footNote}">Prices, bids and times as of ${referenceStampText()}.</p></footer>
</div>
${input.overlays ?? ""}
${state.consent === "pending" ? consentMarkup(css) : ""}
${chatMarkup()}
<div class="${css.toastRegion}" aria-live="polite"></div>
<style>${auctionStylesheet(css)}</style>`;
  const boot = { kind: input.kind, consent: state.consent, promoDue: !state.promoDismissed && (input.kind === "home" || input.kind === "results"), greetingDue: !state.greetingDismissed };
  const script = `${fixtureClient(context.runToken, "auction-marketplace")}
${shellClientScript(css, boot)}
${input.pageScript ?? ""}`;
  return page(`${input.title} | Hammerline`, body, script);
}

/**
 * The cookie banner. It is fixed across the bottom of the window, over the
 * pagination and the bottom of the bid drawer, until it is answered. Accept
 * all is a button; Reject all is a styled div that only a pointer can press.
 */
function consentMarkup(css: AuctionClasses): string {
  return `<div class="${css.consent}" role="region" aria-label="Cookie consent">
<p class="${css.consentText}">Hammerline and our 212 partners use cookies and similar technologies to run the site, measure how it is used and show you personalised ads. Choose Accept all to agree, or Manage choices to decide for yourself. You can change your mind at any time in Cookie preferences.</p>
<div class="${css.consentChoices}" hidden><label><input type="checkbox" checked disabled> Strictly necessary</label> <label><input type="checkbox"> Performance</label> <label><input type="checkbox"> Advertising</label></div>
<div class="${css.consentActions}"><button class="${css.button} ${css.buttonPrimary}" type="button">Accept all</button><div class="${css.divButton}">Reject all</div><button class="${css.button} ${css.buttonGhost}" type="button">Manage choices</button></div>
</div>`;
}

/** The assistant's embed. Its markup is the vendor's, with the vendor's stable ids and class names. */
function chatMarkup(): string {
  return `<div id="hal-assist"><button class="hal-launcher" type="button" aria-label="Chat with Hal">Hal</button></div>
<div id="hal-greeting" hidden><div class="hal-close">&#215;</div><p><strong>Hal</strong> · Hammerline Assistant</p><p>Questions about bidding, postage or returns? Ask me anything.</p></div>
<div id="hal-panel" hidden><p><strong>Hal</strong> · usually replies instantly</p><p>Hi Sam! What can I help you with today?</p><input type="text" aria-label="Message Hal" autocomplete="off"></div>`;
}
