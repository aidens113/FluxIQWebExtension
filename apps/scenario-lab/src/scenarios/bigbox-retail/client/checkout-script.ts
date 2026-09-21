/**
 * Checkout in the browser.
 *
 * On the sign-in wall, Continue always answers that there is no such account,
 * and the small link underneath starts a guest checkout.
 *
 * As a guest, the pickup times are fetched after load. The first fetch is
 * refused as rate-limited, with a Retry-After; the page shows its spinner and
 * never clears it, and only after the Retry-After has passed does a Retry link
 * appear beside it. The card frame hands back a token by message. Place order
 * sends every field the form holds, the hidden one included, and goes to the
 * confirmation when an order was placed, or reloads to show why not.
 */
export function checkoutScript(input: { guest: boolean; ordersBefore: number }): string {
  if (!input.guest) {
    return `{
  const card = one(C.wallCard);
  card.querySelector('button').addEventListener('click', async () => { await mutate('sign-in', {}); location.reload(); });
  one(C.btnLink, card).addEventListener('click', async (event) => { event.preventDefault(); await mutate('start-guest-checkout', {}); location.reload(); });
}`;
  }
  return `{
  const holder = all(C.section)[0].querySelector('div'); let slotId = ''; let cardToken = '';
  const choose = (button) => { all(C.slot, holder).forEach((other) => other.classList.toggle(C.slotOn, other === button)); slotId = button.value; };
  async function loadSlots() {
    holder.innerHTML = '<div class="' + C.spinner + '"></div><p>Loading pickup times\u2026</p>';
    const response = await fetch(ROOT + 'checkout/slots', { cache: 'no-store' });
    if (response.status === 429) {
      const wait = Number(response.headers.get('retry-after') || '2') * 1000;
      setTimeout(() => {
        const retry = document.createElement('a'); retry.href = '#'; retry.className = C.retry; retry.textContent = 'Taking longer than usual? Retry';
        retry.addEventListener('click', (event) => { event.preventDefault(); loadSlots(); });
        holder.append(retry);
      }, wait);
      return;
    }
    holder.innerHTML = await response.text();
    all(C.slot, holder).forEach((button) => { if (!button.disabled) button.addEventListener('click', () => choose(button)); });
  }
  loadSlots();
  window.addEventListener('message', (event) => { if (event.data && event.data.type === 'vr-card-token') cardToken = String(event.data.token); });
  const frame = document.querySelector('iframe');
  document.querySelectorAll('input[name=payment]').forEach((radio) => radio.addEventListener('change', () => { frame.hidden = radio.value === 'pickup' && radio.checked; }));
  one(C.placeOrder).addEventListener('click', async (event) => {
    const button = event.currentTarget; button.disabled = true;
    const value = (name) => (document.querySelector('[name=' + name + ']') || { value: '' }).value;
    const payment = (document.querySelector('input[name=payment]:checked') || { value: 'card' }).value;
    const snapshot = await mutate('place-order', { firstName: value('firstName'), lastName: value('lastName'), email: value('email'), phone: value('phone'), company_website: value('company_website'), slotId, payment, cardToken });
    const orders = snapshot.state.orders;
    if (orders.length > ${input.ordersBefore}) location.href = ROOT + 'order/' + orders[orders.length - 1].number;
    else location.reload();
  });
}`;
}
