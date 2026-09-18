import { escapeHtml, fixtureClient, page } from "../../html.js";
import { orderBookScript } from "./client-script.js";
import { ORDER_OPERATIONS_ROOT } from "./format.js";
import { applyOrderChanges, bookSummaryText, ordersFor, resultCountText } from "./ledger.js";
import { dispatchNoteMarkup, orderTableMarkup, orderToolbarMarkup } from "./order-table.js";
import { ORDER_GLYPHS, orderBuildMarker, orderClasses, orderIcon, orderStylesheet, type OrderClasses } from "./styles.js";
import type { RenderContext } from "../../types.js";
import type { CustomerOrder, OrderOperationsState } from "./types.js";

/** The merchant whose back office this is. Fictional, and named the same on every run. */
const WORKSPACE = "Northgate Trading";
const SIGNED_IN_AS = { name: "Rowan Pike", initials: "RP" };

/**
 * The navigation an internal tool of this size has. Orders is the book, and
 * everything else is a destination this fixture does not need to build.
 */
const NAV_GROUPS: ReadonlyArray<{ label: string; items: ReadonlyArray<{ label: string; href?: string; count?: number }> }> = [
  {
    label: "Sales",
    items: [{ label: "Orders", href: ORDER_OPERATIONS_ROOT }, { label: "Customers" }, { label: "Products" }, { label: "Returns", count: 6 }],
  },
  {
    label: "Operations",
    items: [{ label: "Dispatch" }, { label: "Stock" }, { label: "Payouts" }, { label: "Reports" }, { label: "Settings" }],
  },
];

/**
 * The whole order book for one state.
 *
 * Everything a run changed is rendered back: a reload shows the refunds it
 * gave and the orders it sent, so the page and the server oracle cannot
 * disagree. The armed renderings differ from the baseline in exactly one thing
 * each -- the dispatch-run shortcut, or how many orders the book holds -- and
 * in nothing else.
 */
export function renderOrderBookPage(state: OrderOperationsState, context: RenderContext): string {
  const css = orderClasses();
  const orders = applyOrderChanges(ordersFor(state.mode), state.refunds, state.dispatched, state.cancelled);
  const content = `<div class="${css.pageHead}">
<div>
<h1 class="${css.pageTitle}">Orders</h1>
<p class="${css.statLine}" data-testid="book-summary">${bookSummaryText(orders)}</p>
</div>
<div class="${css.pageActions}">${dispatchShortcut(css, state.mode)}<button class="${css.button}" type="button" data-action="export">Export</button><button class="${css.button} ${css.buttonPrimary}" type="button" data-action="new-order">New order</button></div>
</div>
<section class="${css.card}" aria-labelledby="book-heading">
<h2 class="${css.srOnly}" id="book-heading">Order book</h2>
${orderToolbarMarkup(css)}
<div data-testid="dispatch-note-region">${dispatchNoteMarkup(css, dispatchedOrders(orders, state.dispatched))}</div>
<div class="${css.tableWrap}">${orderTableMarkup(css, orders)}</div>
<div class="${css.tableFoot}"><p class="${css.footNote}" data-testid="result-count">${resultCountText(orders.length, orders.length)}</p><p class="${css.footNote}">Totals include delivery.</p></div>
</section>
<footer class="${css.appFoot}"><small data-testid="build-marker">${orderBuildMarker()}</small></footer>`;
  const script = `${fixtureClient(context.runToken, "order-operations")}
${orderBookScript(css)}`;
  return orderDocument("Orders", css, orderShell(css, "Orders", content), script);
}

/**
 * The dispatch-run shortcut: the control that puts the book into this week's
 * paid, unpicked orders.
 *
 * It is the first control in the header's action group, and that is how the
 * page's own script finds it -- the bundle and the markup come out of one
 * build, so the script needs no hook of its own. `relabelled-dispatch` is the
 * next release of this control and nothing else: same place, same job, and
 * none of the three things a recording writes down. It carries no `data-`
 * attribute in either rendering, because an added hook would be a signal the
 * drift was measured without.
 */
function dispatchShortcut(css: OrderClasses, mode: OrderOperationsState["mode"]): string {
  return mode === "relabelled-dispatch"
    ? `<button class="${css.buttonNeutral}" type="button">Pick and pack</button>`
    : `<button class="${css.button}" type="button" data-testid="dispatch-run">Dispatch run</button>`;
}

/** The orders a run has sent, in the order it sent them: the dispatch note's own list. */
export function dispatchedOrders(orders: readonly CustomerOrder[], dispatched: readonly string[]): CustomerOrder[] {
  return dispatched.flatMap((reference) => orders.filter((order) => order.reference === reference));
}

/** The application shell every screen sits in: the sidebar, the top bar, and the page's own content. */
export function orderShell(css: OrderClasses, current: string, content: string): string {
  return `<div class="${css.app}">
${sidebar(css, current)}
<div class="${css.main}">
${topbar(css)}
<main class="${css.content}">${content}</main>
</div>
</div>
<div class="${css.toastRegion}" data-testid="toast-region" aria-live="polite"></div>
<style>${orderStylesheet(css)}</style>`;
}

/** One desk document: the lab's page shell, this desk's title, and whatever script the screen needs. */
export function orderDocument(title: string, css: OrderClasses, body: string, script: string): string {
  return page(`${title} · ${WORKSPACE}`, body, script);
}

function sidebar(css: OrderClasses, current: string): string {
  const groups = NAV_GROUPS.map((group) => `<p class="${css.navLabel}">${escapeHtml(group.label)}</p>
<ul class="${css.navList}">${group.items.map((item) => navItem(css, item, current)).join("")}</ul>`).join("");
  return `<aside class="${css.sidebar}">
<div class="${css.brand}"><span class="${css.brandMark}" aria-hidden="true">N</span><span>${escapeHtml(WORKSPACE)}</span></div>
<button class="${css.userButton}" type="button" aria-haspopup="listbox" aria-expanded="false" data-action="switch-store">Main store${orderIcon(css.navIcon, ORDER_GLYPHS.chevron)}</button>
<nav aria-label="Main">${groups}</nav>
<div class="${css.sidebarFoot}"><p>Carrier collection at 16:30.</p></div>
</aside>`;
}

function navItem(css: OrderClasses, item: { label: string; href?: string; count?: number }, current: string): string {
  const isCurrent = item.label === current;
  const classes = isCurrent ? `${css.navItem} ${css.navCurrent}` : css.navItem;
  const href = item.href ?? `#${item.label.toLowerCase().replaceAll(" ", "-")}`;
  const count = item.count === undefined ? "" : `<span class="${css.navCount}">${item.count}</span>`;
  return `<li><a class="${classes}" href="${href}"${isCurrent ? ' aria-current="page"' : ""}>${orderIcon(css.navIcon, ORDER_GLYPHS.square)}<span>${escapeHtml(item.label)}</span>${count}</a></li>`;
}

/**
 * The top bar. Its search input's accessible name is "Search", which is also
 * the book filter's: two controls on one page with one name, labelled the way
 * a real design system's optional `label` prop ends up being passed -- one
 * properly, one only through `title`, and one not at all.
 */
function topbar(css: OrderClasses): string {
  return `<header class="${css.topbar}">
<form class="${css.searchForm}" role="search"><label class="${css.srOnly}" for="global-search">Search</label><input class="${css.searchInput}" id="global-search" type="search" name="q" autocomplete="off" placeholder="Search ${escapeHtml(WORKSPACE)}"></form>
<div class="${css.topActions}">
<button class="${css.iconButton}" type="button" aria-label="Notifications" data-action="notifications">${orderIcon(css.navIcon, ORDER_GLYPHS.bell)}</button>
<button class="${css.iconButton}" type="button" title="What's new" data-action="changelog">${orderIcon(css.navIcon, ORDER_GLYPHS.sparkle)}</button>
<button class="${css.iconButton}" type="button" data-action="apps">${orderIcon(css.navIcon, ORDER_GLYPHS.square)}</button>
<button class="${css.userButton}" type="button" aria-haspopup="menu" aria-expanded="false" data-action="account"><span class="${css.avatar}" aria-hidden="true">${SIGNED_IN_AS.initials}</span><span>${escapeHtml(SIGNED_IN_AS.name)}</span>${orderIcon(css.navIcon, ORDER_GLYPHS.chevron)}</button>
</div>
</header>`;
}
