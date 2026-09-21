import { NOTE_LIMIT } from "../state.js";
import type { ShellKit } from "./kit.js";
import { CLOSE_ICON } from "./overlays.js";
import { ROOT } from "./paths.js";

export type WithdrawDialogIds = { scrim: string; title: string; body: string; dismiss: string; cancel: string; confirm: string };
export type ConnectDialogIds = { scrim: string; title: string; intro: string; note: string; noteField: string; counter: string; website: string; addNote: string; sendBare: string; cancel: string; send: string; dismiss: string };
export type AppPromptIds = { scrim: string; dismiss: string; notNow: string };

/**
 * The withdraw confirmation, kept in the modal outlet on every page and shown
 * over the invitation manager. As shipped, the confirm control reads
 * "Withdraw", beside "Cancel", and carries the one test hook the design system
 * leaves on a shared dialog. Redesigned, it reads "Withdraw invitation", sits
 * first, has no hook, and "Keep invitation" beside it withdraws nothing.
 */
export function withdrawDialog(kit: ShellKit): { markup: string; ids: WithdrawDialogIds } {
  const c = kit.css;
  const next = kit.ids.next;
  const ids: WithdrawDialogIds = { scrim: next(), title: next(), body: next(), dismiss: next(), cancel: next(), confirm: next() };
  const redesigned = kit.state.mode === "redesigned-withdraw-dialog";
  const title = redesigned ? "Withdraw your invitation?" : "Withdraw invitation";
  const footer = redesigned
    ? `<button id="${ids.confirm}" class="${c.primaryBtn}" type="button">Withdraw invitation</button><button id="${ids.cancel}" class="${c.secondaryBtn}" type="button">Keep invitation</button>`
    : `<button id="${ids.cancel}" class="${c.secondaryBtn}" type="button">Cancel</button><button id="${ids.confirm}" class="${c.primaryBtn}" type="button" data-testid="withdraw-confirm">Withdraw</button>`;
  const markup = `<div id="${ids.scrim}" class="${c.scrim}" hidden><div class="${c.modal}" role="dialog" aria-modal="true" aria-labelledby="${ids.title}">
<div class="${c.modalHead}"><h2 id="${ids.title}">${title}</h2><button id="${ids.dismiss}" class="${c.iconButton}" type="button">${CLOSE_ICON}</button></div>
<div class="${c.modalBody}"><p id="${ids.body}"></p></div>
<div class="${c.modalFoot}">${footer}</div></div></div>`;
  return { markup, ids };
}

/**
 * A connection request, with or without a note. The note step carries a
 * field no person sees -- positioned off screen, out of the tab order, named
 * like a real field -- and the site quietly throws away any request that
 * arrives with it filled.
 */
export function connectDialog(kit: ShellKit): { markup: string; ids: ConnectDialogIds } {
  const c = kit.css;
  const next = kit.ids.next;
  const ids: ConnectDialogIds = { scrim: next(), title: next(), intro: next(), note: next(), noteField: next(), counter: next(), website: next(), addNote: next(), sendBare: next(), cancel: next(), send: next(), dismiss: next() };
  const markup = `<div id="${ids.scrim}" class="${c.scrim}" hidden><div class="${c.modal}" role="dialog" aria-modal="true" aria-labelledby="${ids.title}">
<div class="${c.modalHead}"><h2 id="${ids.title}">Add a note to your invitation?</h2><button id="${ids.dismiss}" class="${c.iconButton}" type="button">${CLOSE_ICON}</button></div>
<div class="${c.modalBody}"><p id="${ids.intro}"></p>
<div id="${ids.note}" hidden><textarea id="${ids.noteField}" class="${c.noteBox}" name="message" maxlength="${NOTE_LIMIT}" placeholder="Ex: We know each other from…"></textarea>
<div id="${ids.counter}" class="${c.counter}">0/${NOTE_LIMIT}</div>
<div class="${c.honeypot}" aria-hidden="true"><label for="${ids.website}">Website</label><input id="${ids.website}" name="website" type="text" tabindex="-1" autocomplete="off"></div></div></div>
<div class="${c.modalFoot}"><button id="${ids.addNote}" class="${c.secondaryBtn}" type="button">Add a note</button><button id="${ids.sendBare}" class="${c.primaryBtn}" type="button">Send without a note</button>
<button id="${ids.cancel}" class="${c.secondaryBtn}" type="button" hidden>Cancel</button><button id="${ids.send}" class="${c.primaryBtn}" type="button" hidden>Send</button></div></div></div>`;
  return { markup, ids };
}

/**
 * The app-install prompt a page opens a few seconds after it loads, until the
 * session dismisses it. Its close control is an unlabelled icon and its
 * "Not now" is a styled block with a click handler and no role.
 */
export function appPrompt(kit: ShellKit): { markup: string; ids: AppPromptIds } {
  const c = kit.css;
  const next = kit.ids.next;
  const ids: AppPromptIds = { scrim: next(), dismiss: next(), notNow: next() };
  const markup = `<div id="${ids.scrim}" class="${c.scrim}" hidden><div class="${c.modal}" role="dialog" aria-modal="true">
<div class="${c.upsell}"><button id="${ids.dismiss}" class="${c.iconButton}" type="button" style="float:right">${CLOSE_ICON}</button><h2>Guildline is better on the app</h2><p>Get notified the moment a recruiter replies, and never miss an invitation.</p></div>
<div class="${c.modalFoot}" style="justify-content:space-between"><div id="${ids.notNow}" class="${c.textBtn}">Not now</div><a class="${c.primaryBtn}" href="${ROOT}app/">Get the app</a></div></div></div>`;
  return { markup, ids };
}
