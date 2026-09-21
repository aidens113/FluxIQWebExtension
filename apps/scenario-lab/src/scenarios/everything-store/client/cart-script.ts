import { STORE_PATHS } from "../catalog/index.js";
import type { StoreClasses } from "../style/index.js";
import { STORE_TIMINGS } from "./timings.js";

/**
 * The cart page's script. Every change is reported to the server and the
 * lines are then re-rendered from what it says, so the page and the oracle
 * cannot disagree; the header badge is not re-rendered and stays whatever it
 * was.
 *
 * Save for later is the flaky one. When the server reports the line still in
 * the cart, the row keeps its spinner, and only after `saveRetry` does it
 * admit something went wrong and offer "Try again". Nothing clears the spinner
 * except that retry or a reload.
 */
export function cartScript(css: StoreClasses): string {
  const config = { css, timings: STORE_TIMINGS, cart: STORE_PATHS.cart, checkout: STORE_PATHS.checkout };
  return `const CART = ${JSON.stringify(config)};
${CART_BODY}`;
}

const CART_BODY = String.raw`
const cartRoot = document.querySelector('[data-cart-root]');
async function refreshCart() {
  const response = await fetch(CART.cart + '?part=main');
  if (response.ok) cartRoot.innerHTML = await response.text();
}
function spinnerOverlay() {
  const overlay = document.createElement('div');
  overlay.className = CART.css.rowBusy;
  overlay.innerHTML = '<span class="' + CART.css.spinner + '" role="progressbar" aria-label="Updating"></span>';
  return overlay;
}
async function saveForLater(row, lineId) {
  const overlay = spinnerOverlay();
  row.append(overlay);
  const snapshot = await mutate('save-for-later', { lineId });
  if (!snapshot.state.cart.some((line) => line.lineId === lineId)) { await refreshCart(); return; }
  setTimeout(() => {
    overlay.innerHTML = '<p class="' + CART.css.rowError + '">Something went wrong. We could not save this item. <span class="' + CART.css.linkish + '" tabindex="0">Try again</span></p>';
    overlay.querySelector('span').addEventListener('click', async (event) => {
      event.stopPropagation();
      overlay.replaceChildren(spinnerOverlay().firstChild);
      await mutate('save-for-later', { lineId });
      await refreshCart();
    });
  }, CART.timings.saveRetry);
}
cartRoot.addEventListener('click', async (event) => {
  const control = event.target.closest('[data-action], [data-act]');
  if (!control || !cartRoot.contains(control)) return;
  const row = control.closest('[data-line]');
  const lineId = row ? row.dataset.line : undefined;
  const action = control.dataset.action || control.dataset.act;
  const quantity = row ? Number(row.querySelector('[aria-live]')?.textContent || '1') : 1;
  if (action === 'inc') await mutate('set-quantity', { lineId, quantity: Math.min(10, quantity + 1) });
  else if (action === 'dec') await mutate('set-quantity', { lineId, quantity: quantity - 1 });
  else if (action === 'delete') await mutate('delete-line', { lineId });
  else if (action === 'save-for-later') { await saveForLater(row, lineId); return; }
  else if (action === 'move-to-cart') await mutate('move-to-cart', { lineId });
  else if (action === 'deselect-all') await mutate('select-all', { selected: false });
  else if (action === 'select-all') await mutate('select-all', { selected: true });
  else if (action === 'compare') { window.open(row.querySelector('a').href + '#compare', '_blank'); return; }
  else return;
  await refreshCart();
});
cartRoot.addEventListener('change', async (event) => {
  const box = event.target;
  if (!(box instanceof HTMLInputElement) || box.type !== 'checkbox') return;
  const row = box.closest('[data-line]');
  if (!row) return;
  await mutate('select-line', { lineId: row.dataset.line, selected: box.checked });
  await refreshCart();
});
document.querySelector('[data-action="proceed"]').addEventListener('click', async () => {
  const snapshot = await mutate('start-checkout', { pipeline: 'cart' });
  if (snapshot.state.checkout) { location.href = CART.checkout; return; }
  document.querySelector('[data-checkout-error]').hidden = false;
});
for (const button of document.querySelectorAll('[data-add-sku]')) {
  button.addEventListener('click', async () => {
    await mutate('add-to-cart', { sku: button.dataset.addSku, quantity: 1 });
    window.dispatchEvent(new CustomEvent('store:cart-added'));
    await refreshCart();
  });
}
`;
