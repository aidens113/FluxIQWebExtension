import { fixtureClient } from "../../../html.js";
import { memberNamed, timeAgoSource } from "../data/index.js";
import type { AppPromptIds, ConnectDialogIds, WithdrawDialogIds } from "./dialogs.js";
import type { ShellKit } from "./kit.js";
import type { OverlayIds } from "./overlays.js";
import { ROOT } from "./paths.js";

export type ShellScriptIds = {
  overlays: OverlayIds;
  withdraw: WithdrawDialogIds;
  connect: ConnectDialogIds;
  appPrompt: AppPromptIds | undefined;
  searchInput: string;
  searchMenu: string;
  meButton: string;
  meMenu: string;
  toastHost: string;
};

/**
 * What every page runs. It exposes `window.GL` to the page's own script:
 * `mutate` (which also rewrites the embedded invitation store from the
 * service's answer, as a client store would), `toast`, `nextId`, and the two
 * shared dialogs. It also runs the session's interruptions -- the cookie
 * banner, the app prompt 2.5 seconds after a page that carries it loads, and
 * the conversation that opens 3.5 seconds into the session -- and defines the
 * `gl-time-ago` element, which renders its age inside a shadow root from its
 * `datetime` attribute, so the words "Sent 3 weeks ago" are nowhere in the
 * light DOM.
 */
export function shellClientScript(kit: ShellKit, ids: ShellScriptIds): string {
  const o = ids.overlays;
  const w = ids.withdraw;
  const n = ids.connect;
  const p = ids.appPrompt;
  const j = JSON.stringify;
  return `${fixtureClient(kit.context.runToken, "professional-network")}
${timeAgoSource()}
const byId = (id) => document.getElementById(id);
const ROOT = ${j(ROOT)};
const STORE = document.querySelector('script[type="application/json"][data-testid="invitation-store"]');
let emberNext = ${kit.ids.peek + 40};
const GL = window.GL = {
  root: ROOT,
  nextId: () => 'ember' + (emberNext++),
  async mutate(operation, payload) {
    const snapshot = await mutate(operation, payload);
    const store = snapshot.state.store;
    STORE.textContent = JSON.stringify({ received: store.received, sent: store.sent });
    return snapshot;
  },
  toast(text) {
    const el = document.createElement('div');
    el.className = ${j(kit.css.toast)};
    el.textContent = text;
    byId(${j(ids.toastHost)}).append(el);
    setTimeout(() => el.remove(), 5000);
  },
};
customElements.define('gl-time-ago', class extends HTMLElement {
  connectedCallback() {
    if (this.shadowRoot) return;
    const label = timeAgoLabel(this.getAttribute('datetime') || '', REFERENCE_NOW_MS);
    const text = this.getAttribute('format') === 'sent' ? 'Sent ' + label : label;
    this.attachShadow({ mode: 'open' }).innerHTML = '<span>' + text + '</span>';
  }
});
const consent = byId(${j(o.consent)});
if (consent) {
  const answer = async (choice) => { await GL.mutate('set-consent', { choice }); consent.remove(); };
  byId(${j(o.consentAccept)}).addEventListener('click', () => answer('accepted'));
  byId(${j(o.consentReject)}).addEventListener('click', () => answer('rejected'));
}
byId(${j(o.dockBar)}).addEventListener('click', (event) => {
  if (event.target.closest('button')) return;
  const body = byId(${j(o.dockBody)});
  body.hidden = !body.hidden;
});
const bubble = byId(${j(o.bubble)});
if (bubble) {
  setTimeout(() => { if (!bubble.isConnected) return; bubble.hidden = false; GL.mutate('chat-bubble-seen', {}).catch(() => {}); }, 3500);
  byId(${j(o.bubbleClose)}).addEventListener('click', () => bubble.remove());
  byId(${j(o.bubbleMin)}).addEventListener('click', () => {
    const small = bubble.style.height === '48px';
    bubble.style.height = small ? '' : '48px';
    for (const part of bubble.children) if (part.tagName !== 'HEADER') part.hidden = !small;
  });
  byId(${j(o.bubbleSend)}).addEventListener('click', async () => {
    const input = byId(${j(o.bubbleInput)});
    const text = input.textContent.trim();
    if (!text) return;
    await GL.mutate('send-message', { thread: ${j(memberNamed("Priya Nair").urn)}, text });
    const line = document.createElement('p');
    line.textContent = text;
    byId(${j(o.bubbleBody)}).append(line);
    input.textContent = '';
  });
}
${p === undefined ? "" : `const prompt = byId(${j(p.scrim)});
setTimeout(() => { prompt.hidden = false; }, 2500);
const dismissPrompt = () => { prompt.hidden = true; GL.mutate('dismiss-app-prompt', {}).catch(() => {}); };
byId(${j(p.dismiss)}).addEventListener('click', dismissPrompt);
byId(${j(p.notNow)}).addEventListener('click', dismissPrompt);`}
const search = byId(${j(ids.searchInput)});
const searchMenu = byId(${j(ids.searchMenu)});
search.addEventListener('focus', () => { searchMenu.hidden = false; search.setAttribute('aria-expanded', 'true'); });
search.addEventListener('blur', () => setTimeout(() => { searchMenu.hidden = true; search.setAttribute('aria-expanded', 'false'); }, 200));
search.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' || !search.value.trim()) return;
  location.assign(ROOT + 'search/results/all/?keywords=' + encodeURIComponent(search.value.trim()) + '&origin=GLOBAL_SEARCH_HEADER');
});
byId(${j(ids.meButton)}).addEventListener('click', () => { const menu = byId(${j(ids.meMenu)}); menu.hidden = !menu.hidden; });
let withdrawing = null;
const withdrawScrim = byId(${j(w.scrim)});
const closeWithdraw = () => { withdrawScrim.hidden = true; withdrawing = null; };
GL.openWithdraw = (item) => { withdrawing = item; byId(${j(w.body)}).textContent = item.text; withdrawScrim.hidden = false; };
byId(${j(w.cancel)}).addEventListener('click', closeWithdraw);
byId(${j(w.dismiss)}).addEventListener('click', closeWithdraw);
byId(${j(w.confirm)}).addEventListener('click', async () => {
  const item = withdrawing;
  if (!item) return;
  closeWithdraw();
  await GL.mutate('withdraw-invitation', { urn: item.urn });
  item.onDone();
  GL.toast('Invitation withdrawn');
});
let connecting = null;
const connectScrim = byId(${j(n.scrim)});
const noteField = byId(${j(n.noteField)});
const noteStep = (on) => {
  byId(${j(n.note)}).hidden = !on;
  for (const id of [${j(n.addNote)}, ${j(n.sendBare)}]) byId(id).hidden = on;
  for (const id of [${j(n.cancel)}, ${j(n.send)}]) byId(id).hidden = !on;
};
const closeConnect = () => { connectScrim.hidden = true; connecting = null; noteField.value = ''; byId(${j(n.website)}).value = ''; byId(${j(n.counter)}).textContent = '0/' + noteField.maxLength; noteStep(false); };
GL.openConnect = (item) => {
  connecting = item;
  byId(${j(n.intro)}).textContent = 'Personalize your invitation to ' + item.name + ' by adding a note. Guildline members are more likely to accept invitations that include a note.';
  connectScrim.hidden = false;
};
noteField.addEventListener('input', () => { byId(${j(n.counter)}).textContent = noteField.value.length + '/' + noteField.maxLength; });
byId(${j(n.addNote)}).addEventListener('click', () => noteStep(true));
byId(${j(n.cancel)}).addEventListener('click', closeConnect);
byId(${j(n.dismiss)}).addEventListener('click', closeConnect);
const sendInvitation = async (note) => {
  const item = connecting;
  if (!item) return;
  const website = byId(${j(n.website)}).value;
  closeConnect();
  await GL.mutate('send-invitation', { memberUrn: item.memberUrn, note, website });
  item.onSent();
  GL.toast('Your invitation to ' + item.name + ' was sent.');
};
byId(${j(n.sendBare)}).addEventListener('click', () => sendInvitation(''));
byId(${j(n.send)}).addEventListener('click', () => sendInvitation(noteField.value));
`;
}
