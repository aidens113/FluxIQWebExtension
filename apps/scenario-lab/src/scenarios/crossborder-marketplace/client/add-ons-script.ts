/**
 * The rebuilt cart (`cart-add-ons`) in the browser.
 *
 * - The Select box is controlled by the cart's state: a press flips the line's
 *   selection there and redraws the summary, and the box's change then sets it
 *   from that state, as a React-style cart reconciles a checkbox.
 * - Gift wrap is not offered by the line's store, so the cart unticks it in
 *   the same change it was ticked in.
 * - The extended warranty waits for its quote, which comes back from cache a
 *   microtask later saying it is no longer offered, and is unticked then.
 * - Shipping insurance is already included by the store; the cart redraws the
 *   add-on as a fresh, unticked box in place of the one that was ticked.
 *
 * Quantity, remove and checkout behave as on the baseline cart, and checkout
 * takes the selected lines.
 */
export function cartAddOnsScript(): string {
  return ADD_ONS;
}

const ADD_ONS = String.raw`
const cartLines = allByClass('cartLine');
const selected = new Set();
const checkout = byClass('placeOrder');
const showSelection = () => { if (checkout) checkout.textContent = 'Checkout (' + selected.size + ')'; };
const warrantyQuote = Promise.resolve({ available: false });
cartLines.forEach((row, index) => {
  const line = pageData.lines[index];
  const note = qs('[role="status"]', row);
  const select = qs('input[name="select"]', row);
  select.addEventListener('click', () => {
    if (selected.has(line.id)) selected.delete(line.id); else selected.add(line.id);
    showSelection();
  });
  select.addEventListener('change', () => { select.checked = selected.has(line.id); });
  qs('input[name="giftWrap"]', row).addEventListener('change', (event) => {
    if (!event.target.checked) return;
    event.target.checked = false;
    note.textContent = line.store + ' doesn\u2019t offer gift wrap on this item.';
  });
  qs('input[name="warranty"]', row).addEventListener('change', async (event) => {
    const box = event.target;
    if (!box.checked) return;
    const quote = await warrantyQuote;
    if (quote.available) return;
    box.checked = false;
    note.textContent = 'The extended warranty is no longer available for this item.';
  });
  const bindInsurance = (box) => box.addEventListener('change', () => {
    if (!box.checked) return;
    const fresh = box.cloneNode(true);
    fresh.checked = false;
    box.replaceWith(fresh);
    bindInsurance(fresh);
    note.textContent = 'Shipping insurance is already included on orders from ' + line.store + '.';
  });
  bindInsurance(qs('input[name="insurance"]', row));
  const [minus, plus] = allByClass('qtyButton', row);
  minus.addEventListener('click', async () => { if (line.quantity > 1) { await mutate('cart-quantity', { lineId: line.id, quantity: line.quantity - 1 }); location.reload(); } });
  plus.addEventListener('click', async () => { await mutate('cart-quantity', { lineId: line.id, quantity: line.quantity + 1 }); location.reload(); });
  qs('[title="Remove"]', row).addEventListener('click', async () => { await mutate('cart-remove', { lineId: line.id }); location.reload(); });
});
if (checkout) checkout.addEventListener('click', async () => {
  if (selected.size === 0) { toast('Select at least one item to check out.'); return; }
  await mutate('checkout-cart', { lineIds: Array.from(selected) });
  location.href = boot.root + 'checkout';
});
`;
