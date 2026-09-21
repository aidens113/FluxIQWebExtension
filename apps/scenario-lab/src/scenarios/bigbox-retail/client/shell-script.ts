import { fixtureClient } from "../../../html.js";
import { SITE_ROOT, STORES } from "../catalog/index.js";
import type { BigboxClasses } from "../theme/index.js";
import type { BigboxState, PageKind, TileDefault } from "../types.js";

export type ShellScriptInput = {
  runToken: string;
  classes: BigboxClasses;
  kind: PageKind;
  consent: BigboxState["consent"];
  promo: BigboxState["promo"];
  chatCard: BigboxState["chatCard"];
  tileDefaults: Readonly<Record<string, TileDefault>>;
};

/** How long after a page becomes usable the email offer opens, and how long the support card waits on a product page. */
export const PROMO_DELAY_MS = 2_200;
export const CHAT_CARD_DELAY_MS = 3_000;

/**
 * What every page does in the browser. The things a shopper runs into:
 *
 * - The consent dialog is answered through the store and removed; until then
 *   nothing else opens.
 * - A little after the page is usable -- after consent is answered, or after
 *   load when it already was -- an email offer opens over a scrim, on every
 *   page load until it is closed or declined. Its close control is a bare
 *   "×" in a div, and its form has a hidden field only a bot would fill.
 * - The first press of any quick-add or Add to cart button after a load only
 *   finishes waking the page up, and adds nothing; the second press adds.
 * - The mini cart is redrawn from the store after every change. The count
 *   badge beside it is not.
 */
export function shellScript(input: ShellScriptInput): string {
  const page = { kind: input.kind, consent: input.consent, promo: input.promo, chatCard: input.chatCard };
  return `${fixtureClient(input.runToken, "bigbox-retail")}
const C = ${JSON.stringify(input.classes)};
const PAGE = ${JSON.stringify(page)};
const ROOT = ${JSON.stringify(SITE_ROOT)};
const STORE_IDS = ${JSON.stringify(STORES.map((store) => store.id))};
const TILE_DEFAULTS = ${JSON.stringify(input.tileDefaults)};
const one = (cls, root = document) => root.querySelector('.' + cls);
const all = (cls, root = document) => [...root.querySelectorAll('.' + cls)];
window.vr = { awake: false, mutate };
window.vr.wake = () => { if (window.vr.awake) return true; window.vr.awake = true; return false; };
window.vr.toast = (text) => {
  const toast = document.createElement('div');
  toast.className = C.toast; toast.setAttribute('role', 'status'); toast.textContent = text;
  document.body.append(toast); setTimeout(() => toast.remove(), 2500);
};
window.vr.refreshMiniCart = async () => {
  const response = await fetch(ROOT + 'mini-cart', { cache: 'no-store' });
  if (response.ok) one(C.miniCart).innerHTML = await response.text();
};
{
  const link = one(C.cartLink); const mini = one(C.miniCart); let timer;
  const show = () => { clearTimeout(timer); mini.hidden = false; };
  const hide = () => { timer = setTimeout(() => { mini.hidden = true; }, 250); };
  for (const node of [link, mini]) { node.addEventListener('mouseenter', show); node.addEventListener('mouseleave', hide); }
}
function schedulePromo() {
  if (PAGE.promo !== 'pending' || PAGE.kind === 'checkout' || PAGE.kind === 'order') return;
  setTimeout(showPromo, ${PROMO_DELAY_MS});
}
function showPromo() {
  const scrim = document.createElement('div'); scrim.className = C.scrim; scrim.style.zIndex = '1100';
  const card = document.createElement('div'); card.className = C.promo;
  card.innerHTML = '<div class="' + C.promoClose + '">\u00d7</div><h2>Get $10 off your first pickup order</h2>'
    + '<p>Sign up for ValueRidge emails and we will send your code right away. New subscribers only.</p>'
    + '<form class="' + C.promoForm + '"><label>Email address <input class="' + C.input + '" type="email" name="email" autocomplete="email"></label>'
    + '<div class="' + C.hp + '"><label>Leave this field empty <input type="text" name="website" tabindex="-1" autocomplete="off"></label></div>'
    + '<button type="submit" class="' + C.btn + ' ' + C.btnPrimary + '">Sign up</button></form>'
    + '<a href="#" class="' + C.promoDecline + '">No thanks</a>';
  document.body.append(scrim, card);
  const close = async (operation, payload) => { card.remove(); scrim.remove(); PAGE.promo = 'dismissed'; await mutate(operation, payload); };
  one(C.promoClose, card).addEventListener('click', () => close('dismiss-promo', {}));
  one(C.promoDecline, card).addEventListener('click', (event) => { event.preventDefault(); close('dismiss-promo', {}); });
  card.querySelector('form').addEventListener('submit', (event) => {
    event.preventDefault();
    const form = new FormData(event.target);
    close('newsletter-signup', { email: String(form.get('email') || ''), website: String(form.get('website') || '') });
  });
}
if (PAGE.consent === 'pending') {
  const dialog = one(C.consent); const scrim = dialog.previousElementSibling;
  const [accept, reject, manage] = dialog.querySelectorAll('button');
  const answer = async (choice) => { await mutate('consent', { choice }); dialog.remove(); scrim.remove(); PAGE.consent = choice; schedulePromo(); };
  accept.addEventListener('click', () => answer('accept'));
  reject.addEventListener('click', () => answer('reject'));
  manage.addEventListener('click', () => { manage.textContent = 'Accept or reject first; you can fine-tune from Privacy choices afterwards.'; });
} else schedulePromo();
{
  const picker = document.querySelector('vr-fulfillment-picker');
  const root = picker && picker.shadowRoot;
  if (root) {
    const flyout = one(C.pickerFlyout, root);
    one(C.pickerChip, root).addEventListener('click', () => { flyout.hidden = !flyout.hidden; });
    one(C.pickerClose, root).addEventListener('click', () => { flyout.hidden = true; });
    all(C.pickerTab, root).forEach((tab) => tab.addEventListener('click', () => {
      all(C.pickerTab, root).forEach((other) => other.classList.toggle(C.pickerTabOn, other === tab));
    }));
    all(C.pickerCard, root).forEach((card, index) => {
      const button = one(C.pickerSet, card);
      if (!button) return;
      button.addEventListener('click', async () => {
        button.disabled = true; button.textContent = 'Updating\u2026';
        await mutate('set-store', { storeId: STORE_IDS[index] });
        location.reload();
      });
    });
    window.vr.openStorePicker = () => { flyout.hidden = false; window.scrollTo(0, 0); };
  }
}
{
  const assist = document.querySelector('vr-assist');
  const root = assist && assist.shadowRoot;
  if (root) {
    const pill = one(C.chatPill, root); const card = one(C.chatCard, root); const panel = one(C.chatPanel, root);
    const openPanel = () => { panel.hidden = false; pill.hidden = true; card.hidden = true; };
    pill.addEventListener('click', (event) => {
      if (event.target.closest('.' + C.chatPillClose)) { pill.hidden = true; return; }
      openPanel();
    });
    const [cardClose, panelClose] = all(C.chatCardClose, root);
    cardClose.addEventListener('click', async () => { card.hidden = true; pill.hidden = false; PAGE.chatCard = 'dismissed'; await mutate('dismiss-chat-card', {}); });
    panelClose.addEventListener('click', () => { panel.hidden = true; pill.hidden = false; });
    card.querySelector('button').addEventListener('click', openPanel);
    const [send] = panel.querySelectorAll('button'); const field = one(C.chatInput, root); const log = one(C.chatLog, root);
    send.addEventListener('click', () => {
      if (!field.value.trim()) return;
      const mine = document.createElement('li'); mine.textContent = field.value; log.append(mine); field.value = '';
      setTimeout(() => { const reply = document.createElement('li'); reply.textContent = 'Thanks! An associate will join the chat shortly.'; log.append(reply); }, 600);
    });
    if (PAGE.kind === 'product' && PAGE.chatCard === 'pending') {
      pill.hidden = true;
      setTimeout(() => { if (PAGE.chatCard === 'pending' && panel.hidden) card.hidden = false; }, ${CHAT_CARD_DELAY_MS});
    }
  }
}
{
  const images = document.querySelectorAll('img[data-src]');
  const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    entry.target.src = entry.target.dataset.src; observer.unobserve(entry.target);
  }), { rootMargin: '120px' });
  images.forEach((image) => observer.observe(image));
}
document.addEventListener('click', async (event) => {
  const button = event.target.closest('.' + C.addButton);
  if (!button) return;
  event.preventDefault();
  if (!window.vr.wake()) return;
  const holder = button.closest('[data-item-id]') || button.closest('.' + C.railItem);
  const link = holder && holder.querySelector('a[href*="/ip/"]');
  const id = link ? link.getAttribute('href').split('?')[0].split('/').pop() : '';
  const preset = TILE_DEFAULTS[id];
  if (!preset) return;
  button.disabled = true;
  await mutate('add-to-cart', { productId: id, sku: preset.sku, qty: 1, fulfilment: preset.fulfilment });
  button.disabled = false; button.textContent = 'Added';
  await window.vr.refreshMiniCart();
  window.vr.toast('Added to cart');
});
`;
}
