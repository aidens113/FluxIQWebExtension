import { MARKET_ROOT } from "../paths.js";

/** What the frame needs to know about the session when the page starts. */
export type ShellBoot = { kind: string; consent: string; promoDue: boolean; greetingDue: boolean };

/**
 * The browser side of every page's frame: the flyout menus, the cookie
 * banner, the chat assistant, the app promotion, the watch hearts and
 * buttons, and the header lists the oracle reads.
 *
 * Everything that changes the session goes through the fixture's `mutate`,
 * and anything that shows the result waits until the header lists have been
 * refreshed from the server first, so a control that says "Watching" or a
 * drawer that says "You're the highest bidder" is never ahead of the lists.
 *
 * The class names arrive as data, as a real bundle and its markup share one
 * build's hashes.
 */
export function shellClientScript(css: Record<string, string>, boot: ShellBoot): string {
  return `const css = ${JSON.stringify(css)};
const boot = ${JSON.stringify(boot)};
const marketRoot = ${JSON.stringify(MARKET_ROOT)};
${SHELL_CORE}`;
}

const SHELL_CORE = String.raw`
function byClass(role, scope = document) { return scope.querySelector('.' + css[role]); }
function allByClass(role, scope = document) { return Array.from(scope.querySelectorAll('.' + css[role])); }

function toast(text) {
  const node = document.createElement('div');
  node.className = css.toast;
  node.textContent = text;
  byClass('toastRegion').append(node);
  setTimeout(() => node.remove(), 5000);
}

async function refreshHeader() {
  const response = await fetch(marketRoot + 'fragments/header', { cache: 'no-store' });
  if (!response.ok) return;
  const template = document.createElement('template');
  template.innerHTML = await response.text();
  for (const fresh of template.content.querySelectorAll('ul[data-testid]')) {
    const current = document.querySelector('ul[data-testid="' + fresh.getAttribute('data-testid') + '"]');
    if (current) current.replaceWith(fresh);
  }
}

for (const wrap of allByClass('menuWrap')) {
  const button = wrap.querySelector('button');
  const panel = byClass('flyout', wrap);
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    const opening = panel.hidden;
    for (const other of allByClass('flyout')) other.hidden = true;
    for (const other of allByClass('menuButton')) other.setAttribute('aria-expanded', 'false');
    panel.hidden = !opening;
    button.setAttribute('aria-expanded', String(opening));
  });
}
document.addEventListener('click', (event) => {
  if (event.target instanceof Element && event.target.closest('.' + css.menuWrap)) return;
  for (const panel of allByClass('flyout')) panel.hidden = true;
});

const consentBanner = byClass('consent');
if (consentBanner) {
  const [accept, manage] = consentBanner.querySelectorAll('button');
  const reject = byClass('divButton', consentBanner);
  const choices = byClass('consentChoices', consentBanner);
  const decide = async (choice) => { consentBanner.remove(); await mutate('consent', { choice }); };
  accept.addEventListener('click', () => decide('accepted'));
  reject.addEventListener('click', () => decide('rejected'));
  manage.addEventListener('click', () => {
    if (choices.hidden) { choices.hidden = false; manage.textContent = 'Save choices'; return; }
    const optional = Array.from(choices.querySelectorAll('input:not([disabled])')).some((box) => box.checked);
    decide(optional ? 'accepted' : 'rejected');
  });
}

const greeting = document.getElementById('hal-greeting');
const chatPanel = document.getElementById('hal-panel');
document.querySelector('#hal-assist .hal-launcher').addEventListener('click', () => {
  chatPanel.hidden = !chatPanel.hidden;
  if (!chatPanel.hidden) greeting.hidden = true;
});
if (boot.greetingDue) setTimeout(() => { if (chatPanel.hidden) greeting.hidden = false; }, 3500);
greeting.addEventListener('click', async (event) => {
  if (event.target instanceof Element && event.target.closest('.hal-close')) {
    greeting.hidden = true;
    await mutate('dismiss-greeting');
    return;
  }
  greeting.hidden = true;
  chatPanel.hidden = false;
});

const promo = byClass('promo');
if (promo) {
  const dismissPromo = async () => { promo.remove(); await mutate('dismiss-promo'); };
  byClass('notNow', promo).addEventListener('click', dismissPromo);
  byClass('modalClose', promo).addEventListener('click', dismissPromo);
  if (boot.promoDue) setTimeout(() => { if (promo.isConnected) promo.hidden = false; }, 2500);
}

const HEART_PATH = 'M12 21s-7-4.4-9.3-8.6C1 9 3 5 6.6 5c2 0 3.4 1.1 5.4 3 2-1.9 3.4-3 5.4-3C21 5 23 9 21.3 12.4 19 16.6 12 21 12 21z';

function applyWatch(last) {
  if (!last) return;
  if (last.outcome === 'rate-limited') {
    toast('Slow down! You can change your Watchlist again in ' + last.retryAfter + ' seconds.');
    return;
  }
  const watching = last.outcome === 'watching';
  for (const heart of document.querySelectorAll('hl-watch[data-item="' + last.itemId + '"]')) {
    heart.setAttribute('data-watched', String(watching));
    if (typeof heart.paint === 'function') heart.paint();
  }
  for (const cta of allByClass('watchCta')) {
    if (cta.value !== last.itemId) continue;
    cta.setAttribute('aria-pressed', String(watching));
    const path = cta.querySelector('path');
    if (path) {
      path.setAttribute('fill', watching ? '#e0103a' : 'none');
      path.setAttribute('stroke', watching ? '#e0103a' : '#191919');
    } else {
      cta.textContent = watching ? '♥ Watching' : '♡ Add to Watchlist';
    }
  }
  toast(watching ? 'Added to your Watchlist' : 'Removed from your Watchlist');
}

async function toggleWatch(itemId) {
  const snapshot = await mutate('toggle-watch', { itemId });
  const last = snapshot.state.lastWatch;
  if (last && last.outcome !== 'rate-limited') await refreshHeader();
  applyWatch(last);
  return last;
}

class WatchHeart extends HTMLElement {
  connectedCallback() {
    if (this.shadowRoot) return;
    const root = this.attachShadow({ mode: 'open' });
    root.innerHTML = '<style>div{width:34px;height:34px;border-radius:50%;background:#fff;display:grid;place-items:center;cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,.3)}svg{width:18px;height:18px}</style><div><svg viewBox="0 0 24 24"><path d="' + HEART_PATH + '" stroke-width="1.8"/></svg></div>';
    this.paint();
    root.querySelector('div').addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      toggleWatch(this.getAttribute('data-item'));
    });
  }
  paint() {
    if (!this.shadowRoot) return;
    const watched = this.getAttribute('data-watched') === 'true';
    const path = this.shadowRoot.querySelector('path');
    path.setAttribute('fill', watched ? '#e0103a' : 'none');
    path.setAttribute('stroke', watched ? '#e0103a' : '#191919');
    this.shadowRoot.querySelector('div').title = watched ? 'Remove from Watchlist' : 'Watch this item';
  }
}
if (!customElements.get('hl-watch')) customElements.define('hl-watch', WatchHeart);

for (const cta of allByClass('watchCta')) cta.addEventListener('click', () => { toggleWatch(cta.value); });

for (const button of allByClass('followCta')) {
  const label = button.title;
  button.addEventListener('click', async () => {
    const snapshot = await mutate('follow-seller', { seller: button.value });
    await refreshHeader();
    const saved = snapshot.state.followed.includes(button.value);
    button.setAttribute('aria-pressed', String(saved));
    button.textContent = saved ? 'Seller saved' : label;
    toast(saved ? 'Seller saved' : 'Seller removed');
  });
}
`;
