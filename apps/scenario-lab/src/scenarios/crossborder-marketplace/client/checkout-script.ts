/**
 * The checkout in the browser: shipping choices and store coupons post and
 * reload; the payment frame reports the chosen method by message; "Place
 * order" spins for a second and a half, posts the order with whatever the
 * visible note and the invisible fax field hold, and then goes to the
 * confirmation -- or, for an order the fraud screen held, says so and stops.
 */
export function checkoutScript(): string {
  return CHECKOUT;
}

const CHECKOUT = String.raw`
let paymentChosen = pageData.paymentChosen;
window.addEventListener('message', (event) => {
  if (event.origin !== location.origin || !event.data || event.data.type !== 'fb-payment') return;
  paymentChosen = true;
  const rows = allByClass('summaryRow', byClass('cartSummary'));
  qsa('span', rows[3])[1].textContent = event.data.label;
});

allByClass('shipSelect').forEach((select, index) => select.addEventListener('change', async () => {
  await mutate('checkout-shipping', { storeId: pageData.storeIds[index], method: select.value });
  location.reload();
}));

allByClass('panel').forEach((panel) => {
  const link = qsa('.' + css.linkish, panel).find((node) => node.textContent === 'Get store coupon');
  if (!link) return;
  const index = allByClass('shipSelect').indexOf(byClass('shipSelect', panel));
  link.addEventListener('click', async () => {
    link.textContent = '…';
    await sleep(800);
    const result = await mutate('claim-coupon', { storeId: pageData.storeIds[index] });
    if (result.state.coupons.stores.includes(pageData.storeIds[index])) { location.reload(); return; }
    link.textContent = 'Get store coupon';
    toast('Network busy, please try again');
    console.error('[coupon] claim failed: BUSY');
  });
});

const addressChange = qsa('.' + css.linkish, byClass('addressCard') || document.createElement('div'))[0];
if (addressChange) addressChange.addEventListener('click', () => toast('Your address book is being updated. Please try again later.'));

const place = byClass('placeOrder');
const tip = byClass('errorTip');
if (place) place.addEventListener('click', async () => {
  tip.textContent = '';
  if (!paymentChosen) { tip.textContent = 'Please select a payment method.'; return; }
  if (place.textContent !== 'Place order') return;
  place.innerHTML = '<span class="' + css.spinner + '"></span>';
  await sleep(1500);
  const notes = allByClass('noteBox').map((box) => box.value).join('\n');
  const fax = qsa('input[name="fax_number"]').map((box) => box.value).join('');
  const result = await mutate('place-order', { note: notes, fax });
  const order = result.state.orders[result.state.orders.length - 1];
  if (!order || result.state.checkout) { place.textContent = 'Place order'; tip.textContent = 'Something went wrong. Please try again.'; return; }
  if (order.status === 'review') {
    byClass('main').innerHTML = '<div class="' + css.panel + '" style="text-align:center;padding:48px"><div class="' + css.panelTitle + '">Your order is being reviewed</div><p>For your security, this order needs a manual check before we take payment. We will email you within 24 hours. No payment has been taken.</p></div>';
    return;
  }
  location.href = boot.root + 'order/' + order.number;
});
`;
