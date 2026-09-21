/**
 * The cart page in the browser: tick or untick a line, change its quantity
 * or remove it (each change is posted and the page reloads, as the live cart
 * does), and check out the ticked lines.
 */
export function cartScript(): string {
  return CART;
}

const CART = String.raw`
const cartLines = allByClass('cartLine');
const ticked = new Set(pageData.lines.map((line) => line.id));
cartLines.forEach((row, index) => {
  const line = pageData.lines[index];
  const tick = byClass('cartCheck', row);
  tick.addEventListener('click', () => {
    if (ticked.has(line.id)) ticked.delete(line.id); else ticked.add(line.id);
    tick.style.background = ticked.has(line.id) ? '#e62e04' : '#fff';
    tick.style.borderColor = ticked.has(line.id) ? '#e62e04' : '#999';
  });
  const [minus, plus] = allByClass('qtyButton', row);
  minus.addEventListener('click', async () => { if (line.quantity > 1) { await mutate('cart-quantity', { lineId: line.id, quantity: line.quantity - 1 }); location.reload(); } });
  plus.addEventListener('click', async () => { await mutate('cart-quantity', { lineId: line.id, quantity: line.quantity + 1 }); location.reload(); });
  qs('[title="Remove"]', row).addEventListener('click', async () => { await mutate('cart-remove', { lineId: line.id }); location.reload(); });
});
const checkout = byClass('placeOrder');
if (checkout) checkout.addEventListener('click', async () => {
  if (ticked.size === 0) { toast('Select at least one item to check out.'); return; }
  await mutate('checkout-cart', { lineIds: Array.from(ticked) });
  location.href = boot.root + 'checkout';
});
`;
