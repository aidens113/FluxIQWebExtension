import { escapeHtml } from "../../../html.js";
import { formatMoney } from "../locale/index.js";
import type { MarketState } from "../state/index.js";
import type { MarketClasses } from "../styles/index.js";

/** The listing the flash-sale popup advertises: a sponsored hub, not the one on the page. */
export const FLASH_DEAL_LISTING_ID = "1005008403519";

/**
 * Everything that interrupts a page. The consent banner is part of the first
 * render, as a real one is; the rest are templates the page stamps out on a
 * delay (`client/shell-script.ts`), so they arrive while a visitor -- or a
 * run -- is already busy with something else.
 *
 * None of them carries a test id, a role, a data hook or an accessible name
 * the live site would not: the page's script binds its handlers to the
 * elements it stamps, by position, the way a component framework does. The
 * close controls are glyphs in plain elements, the chat's minimise control has
 * only a `title`, and every button is a styled div.
 */
export function overlayMarkup(state: MarketState, c: MarketClasses, kind: string, storeName: string | null): string {
  const parts: string[] = [];
  if (state.consent === "pending") parts.push(consentBanner(c));
  if (state.welcome === "pending") parts.push(`<template id="fb-tpl-welcome">${welcomeModal(state, c)}</template>`);
  if (state.notifications === "pending" && (kind === "search" || kind === "item")) parts.push(`<template id="fb-tpl-notify">${notifyCard(c)}</template>`);
  if (kind === "item" && storeName !== null) parts.push(`<template id="fb-tpl-chat">${chatWidget(c, storeName)}</template>`);
  if (kind === "item" && state.mode === "flash-deal" && state.flashDeal === "pending") parts.push(`<template id="fb-tpl-flash">${flashDeal(c)}</template>`);
  return parts.join("\n");
}

function consentBanner(c: MarketClasses): string {
  return `<div class="${c.consent}">
<div class="${c.consentText}"><b>We value your privacy</b><br>Farbazaar and our 214 partners use cookies and similar technologies to keep the site secure, remember your cart, measure performance and show you personalised deals. You can accept all, reject everything that is not essential, or choose. <span class="${c.linkish}">Cookie policy</span></div>
<div class="${c.consentActions}"><div class="${c.btn} ${c.btnGhost}">Manage choices</div><div class="${c.btn}">Reject non-essential</div><div class="${c.btn} ${c.btnPrimary}">Accept all</div></div>
</div>`;
}

function welcomeModal(state: MarketState, c: MarketClasses): string {
  return `<div class="${c.scrim}"><div class="${c.modal}">
<div class="${c.modalClose}">×</div>
<div class="${c.modalTitle}">Welcome back, Mara!</div>
<div class="${c.modalBody}">Your welcome coupons expire tonight. Collect them now and they will be applied at checkout.</div>
<div class="${c.couponTile}"><b>${formatMoney(300, state.region)}</b><span>off orders over ${formatMoney(4000, state.region)}</span></div>
<div class="${c.couponTile}"><b>${formatMoney(500, state.region)}</b><span>off orders over ${formatMoney(6000, state.region)}</span></div>
<div class="${c.btn} ${c.btnPrimary}">Collect all</div>
<div class="${c.btn} ${c.btnGhost}">No thanks</div>
</div></div>`;
}

function notifyCard(c: MarketClasses): string {
  return `<div class="${c.notifyCard}"><b>Never miss a price drop</b><p style="margin:6px 0 10px;font-size:13px">Turn on notifications to hear about flash deals, and when your order ships.</p><div class="${c.btn}">Not now</div> <div class="${c.btn} ${c.btnPrimary}">Allow</div></div>`;
}

function chatWidget(c: MarketClasses, storeName: string): string {
  const store = escapeHtml(storeName);
  return `<div>
<div class="${c.chatPill}"><span>💬 Chat with ${store}</span><span title="Minimize chat">⌄</span></div>
<div class="${c.chatPanel}" hidden><div class="${c.chatHead}"><span>${store} · Online</span><span title="Minimize chat">–</span></div><div class="${c.chatBody}"><p>Hi! 👋 Thanks for visiting ${store}. Ask us anything about this item. We usually reply within 2 hours.</p><input style="width:100%;padding:8px;border:1px solid #ddd;border-radius:6px;font:inherit" placeholder="Type a message…"></div></div>
<div class="${c.chatMinimized}" title="Open chat" hidden>💬</div>
</div>`;
}

function flashDeal(c: MarketClasses): string {
  return `<div class="${c.scrim}"><div class="${c.modal} ${c.flashModal}">
<div class="${c.modalClose}" title="Close" style="color:#fff">×</div>
<div class="${c.modalTitle}">⚡ Flash Deal</div>
<div class="${c.modalBody}" style="color:#fff">Hubsmith 8 in 1 USB C docking station, 40% off for the next <b>10:00</b>. Only 23 left at this price!</div>
<div class="${c.btn}" style="margin-top:14px;background:#fff;color:#c40000">Grab the deal</div>
</div></div>`;
}
