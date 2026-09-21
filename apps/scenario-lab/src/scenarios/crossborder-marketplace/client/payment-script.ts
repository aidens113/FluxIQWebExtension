/** The framed payment picker in the browser: rows in the order the frame draws them, one of which can pay. */
export function paymentScript(): string {
  return PAYMENT;
}

const PAYMENT = String.raw`
const rows = Array.from(document.querySelectorAll('.' + css.payMethod));
const tip = document.querySelector('.' + css.errorTip);
const refusals = [null, 'This card has expired. Please use another card.', 'Your balance is not enough to pay for this order.', 'Adding a new card is not available in your region right now.'];
rows.forEach((row, index) => row.addEventListener('click', async () => {
  tip.textContent = '';
  if (refusals[index]) { tip.textContent = refusals[index]; return; }
  const result = await mutate('choose-payment', { methodId: 'visa-4417' });
  if (!result.state.checkout || result.state.checkout.paymentId !== 'visa-4417') { tip.textContent = 'Your session has expired. Please reload the page.'; return; }
  for (const radio of document.querySelectorAll('.' + css.payRadio)) radio.removeAttribute('style');
  row.querySelector('.' + css.payRadio).setAttribute('style', 'border-color:#e62e04;background:radial-gradient(#e62e04 45%,#fff 50%)');
  parent.postMessage({ type: 'fb-payment', methodId: 'visa-4417', label: 'Visa •••• 4417' }, location.origin);
}));
`;
