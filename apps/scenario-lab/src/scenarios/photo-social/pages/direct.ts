import { escapeHtml } from "../../../html.js";
import { EXISTING_THREADS, VIEWER, accountByHandle } from "../data/index.js";
import { glyph } from "../look/index.js";
import type { DirectMessage, PhotoState } from "../types.js";
import type { PageContext } from "./context.js";
import { avatar } from "./media.js";
import { photoDocument } from "./shell.js";
import { ROOT } from "./text.js";

/** A thread's messages: the ones it already had, then what the run sent and the replies it drew. */
export function threadMessages(state: PhotoState, thread: string): DirectMessage[] {
  const existing = EXISTING_THREADS.find((entry) => entry.thread === thread)?.messages ?? [];
  return [...existing, ...state.messages.filter((message) => message.thread === thread)];
}

/**
 * One message. A shared piece is a card linking to the piece: its photo, its
 * name, its price and a note, each on its own line.
 */
export function messageMarkup(ctx: PageContext, message: DirectMessage): string {
  const { cls } = ctx.look;
  const mine = message.from === "me";
  const bubble = `<div class="${cls.bubble}${mine ? ` ${cls.bubbleMine}` : ""}" dir="auto">${escapeHtml(message.text)}</div>`;
  if (!message.card) return bubble;
  const { card } = message;
  return `${bubble}<a class="${cls.card2}" href="${ROOT}${escapeHtml(message.from)}/shop/${card.slug}/"><img alt="${escapeHtml(card.name)}" src="data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#e9e4dc"/><ellipse cx="32" cy="36" rx="16" ry="20" fill="#f7f4ef" stroke="#8a7f70"/></svg>')}" width="64" height="64"><div><span>${escapeHtml(card.name)}</span><span>${escapeHtml(card.price)}</span><span class="${cls.meta}">${escapeHtml(card.note)}</span></div></a>`;
}

function threadList(ctx: PageContext, current: string | undefined): string {
  const { cls } = ctx.look;
  const threads = [...new Set([...ctx.state.messages.map(({ thread }) => thread).reverse(), ...EXISTING_THREADS.map(({ thread }) => thread)])];
  const rows = threads.map((thread) => {
    const last = threadMessages(ctx.state, thread).at(-1);
    const preview = last ? `${last.from === "me" ? "You: " : ""}${last.text}` : "";
    return `<a class="${cls.threadRow}" href="${ROOT}direct/t/${thread}/"${thread === current ? ` aria-current="page"` : ""}>${avatar(thread, cls.avatar)}<div><div class="${cls.handle}">${escapeHtml(accountByHandle(thread)?.name ?? thread)}</div><div class="${cls.meta}">${escapeHtml(preview.slice(0, 48))}</div></div></a>`;
  }).join("");
  return `<aside class="${cls.threadList}"><div class="${cls.cardHead}" style="padding:20px"><span class="${cls.handle}">${VIEWER}</span>${glyph("create", cls.navIcon, "New message")}</div><h2 style="font-size:16px;padding:0 20px">Messages</h2>${rows}</aside>`;
}

/**
 * The composer. The message box is a content-editable div, as the real one is.
 * Beside it, out of sight and out of the tab order, is a field no person
 * fills: a message that arrives with it filled was typed by something filling
 * every field it could find. "Send" shows only once there is something to
 * send; until then the heart stands in its place.
 */
function composerMarkup(ctx: PageContext): string {
  const { cls } = ctx.look;
  return `<form class="${cls.dmComposer}" autocomplete="off">
<div class="${cls.trap}"><label>Leave this field empty<input type="text" name="subject" tabindex="-1" autocomplete="off"></label></div>
${glyph("more", cls.navIcon, "Choose an emoji")}
<div contenteditable="true" role="textbox" aria-label="Message…" aria-multiline="true" spellcheck="true"></div>
<div role="button" tabindex="0" class="${cls.linkButton}" hidden>Send</div>
<div role="button" tabindex="0" class="${cls.iconButton}">${glyph("heart", cls.navIcon, "Like")}</div>
</form>`;
}

/** A conversation: the thread list, the other person, every message, and the composer. */
export function threadPage(ctx: PageContext, thread: string): string {
  const { cls } = ctx.look;
  const account = accountByHandle(thread);
  const messages = threadMessages(ctx.state, thread).map((message) => messageMarkup(ctx, message)).join("");
  const blocked = ctx.state.blocked ? `<p class="${cls.meta}" style="margin:8px 16px">You can't send messages right now.</p>` : "";
  const main = `<div class="${cls.inbox}">${threadList(ctx, thread)}<section class="${cls.conversation}">
<header class="${cls.cardHead}" style="padding:12px 16px;border-bottom:1px solid #dbdbdb">${avatar(thread, cls.avatar)}<div><div class="${cls.handle}">${escapeHtml(account?.name ?? thread)}</div><a class="${cls.meta}" href="${ROOT}${thread}/">${escapeHtml(thread)}</a></div></header>
<div style="flex:1;display:flex;flex-direction:column;padding:12px 0">${messages}</div>
${blocked}${composerMarkup(ctx)}
</section></div>`;
  return photoDocument(ctx, { title: `${account?.name ?? thread} • Direct`, main, modules: ["direct"], page: { kind: "thread", thread, sent: ctx.state.messages.filter((message) => message.thread === thread).length }, dock: false });
}

/** The inbox with no conversation open. */
export function inboxPage(ctx: PageContext): string {
  const { cls } = ctx.look;
  const main = `<div class="${cls.inbox}">${threadList(ctx, undefined)}<section class="${cls.conversation}" style="display:grid;place-items:center"><div style="text-align:center">${glyph("messages", cls.avatarLarge)}<h2>Your messages</h2><p class="${cls.meta}">Send a message to start a chat.</p></div></section></div>`;
  return photoDocument(ctx, { title: "Inbox • Direct", main, modules: [], page: { kind: "inbox" }, dock: false });
}
