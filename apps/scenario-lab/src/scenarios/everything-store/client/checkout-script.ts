import { STORE_PATHS } from "../catalog/index.js";
import type { StoreClasses, StoreIds } from "../style/index.js";

/**
 * Checkout's script. Every choice is reported and the page reloads to show
 * its consequence, as the real one does section by section. The payment
 * frame reports a change by message. Placing the order reports it and opens
 * the confirmation for the order the server says was placed.
 */
export function checkoutScript(css: StoreClasses, ids: StoreIds): string {
  const config = { css, ids, thankYou: STORE_PATHS.thankYou("") };
  return `const CHECKOUT = ${JSON.stringify(config)};
${CHECKOUT_BODY}`;
}

const CHECKOUT_BODY = String.raw`
function on(selector, type, handler) {
  for (const node of document.querySelectorAll(selector)) node.addEventListener(type, handler);
}
on('[data-action="change-address"]', 'click', () => { document.getElementById(CHECKOUT.ids.addressList).hidden = false; });
on('[data-action="use-address"]', 'click', async () => {
  const chosen = document.querySelector('input[name="address"]:checked');
  if (chosen) await mutate('set-address', { addressId: chosen.value });
  location.reload();
});
on('[data-action="change-payment"]', 'click', () => { document.getElementById(CHECKOUT.ids.paymentFrame).hidden = false; });
window.addEventListener('message', (event) => {
  if (event.origin === location.origin && event.data && event.data.type === 'payment-changed') location.reload();
});
on('#' + CSS.escape(CHECKOUT.ids.giftCard), 'change', async (event) => {
  await mutate('set-gift-card', { apply: event.target.checked });
  location.reload();
});
on('input[name="delivery"]', 'change', async (event) => {
  await mutate('set-delivery', { option: event.target.value });
  location.reload();
});
on('#' + CSS.escape(CHECKOUT.ids.plusTrial), 'change', async (event) => {
  await mutate('set-plus-trial', { enabled: event.target.checked });
  location.reload();
});
on('[data-action="place-order"]', 'click', async () => {
  for (const button of document.querySelectorAll('[data-action="place-order"]')) button.disabled = true;
  const snapshot = await mutate('place-order', {});
  const order = snapshot.state.orders[snapshot.state.orders.length - 1];
  if (order && !snapshot.state.checkout) location.href = CHECKOUT.thankYou + encodeURIComponent(order.orderId);
});
`;
