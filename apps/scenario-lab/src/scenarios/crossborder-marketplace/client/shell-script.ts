/**
 * What every storefront page does in the browser, before its own script:
 * the interruptions, the header's region picker, the search box, and the
 * flyout refresh.
 *
 * Timings are the live site's, not a test's: the welcome coupons two seconds
 * after load, the chat a second after a product page loads, the notification
 * prompt three and a half seconds in, the flash deal at one and a half. A
 * visitor who has answered one never sees it again, because the answer is
 * posted to the server and the next page is rendered from it.
 *
 * `refreshFlyouts` reloads the cart and account flyouts after a change. It
 * leaves the number on the cart icon alone: that number is only ever right on
 * a fresh page load, which is the live site's stale-badge bug.
 */
export function shellScript(): string {
  return SHELL;
}

const SHELL = String.raw`
const css = boot.css;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const qs = (selector, scope) => (scope || document).querySelector(selector);
const qsa = (selector, scope) => Array.from((scope || document).querySelectorAll(selector));
const byClass = (role, scope) => qs('.' + css[role], scope);
const allByClass = (role, scope) => qsa('.' + css[role], scope);

function toast(text, ms) {
  const region = byClass('toastRegion');
  const node = document.createElement('div');
  node.className = css.toast;
  node.textContent = text;
  region.appendChild(node);
  setTimeout(() => node.remove(), ms || 3200);
}

function stamp(templateId) {
  const template = document.getElementById(templateId);
  if (!template) return null;
  const node = template.content.firstElementChild.cloneNode(true);
  document.body.appendChild(node);
  template.remove();
  return node;
}

async function refreshFlyouts() {
  const response = await fetch(boot.root + 'flyouts', { cache: 'no-store' });
  if (!response.ok) throw new Error('Flyout refresh failed: ' + response.status);
  const fragments = await response.json();
  const flyouts = allByClass('flyout');
  if (flyouts[0]) flyouts[0].outerHTML = fragments.account;
  if (flyouts[1]) flyouts[1].outerHTML = fragments.miniCart;
}

if (boot.kind === 'home') mutate('beacon', {});

// The header search: Enter submits the form natively; the magnifier is a div.
const searchForm = byClass('searchForm');
if (searchForm) byClass('searchButton', searchForm).addEventListener('click', () => searchForm.requestSubmit());

// Consent: three buttons, in the banner's order.
const consent = byClass('consent');
if (consent) {
  const [manage, essential, all] = allByClass('btn', consent);
  const answer = async (choice) => { await mutate('consent', { choice }); consent.remove(); };
  essential.addEventListener('click', () => answer('essential'));
  all.addEventListener('click', () => answer('all'));
  manage.addEventListener('click', () => {
    const text = byClass('consentText', consent);
    text.innerHTML = '<b>Your choices</b><br>Strictly necessary: always on<br>Performance: off<br>Personalised advertising: off';
    manage.textContent = 'Confirm my choices';
    manage.addEventListener('click', () => answer('essential'), { once: true });
  }, { once: true });
}

if (boot.welcome === 'pending') setTimeout(() => {
  const modal = stamp('fb-tpl-welcome');
  if (!modal) return;
  const close = async () => { modal.remove(); await mutate('welcome', { action: 'close' }); };
  byClass('modalClose', modal).addEventListener('click', close);
  const [collect, decline] = allByClass('btn', modal);
  decline.addEventListener('click', close);
  collect.addEventListener('click', async () => {
    modal.remove();
    await mutate('welcome', { action: 'collect' });
    toast('Coupons collected! They will be applied at checkout.');
    await refreshFlyouts();
  });
}, 2000);

if (document.getElementById('fb-tpl-notify')) setTimeout(() => {
  const card = stamp('fb-tpl-notify');
  if (!card) return;
  const [later, allow] = allByClass('btn', card);
  later.addEventListener('click', async () => { card.remove(); await mutate('notifications', { answer: 'later' }); });
  allow.addEventListener('click', async () => { card.remove(); await mutate('notifications', { answer: 'allowed' }); });
}, 3500);

if (document.getElementById('fb-tpl-chat')) setTimeout(() => {
  const widget = stamp('fb-tpl-chat');
  if (!widget) return;
  const pill = byClass('chatPill', widget);
  const panel = byClass('chatPanel', widget);
  const bubble = byClass('chatMinimized', widget);
  const show = (view) => {
    pill.hidden = view !== 'pill';
    panel.hidden = view !== 'panel';
    bubble.hidden = view !== 'minimized';
    pill.style.display = view === 'pill' ? '' : 'none';
    panel.style.display = view === 'panel' ? '' : 'none';
    bubble.style.display = view === 'minimized' ? '' : 'none';
  };
  const go = (view) => { show(view); mutate('chat', { view }); };
  show(boot.chat);
  pill.addEventListener('click', (event) => {
    if (event.target.getAttribute('title') === 'Minimize chat') go('minimized');
    else go('panel');
  });
  qs('[title="Minimize chat"]', panel).addEventListener('click', () => go('minimized'));
  bubble.addEventListener('click', () => go('panel'));
}, 1000);

if (document.getElementById('fb-tpl-flash')) setTimeout(() => {
  const modal = stamp('fb-tpl-flash');
  if (!modal) return;
  const countdown = qs('b', byClass('modalBody', modal));
  let left = 600;
  const timer = setInterval(() => { left -= 1; countdown.textContent = String(Math.floor(left / 60)).padStart(2, '0') + ':' + String(left % 60).padStart(2, '0'); }, 1000);
  byClass('modalClose', modal).addEventListener('click', async () => { clearInterval(timer); modal.remove(); await mutate('flash-deal', { action: 'close' }); });
  byClass('btn', modal).addEventListener('click', () => { location.href = boot.root + 'item/1005008403519?src=flashdeal'; });
}, 1500);

// The region picker is a web component from the storefront's shared header library, with its own shadow root.
const REGION_NAMES = { DE: ['🇩🇪', 'Germany', 'EUR'], ES: ['🇪🇸', 'Spain', 'EUR'], GB: ['🇬🇧', 'United Kingdom', 'GBP'], US: ['🇺🇸', 'United States', 'USD'] };
class RegionPicker extends HTMLElement {
  connectedCallback() {
    if (this.shadowRoot) return;
    const root = this.attachShadow({ mode: 'open' });
    const current = this.getAttribute('region') || 'DE';
    const [flag, country, currency] = REGION_NAMES[current];
    const options = Object.entries(REGION_NAMES).map(([code, names]) => '<option value="' + code + '"' + (code === current ? ' selected' : '') + '>' + names[1] + '</option>').join('');
    root.innerHTML = '<style>.t{cursor:pointer;font-size:12px}.p{position:absolute;margin-top:6px;background:#fff;box-shadow:0 8px 24px rgba(0,0,0,.2);border-radius:8px;padding:12px;width:220px;z-index:50}.s{margin-top:8px;background:#e62e04;color:#fff;border-radius:16px;text-align:center;padding:6px;cursor:pointer}</style>'
      + '<div class="t">Ship to ' + flag + ' ' + country + ' / ' + currency + '</div>'
      + '<div class="p" hidden><div>Ship to</div><select>' + options + '</select><div>Currency follows the country you ship to.</div><div class="s">Save</div></div>';
    const panel = root.querySelector('.p');
    root.querySelector('.t').addEventListener('click', () => { panel.hidden = !panel.hidden; });
    root.querySelector('.s').addEventListener('click', async () => {
      await mutate('region', { region: root.querySelector('select').value });
      location.reload();
    });
  }
}
customElements.define('fb-region', RegionPicker);
`;
