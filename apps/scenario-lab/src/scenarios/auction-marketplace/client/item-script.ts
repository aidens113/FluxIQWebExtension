/** What a listing page's script needs: the item, its currency, its variations, and the price Buy it now charges. */
export type ItemBoot = { itemId: string; currency: string; price: string; buyPrice: string; variations: Array<{ label: string; price: string }> };

/**
 * The browser side of a listing page: the bid drawer and its three stages,
 * Buy it now and its review, the variation picker, the photo thumbnails, and
 * the similar items that load when scrolled into view.
 *
 * The bid drawer sends the off-screen reference box's value with every bid,
 * whatever it holds; the server decides what a filled one means. The drawer
 * shows the outcome only after the header lists have been refreshed.
 */
export function itemClientScript(boot: ItemBoot): string {
  return `const itemBoot = ${JSON.stringify(boot)};
${ITEM_CORE}`;
}

const ITEM_CORE = String.raw`
function typedAmount(text) {
  const cleaned = text.replace(/[£$€\s]|EUR|US/gi, '');
  const decimalComma = /^\d{1,3}(\.\d{3})*,\d{1,2}$|^\d+,\d{1,2}$/.test(cleaned);
  const normal = decimalComma ? cleaned.split('.').join('').replace(',', '.') : cleaned.split(',').join('');
  if (!/^\d+(\.\d{1,2})?$/.test(normal)) return text;
  const [whole, fraction = ''] = normal.split('.');
  const cents = (fraction + '00').slice(0, 2);
  const grouped = (separator) => whole.replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, separator);
  if (itemBoot.currency === 'EUR') return 'EUR ' + grouped('.') + ',' + cents;
  if (itemBoot.currency === 'USD') return 'US $' + grouped(',') + '.' + cents;
  return '£' + grouped(',') + '.' + cents;
}

const ctaButtons = Array.from(byClass('ctaColumn').querySelectorAll('button'));
const placeBidButton = ctaButtons.find((button) => button.textContent === 'Place bid');
const buyNowButton = ctaButtons.find((button) => button.textContent === 'Buy it now');

let chosenVariation = null;
const picker = byClass('variantPicker');
if (picker) {
  const listbox = picker.nextElementSibling;
  picker.addEventListener('click', () => {
    listbox.hidden = !listbox.hidden;
    picker.setAttribute('aria-expanded', String(!listbox.hidden));
  });
  for (const option of listbox.querySelectorAll('[role="option"]')) {
    option.addEventListener('click', () => {
      chosenVariation = itemBoot.variations.find((entry) => entry.label === option.textContent);
      for (const other of listbox.querySelectorAll('[role="option"]')) other.setAttribute('aria-selected', String(other === option));
      picker.textContent = option.textContent;
      listbox.hidden = true;
      picker.setAttribute('aria-expanded', 'false');
      byClass('priceBig').textContent = chosenVariation.price;
      if (buyNowButton) buyNowButton.disabled = false;
    });
  }
}

const bidDrawer = byClass('bidDrawer');
if (bidDrawer && placeBidButton) {
  const [enter, review, result] = bidDrawer.querySelectorAll('section');
  const maxInput = bidDrawer.querySelector('input[name="maxbid"]');
  const trapInput = bidDrawer.querySelector('input[name="reference"]');
  const alertLine = bidDrawer.querySelector('[role="alert"]');
  const reviewAmount = review.querySelector('strong');
  const status = result.querySelector('[role="status"]');
  const reviewButton = byClass('divButton', bidDrawer);
  const [confirmButton, doneButton] = byClass('drawerFoot', bidDrawer).querySelectorAll('button');
  let pendingAmount = '';
  const showStage = (stage) => {
    enter.hidden = stage !== 'enter';
    review.hidden = stage !== 'review';
    result.hidden = stage !== 'result';
    reviewButton.hidden = stage !== 'enter';
    confirmButton.hidden = stage !== 'review';
    doneButton.hidden = stage !== 'result';
  };
  const toReview = (amount) => {
    const text = amount.trim();
    if (text === '') { alertLine.textContent = 'Enter your max bid.'; return; }
    pendingAmount = text;
    reviewAmount.textContent = typedAmount(text);
    alertLine.textContent = '';
    showStage('review');
  };
  placeBidButton.addEventListener('click', () => { showStage('enter'); bidDrawer.hidden = false; maxInput.focus(); });
  for (const chip of bidDrawer.querySelectorAll('.' + css.chip)) chip.addEventListener('click', () => { maxInput.value = chip.value; toReview(chip.value); });
  reviewButton.addEventListener('click', () => toReview(maxInput.value));
  byClass('link', review).addEventListener('click', () => showStage('enter'));
  confirmButton.addEventListener('click', async () => {
    const snapshot = await mutate('place-bid', { itemId: itemBoot.itemId, amount: pendingAmount, reference: trapInput.value });
    const outcome = snapshot.state.lastBid;
    if (outcome && (outcome.outcome === 'below-minimum' || outcome.outcome === 'invalid')) {
      alertLine.textContent = outcome.message;
      showStage('enter');
      return;
    }
    await refreshHeader();
    status.textContent = outcome ? outcome.message : 'Something went wrong.';
    showStage('result');
  });
  doneButton.addEventListener('click', () => location.reload());
  byClass('modalClose', bidDrawer).addEventListener('click', () => { bidDrawer.hidden = true; });
}

const buyDrawer = byClass('buyDrawer');
if (buyDrawer && buyNowButton) {
  const [summary, result] = buyDrawer.querySelectorAll('section');
  const priceLine = summary.querySelector('strong');
  const trap = buyDrawer.querySelector('input[name="reference"]');
  const status = result.querySelector('[role="status"]');
  const [confirmPay, done] = byClass('drawerFoot', buyDrawer).querySelectorAll('button');
  buyNowButton.addEventListener('click', () => {
    priceLine.textContent = chosenVariation ? chosenVariation.price : itemBoot.buyPrice;
    summary.hidden = false;
    result.hidden = true;
    confirmPay.hidden = false;
    done.hidden = true;
    buyDrawer.hidden = false;
  });
  confirmPay.addEventListener('click', async () => {
    const snapshot = await mutate('buy-now', { itemId: itemBoot.itemId, variation: chosenVariation ? chosenVariation.label : undefined, reference: trap.value });
    await refreshHeader();
    const bought = snapshot.state.purchases.includes(itemBoot.itemId);
    status.textContent = bought ? 'Thank you for your purchase. The seller has been notified.' : 'We could not complete your purchase. Please try again later.';
    summary.hidden = true;
    result.hidden = false;
    confirmPay.hidden = true;
    done.hidden = false;
  });
  done.addEventListener('click', () => location.reload());
  byClass('modalClose', buyDrawer).addEventListener('click', () => { buyDrawer.hidden = true; });
}

for (const thumb of allByClass('thumb')) thumb.addEventListener('click', () => { byClass('galleryMain').src = thumb.src; });

const similar = byClass('similar');
if (similar && 'IntersectionObserver' in window) {
  const observer = new IntersectionObserver(async (entries) => {
    if (!entries.some((entry) => entry.isIntersecting)) return;
    observer.disconnect();
    const response = await fetch(marketRoot + 'fragments/similar/' + itemBoot.itemId, { cache: 'no-store' });
    if (response.ok) similar.innerHTML = await response.text();
  });
  observer.observe(similar);
}
`;
