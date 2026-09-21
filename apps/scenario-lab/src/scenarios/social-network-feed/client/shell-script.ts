import type { FeedClasses } from "../markup/index.js";
import type { FeedState } from "../types.js";

/** Which page the script is running on, so each page wires only what it has. */
export type ClientPage = "home" | "group" | "friends" | "post" | "other";

/**
 * What the page's script is handed. The class names arrive as data, as a real
 * bundle's do: the script and the markup come from one build and share its
 * hashes, and the script finds its own elements by them -- the page carries no
 * attribute that exists only so a script can find something.
 */
export type ClientConfig = {
  C: FeedClasses;
  root: string;
  me: string;
  page: ClientPage;
  consent: FeedState["consent"];
  prompt: FeedState["notificationsPrompt"];
  chat: FeedState["chat"];
  /** Posts whose menu refuses Edit, Edit audience and Move to archive because they are running as a boost. */
  boosted: string[];
  /** The whole text of every long post on the page, which "See more" puts back. */
  texts: Record<string, string>;
  group?: string;
  groupName?: string;
  regrouped?: boolean;
  /** Friend request ids by the requester's profile slug. */
  requests?: Record<string, string>;
  rate?: { max: number; windowMs: number };
};

/** How long after the cookie answer the notification prompt takes to appear, and how long after that answer the chat pops open. */
export const OVERLAY_DELAYS = { promptMs: 3_000, chatMs: 2_500 } as const;

/**
 * The part of the script every page runs: ids, toasts, and the three
 * overlays that arrive on their own schedule.
 *
 * Ids are assigned as elements mount, from one counter, in the shape a
 * component framework generates (`:r1k:`), so an element's id depends on what
 * loaded before it and changes whenever it is rendered again.
 *
 * The overlays follow one another. The cookie dialog is there on arrival until
 * it is answered; three seconds after the answer, the site asks to turn on
 * notifications; two and a half seconds after that is answered, a chat window
 * pops open with a message from a friend, docked over the bottom right of the
 * page, and stays open from page to page until it is closed. Each answer is
 * saved for the account, so none of them comes back after a reload -- until
 * the lab resets the account.
 */
export function shellScript(config: ClientConfig): string {
  return `const CFG = ${JSON.stringify(config)};
const OVERLAY = ${JSON.stringify(OVERLAY_DELAYS)};
${SHELL}`;
}

const SHELL = String.raw`
const C = CFG.C;
const cls = (role) => C[role].split(' ')[0];
const q = (role, root) => (root || document).querySelector('.' + cls(role));
const qa = (role, root) => Array.from((root || document).querySelectorAll('.' + cls(role)));
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function esc(text) {
  return String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[c]);
}
let idSeq = 0;
function hydrate(root) {
  const nodes = [root].concat(Array.from(root.querySelectorAll('[data-uid],[data-lb],[data-db]')));
  const ids = {};
  for (const node of nodes) {
    const key = node.getAttribute && node.getAttribute('data-uid');
    if (!key) continue;
    const id = ':r' + (idSeq++).toString(36) + ':';
    ids[key] = id;
    node.id = id;
    node.removeAttribute('data-uid');
  }
  for (const node of nodes) {
    if (!node.getAttribute) continue;
    for (const [attr, aria] of [['data-lb', 'aria-labelledby'], ['data-db', 'aria-describedby']]) {
      const keys = node.getAttribute(attr);
      if (keys === null) continue;
      const resolved = keys.split(' ').map((key) => ids[key]).filter(Boolean);
      if (resolved.length) node.setAttribute(aria, resolved.join(' '));
      node.removeAttribute(attr);
    }
  }
  return root;
}
function fromHtml(html) {
  const box = document.createElement('div');
  box.innerHTML = html;
  hydrate(box);
  return Array.from(box.childNodes);
}
function toast(text) {
  const region = q('toastRegion');
  if (!region) return;
  const note = document.createElement('div');
  note.className = C.toast;
  note.textContent = text;
  region.appendChild(note);
  setTimeout(() => note.remove(), 6000);
}
function onPress(node, handler) {
  node.addEventListener('click', handler);
  node.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); handler(event); } });
}
function dialogHtml(title, body, buttons, extra) {
  return '<div class="' + C.scrim + '"><div class="' + C.dialog + '" role="' + ((extra && extra.role) || 'dialog') + '" aria-modal="true" data-lb="dlg-t"><div class="' + C.dialogHead + '"><h2 class="' + C.dialogTitle + '" data-uid="dlg-t">' + esc(title) + '</h2>' + ((extra && extra.close) ? '<div class="' + C.dialogClose + '" role="button" tabindex="0" aria-label="Close">&#x2715;</div>' : '') + '</div><div class="' + C.dialogBody + '">' + body + '</div><div class="' + C.dialogFoot + '">' + buttons + '</div></div></div>';
}
function mount(html) {
  const [node] = fromHtml(html);
  document.body.appendChild(node);
  return node;
}

// The cookie dialog is server-rendered while the question is open.
const consentBox = q('consent');
if (consentBox) {
  const answer = (choice) => {
    consentBox.closest('.' + cls('scrim')).remove();
    CFG.consent = choice;
    mutate('consent', { choice }).then(() => schedulePrompt(OVERLAY.promptMs));
  };
  onPress(q('primaryButton', consentBox), () => answer('all'));
  onPress(q('secondaryButton', consentBox), () => answer('essential'));
}

function schedulePrompt(delay) {
  if (CFG.consent === 'pending' || CFG.prompt !== 'pending') return;
  setTimeout(showPrompt, delay);
}
function showPrompt() {
  const scrim = mount(dialogHtml('Turn on notifications?', '<p style="margin:0">Get notified when friends post, comment or send you a message. You can turn notifications off at any time in your settings.</p>', '<div class="' + C.secondaryButton + '" role="button" tabindex="0">Not now</div><div class="' + C.primaryButton + '" role="button" tabindex="0">Turn on</div>', { close: true }));
  const answer = (choice) => {
    scrim.remove();
    CFG.prompt = choice;
    if (choice === 'allowed') toast('Notifications are on for this browser.');
    mutate('notifications', { choice }).then(() => scheduleChat(OVERLAY.chatMs));
  };
  onPress(q('secondaryButton', scrim), () => answer('dismissed'));
  onPress(q('dialogClose', scrim), () => answer('dismissed'));
  onPress(q('primaryButton', scrim), () => answer('allowed'));
}

function scheduleChat(delay) {
  if (CFG.consent === 'pending' || CFG.prompt === 'pending' || CFG.chat !== 'unopened') return;
  setTimeout(() => { CFG.chat = 'open'; openChat(); mutate('chat', { state: 'open' }); }, delay);
}
function openChat() {
  const chat = mount('<div class="' + C.chat + '" role="dialog" aria-label="Chat with Elena Sokolova"><div class="' + C.chatHead + '"><span class="' + C.avatarSmall + '" style="background:hsl(280 45% 55%);border-radius:50%;width:32px;height:32px;display:inline-block"></span><div style="flex:1"><strong>Elena Sokolova</strong><div class="' + C.muted + '" style="font-size:12px">Active now</div></div><div class="' + C.unitHide + '" role="button" tabindex="0" aria-label="Minimise chat">&#x2013;</div><div class="' + C.unitHide + '" role="button" tabindex="0" aria-label="Close chat">&#x2715;</div></div><div class="' + C.chatBody + '"><div class="' + C.chatBubble + '">Morning! Are you still doing the jam stall at the open day?</div><div class="' + C.chatBubble + '">I can bring the gazebo if you need it</div></div><div class="' + C.composerRow + '" style="padding:8px"><div class="' + C.chatInput + '" contenteditable="true" role="textbox" aria-label="Message"></div><div class="' + C.chatSend + '" role="button" tabindex="0"><svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 20l18-8L3 4v6l12 2-12 2z" fill="currentColor"/></svg></div></div></div>');
  const [minimise, close] = qa('unitHide', chat);
  onPress(close, () => { chat.remove(); CFG.chat = 'closed'; mutate('chat', { state: 'closed' }); });
  onPress(minimise, () => { const body = q('chatBody', chat); const row = q('composerRow', chat); const hidden = body.hidden; body.hidden = !hidden; row.hidden = !hidden; chat.style.height = hidden ? '' : '56px'; });
  onPress(q('chatSend', chat), () => {
    const input = q('chatInput', chat);
    const text = input.textContent.trim();
    if (!text) return;
    const bubble = document.createElement('div');
    bubble.className = C.chatBubble;
    bubble.style.justifySelf = 'end';
    bubble.textContent = text;
    q('chatBody', chat).appendChild(bubble);
    input.textContent = '';
    mutate('chat-message', { text });
  });
}

hydrate(document.body);
if (CFG.chat === 'open') openChat();
else if (CFG.prompt !== 'pending') scheduleChat(OVERLAY.chatMs);
else schedulePrompt(OVERLAY.promptMs);
`;
