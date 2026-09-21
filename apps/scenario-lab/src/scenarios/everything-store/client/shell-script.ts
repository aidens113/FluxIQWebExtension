import type { StoreClasses, StoreIds } from "../style/index.js";
import type { StoreState } from "../state/index.js";
import { STORE_TIMINGS } from "./timings.js";

const SUGGESTIONS = [
  "wireless earbuds", "wireless earbuds for iphone", "wireless earbuds with mic", "wireless earbuds noise cancelling",
  "wireless earbuds under 30", "earbuds", "earbud tips replacement", "tidewell kettle", "tidewell electric kettle",
  "tidewell gooseneck kettle", "electric kettle", "electric kettle glass",
];

/**
 * The script every store page shares, and the interruptions a real
 * storefront piles onto a visit.
 *
 * - The consent banner answers through the server, so it stays gone.
 * - Two seconds in, an app banner is inserted at the top of the page, in the
 *   flow, and everything below it moves down 64 pixels. Its close control is a
 *   `div` whose only name is a `title`.
 * - Four seconds in, a notifications prompt opens as a modal and the whole
 *   page behind it goes inert until it is answered.
 * - The support chat lives in a shadow root. On a product page it opens
 *   itself five seconds in, and its panel sits over the buy box. Left open,
 *   it is open again on the next page.
 * - The cart badge is updated by an event every add fires, and the handler
 *   adds one whatever the quantity was: the badge is stale until the next
 *   page load.
 *
 * Every nudge the shopper answers is reported to the server, so it does not
 * come back on the next page. One that was never answered comes back on
 * every page, on the same delay.
 */
export function shellScript(state: StoreState, css: StoreClasses, ids: StoreIds, options: { autoOpenChat: boolean }): string {
  const config = {
    css, ids, suggestions: SUGGESTIONS, timings: STORE_TIMINGS, mode: state.mode,
    nudges: state.nudges, autoOpenChat: options.autoOpenChat,
  };
  return `const SHELL = ${JSON.stringify(config)};
${SHELL_BODY}`;
}

const SHELL_BODY = String.raw`
const CLS = SHELL.css;
const IDS = SHELL.ids;
const pageRoot = document.getElementById(IDS.root);
const modals = new Set();
function el(tag, className, attributes, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  for (const [name, value] of Object.entries(attributes || {})) node.setAttribute(name, value);
  if (text !== undefined) node.textContent = text;
  return node;
}
function openModal(name, node) {
  modals.add(name);
  pageRoot.inert = true;
  document.body.append(node);
}
function closeModal(name, node) {
  modals.delete(name);
  node.remove();
  if (modals.size === 0) pageRoot.inert = false;
}
window.storeModals = { open: openModal, close: closeModal, busy: () => modals.size > 0 };

const consent = document.getElementById(IDS.consent);
if (consent) {
  for (const button of consent.querySelectorAll('[data-consent]')) {
    button.addEventListener('click', async () => {
      const choice = button.dataset.consent;
      if (choice === 'customize') {
        consent.querySelector('[data-consent-prefs]').hidden = false;
        return;
      }
      consent.remove();
      await mutate('consent', { choice: choice === 'save' ? 'decline' : choice });
    });
  }
}

if (SHELL.nudges.appBanner === 'pending') {
  setTimeout(() => {
    const banner = el('div', CLS.appBanner, { id: IDS.appBanner, role: 'region', 'aria-label': 'Brightaisle app' });
    banner.innerHTML = '<strong>Shop faster with the Brightaisle app</strong><span>Exclusive app-only deals every day.</span>'
      + '<a class="' + CLS.buttonSmall + '" href="#get-the-app">Get the app</a><div class="' + CLS.linkish + '" title="Close" data-action="dismiss-app">&#x2715;</div>';
    document.body.prepend(banner);
    banner.querySelector('[data-action="dismiss-app"]').addEventListener('click', async () => {
      banner.remove();
      await mutate('dismiss-nudge', { nudge: 'app-banner' });
    });
  }, SHELL.timings.appBanner);
}

function openNotifications() {
  if (window.storeModals.busy()) { setTimeout(openNotifications, 1500); return; }
  const scrim = el('div', CLS.scrim, { id: IDS.notify });
  scrim.innerHTML = '<div class="' + CLS.dialog + '" role="dialog" aria-modal="true" aria-labelledby="' + IDS.notify + 'h">'
    + '<p class="' + CLS.dialogHead + '" id="' + IDS.notify + 'h">Never miss a deal</p>'
    + '<div class="' + CLS.dialogBody + '">Brightaisle would like to send you notifications about price drops, deliveries and Lightning Deals.</div>'
    + '<div class="' + CLS.dialogFoot + '"><button type="button" class="' + CLS.button + '" data-choice="later">Not now</button>'
    + '<button type="button" class="' + CLS.button + ' ' + CLS.buttonPrimary + '" data-choice="allow">Allow notifications</button></div></div>';
  openModal('notifications', scrim);
  for (const button of scrim.querySelectorAll('[data-choice]')) {
    button.addEventListener('click', async () => {
      closeModal('notifications', scrim);
      await mutate('dismiss-nudge', { nudge: 'notifications' });
    });
  }
}
if (SHELL.nudges.notifications === 'pending') setTimeout(openNotifications, SHELL.timings.notifications);

const chatHost = el('div', '', { 'data-chat-host': '' });
document.body.append(chatHost);
const chat = chatHost.attachShadow({ mode: 'open' });
chat.innerHTML = '<style>'
  + '.bubble{position:fixed;right:16px;bottom:16px;z-index:60;width:56px;height:56px;border:0;border-radius:50%;background:#146eb4;color:#fff;font-size:22px;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,.3)}'
  + '.panel{position:fixed;right:16px;bottom:84px;z-index:60;width:360px;height:460px;display:flex;flex-direction:column;border-radius:12px;background:#fff;box-shadow:0 10px 30px rgba(0,0,0,.35);font:14px Arial,sans-serif}'
  + '.panel[hidden]{display:none}.head{display:flex;justify-content:space-between;align-items:center;padding:12px 14px;border-radius:12px 12px 0 0;background:#146eb4;color:#fff;font-weight:700}'
  + '.min{border:0;background:transparent;color:#fff;font-size:18px;cursor:pointer}.log{flex:1;margin:0;padding:14px;list-style:none;overflow:auto}.log li{margin:0 0 10px;padding:8px 10px;border-radius:10px;background:#f0f2f2}'
  + 'form{display:flex;gap:6px;padding:10px;border-top:1px solid #ddd}input{flex:1;padding:6px}'
  + '</style>'
  + '<button class="bubble" type="button" aria-label="Chat with Brightaisle Assistant" aria-expanded="false">?</button>'
  + '<section class="panel" role="dialog" aria-label="Brightaisle Assistant" hidden>'
  + '<div class="head"><span>Brightaisle Assistant</span><button class="min" type="button" aria-label="Minimize chat">&#x2014;</button></div>'
  + '<ol class="log"><li>Hi Dana! I can help with orders, returns and questions about this item.</li><li>Tip: items sold by Brightaisle ship free with Plus.</li></ol>'
  + '<form><input type="text" aria-label="Type your message" placeholder="Type your message"><button type="submit">Send</button></form></section>';
const chatBubble = chat.querySelector('.bubble');
const chatPanel = chat.querySelector('.panel');
function setChat(open, report) {
  chatPanel.hidden = !open;
  chatBubble.setAttribute('aria-expanded', String(open));
  if (report) mutate('chat', { state: open ? 'open' : 'minimized' });
}
chatBubble.addEventListener('click', () => setChat(chatPanel.hidden, true));
chat.querySelector('.min').addEventListener('click', () => setChat(false, true));
chat.querySelector('form').addEventListener('submit', (event) => {
  event.preventDefault();
  const input = chat.querySelector('input');
  if (!input.value.trim()) return;
  const item = document.createElement('li');
  item.textContent = 'An associate will be with you shortly. Current wait: 6 minutes.';
  chat.querySelector('.log').append(item);
  input.value = '';
});
if (SHELL.nudges.chat === 'open') setChat(true, false);
if (SHELL.autoOpenChat && SHELL.nudges.chat === 'idle') setTimeout(() => { if (chatPanel.hidden) setChat(true, true); }, SHELL.timings.chatAutoOpen);

const searchInput = document.getElementById(IDS.searchInput);
const suggest = document.getElementById(IDS.suggest);
if (searchInput && suggest) {
  const form = searchInput.form;
  const hide = () => { suggest.hidden = true; suggest.replaceChildren(); };
  searchInput.addEventListener('input', () => {
    const typed = searchInput.value.trim().toLowerCase();
    const matches = typed.length < 2 ? [] : SHELL.suggestions.filter((entry) => entry.includes(typed)).slice(0, 8);
    suggest.replaceChildren(...matches.map((entry) => {
      const option = el('div', CLS.suggestItem, { role: 'option' }, entry);
      option.addEventListener('mousedown', (event) => {
        event.preventDefault();
        searchInput.value = entry;
        hide();
        form.requestSubmit();
      });
      return option;
    }));
    suggest.hidden = matches.length === 0;
  });
  searchInput.addEventListener('blur', () => setTimeout(hide, SHELL.timings.suggestBlur));
  searchInput.addEventListener('keydown', (event) => { if (event.key === 'Escape') hide(); });
}

for (const trigger of document.querySelectorAll('[data-action="camera-search"], [data-action="voice-search"]')) {
  trigger.addEventListener('click', () => {
    const camera = trigger.dataset.action === 'camera-search';
    const scrim = el('div', CLS.scrim, {});
    scrim.innerHTML = '<div class="' + CLS.dialog + '" role="dialog" aria-modal="true" aria-label="' + (camera ? 'Search with an image' : 'Search by voice') + '">'
      + '<p class="' + CLS.dialogHead + '">' + (camera ? 'Search with an image' : 'Listening...') + '</p>'
      + '<div class="' + CLS.dialogBody + '">' + (camera ? 'Drag an image here or <label>upload a photo<input type="file" accept="image/*" hidden></label>.' : 'Microphone access is blocked for this site.') + '</div>'
      + '<div class="' + CLS.dialogFoot + '"><button type="button" class="' + CLS.button + '" data-close>Close</button></div></div>';
    openModal('search-tool', scrim);
    scrim.querySelector('[data-close]').addEventListener('click', () => closeModal('search-tool', scrim));
  });
}

const deliver = document.querySelector('[data-action="deliver-to"]');
if (deliver) {
  deliver.addEventListener('click', () => {
    if (document.querySelector('[data-deliver-popover]')) return;
    const popover = el('div', CLS.popover, { 'data-deliver-popover': '' });
    popover.innerHTML = '<p><strong>Choose your location</strong></p><p>Delivery options and speeds may vary for different locations.</p>'
      + '<label for="' + IDS.zip + '">ZIP code</label> <input class="' + CLS.input + '" id="' + IDS.zip + '" inputmode="numeric" value="97214"> '
      + '<button type="button" class="' + CLS.button + '" data-apply>Apply</button> <span class="' + CLS.linkish + '" data-dismiss>Done</span>';
    deliver.after(popover);
    for (const closer of popover.querySelectorAll('[data-apply], [data-dismiss]')) closer.addEventListener('click', () => popover.remove());
  });
}

const newsletter = document.querySelector('[data-newsletter]');
if (newsletter) {
  newsletter.addEventListener('submit', async (event) => {
    event.preventDefault();
    const fields = new FormData(newsletter);
    await mutate('subscribe', { email: String(fields.get('email') || ''), website: String(fields.get('website') || '') });
    newsletter.replaceChildren(el('p', '', {}, 'Thanks! Check your inbox to confirm.'));
  });
}

const cartBadge = document.querySelector('[data-testid="cart-count"]');
window.addEventListener('store:cart-added', () => {
  if (cartBadge) cartBadge.textContent = String(Number(cartBadge.textContent || '0') + 1);
});
`;
