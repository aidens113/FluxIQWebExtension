import { escapeHtml } from "../../../html.js";
import { memberNamed } from "../data/index.js";
import type { ProfessionalNetworkState } from "../types.js";
import type { ShellKit } from "./kit.js";

const CLOSE_ICON = `<svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16"><path d="M14 3.41 12.59 2 8 6.59 3.41 2 2 3.41 6.59 8 2 12.59 3.41 14 8 9.41 12.59 14 14 12.59 9.41 8z" fill="currentColor"/></svg>`;
const DOTS_ICON = `<svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16"><circle cx="3" cy="8" r="1.5" fill="currentColor"/><circle cx="8" cy="8" r="1.5" fill="currentColor"/><circle cx="13" cy="8" r="1.5" fill="currentColor"/></svg>`;
const MINUS_ICON = `<svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16"><path d="M2 7h12v2H2z" fill="currentColor"/></svg>`;

export { CLOSE_ICON };

/** Ids the shell's client script needs to find its overlays again; they rotate with every rendering. */
export type OverlayIds = { consent: string; consentAccept: string; consentReject: string; dock: string; dockBar: string; dockBody: string; bubble: string; bubbleMin: string; bubbleClose: string; bubbleInput: string; bubbleSend: string; bubbleBody: string };

export function overlayIds(kit: ShellKit): OverlayIds {
  const next = kit.ids.next;
  return {
    consent: next(), consentAccept: next(), consentReject: next(), dock: next(), dockBar: next(), dockBody: next(),
    bubble: next(), bubbleMin: next(), bubbleClose: next(), bubbleInput: next(), bubbleSend: next(), bubbleBody: next(),
  };
}

/**
 * The cookie banner, until the session answers it. It asks for nothing a run
 * needs and blocks nothing, but it covers the bottom of every page, which is
 * where a pager and a "Show more" end up once the page is scrolled to them.
 */
export function consentBanner(kit: ShellKit, ids: OverlayIds): string {
  if (kit.state.consent !== "unset") return "";
  const c = kit.css;
  return `<section id="${ids.consent}" class="${c.consent}">
<p class="${c.consentText}">Guildline and 3rd parties use essential and non-essential cookies to provide, secure, analyze and improve our Services, and to show you relevant ads (including professional and job ads) on and off Guildline. Learn more in our <a class="${c.link}" href="#">Cookie Policy</a>.</p>
<button id="${ids.consentAccept}" class="${c.primaryBtn}" type="button">Accept</button>
<button id="${ids.consentReject}" class="${c.secondaryBtn}" type="button">Reject</button>
</section>`;
}

/**
 * The messaging list docked bottom right, and the conversation that pops open
 * to its left a few seconds into the session. The conversation is 336 by 400
 * pixels and sits over whatever the page has there; its controls say who the
 * conversation is with and nothing else, and its Send posts a real message.
 */
export function messagingOverlay(kit: ShellKit, ids: OverlayIds): string {
  const c = kit.css;
  const priya = memberNamed("Priya Nair");
  const threads = [["Priya Nair", "Hi Rafaela! Quick one — are you still hiring for the platform team?", "Sep 20"], ["Hendrik Mol", "Thanks, forwarded to our hiring lead.", "Sep 18"], ["Sophie Laurent", "Can we move the sync to Thursday?", "Sep 15"], ["Wouter de Boer", "Sounds good 👍", "Sep 9"]]
    .map(([name, line, date]) => `<div class="${c.dockRow}"><div class="${c.avatar}" aria-hidden="true">${escapeHtml(initials(name!))}</div><div><div><strong>${escapeHtml(name!)}</strong> <span class="${c.muted} ${c.small}">${date}</span></div><div class="${c.muted} ${c.small}">${escapeHtml(line!)}</div></div></div>`)
    .join("");
  const bubble = kit.state.chatBubbleSeen ? "" : `<section id="${ids.bubble}" class="${c.bubble}" hidden>
<header class="${c.bubbleHead}"><div class="${c.avatar}" aria-hidden="true">PN</div><div style="flex:1"><div><strong>${escapeHtml(priya.name)}</strong></div><div class="${c.muted} ${c.small}">Active now</div></div>
<button class="${c.iconButton}" type="button">${DOTS_ICON}<span class="${c.vh}">Open the options list in your conversation with ${escapeHtml(priya.name)}</span></button>
<button id="${ids.bubbleMin}" class="${c.iconButton}" type="button">${MINUS_ICON}<span class="${c.vh}">Minimize your conversation with ${escapeHtml(priya.name)}</span></button>
<button id="${ids.bubbleClose}" class="${c.iconButton}" type="button">${CLOSE_ICON}<span class="${c.vh}">Close your conversation with ${escapeHtml(priya.name)}</span></button></header>
<div id="${ids.bubbleBody}" class="${c.bubbleBody}"><p class="${c.muted} ${c.small}">SEP 20</p><p class="${c.bubbleMsg}"><strong>${escapeHtml(priya.name)}</strong><br>Hi Rafaela! Quick one — are you still hiring for the platform team? I have someone great for you. Also, did you see Chidi's invitation?</p></div>
<div class="${c.bubbleComposer}"><div id="${ids.bubbleInput}" contenteditable="true" role="textbox" aria-multiline="true" style="flex:1;min-height:40px;border-radius:4px;background:#f4f2ee;padding:8px" data-placeholder="Write a message…"></div><button id="${ids.bubbleSend}" class="${c.primaryBtn}" type="button">Send</button></div>
</section>`;
  return `<aside id="${ids.dock}" class="${c.dock}">
<div id="${ids.dockBar}" class="${c.dockBar}"><div class="${c.avatar}" style="width:32px;height:32px" aria-hidden="true">RI</div><span class="${c.dockTitle}">Messaging</span>
<button class="${c.iconButton}" type="button">${DOTS_ICON}</button></div>
<div id="${ids.dockBody}" class="${c.dockBody}" hidden>${threads}</div>
</aside>${bubble}`;
}

/** The member's own letters, which is what an avatar with no photo shows. */
export function initials(name: string): string {
  return name.split(/\s+/u).filter((part) => /^\p{L}/u.test(part)).slice(0, 2).map((part) => part[0]!.toUpperCase()).join("");
}

/** Whether the app prompt still has to be shown this session. */
export function appPromptPending(state: ProfessionalNetworkState): boolean {
  return !state.appPromptDismissed;
}
