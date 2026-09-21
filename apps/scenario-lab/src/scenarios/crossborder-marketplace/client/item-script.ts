/**
 * A product page in the browser: the option pickers, the quantity stepper,
 * the store-coupon component, and the two buy-bar actions.
 *
 * The pickers behave like the live site's. Clicking a chosen option clears
 * it; an option that has no stock alongside the other chosen options refuses
 * the click with "This combination is sold out."; the price, stock line,
 * delivery window and bar total follow the choice. Nothing is added or bought
 * until every group has a choice and the quantity is within stock.
 *
 * The store coupon's first claim always fails with "Network busy, please try
 * again" -- the live service's cold start -- and its second succeeds.
 * "Add to cart" posts the line after a 700 ms spinner and refreshes the header
 * flyouts, but not the number on the cart icon.
 */
export function itemScript(): string {
  return ITEM;
}

const ITEM = String.raw`
const MONEY = { DE: ['EUR', 1], ES: ['EUR', 1], GB: ['GBP', 0.86], US: ['USD', 1.09] };
function money(euroCents) {
  const [currency, rate] = MONEY[boot.region];
  const cents = Math.round(euroCents * rate);
  const units = String(Math.floor(cents / 100));
  const decimals = String(cents % 100).padStart(2, '0');
  if (currency === 'EUR') return units.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + decimals + ' €';
  return (currency === 'GBP' ? '£' : 'US $') + units.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + decimals;
}

const info = byClass('itemInfo');
const groups = allByClass('skuGroup', info);
const hasSpec = pageData.specs.length > 0;
const groupOf = { color: groups[0], spec: hasSpec ? groups[1] : null, origin: groups[hasSpec ? 2 : 1] };
const quantityGroup = groups[groups.length - 1];
const quantityBox = byClass('qtyInput', quantityGroup);
const [minus, plus] = allByClass('qtyButton', quantityGroup);
const stockNote = byClass('stockNote', quantityGroup);
const tip = byClass('errorTip', info);
const selection = { color: pageData.initial.color, spec: pageData.initial.spec, origin: pageData.initial.origin };
const values = { color: pageData.colors, spec: pageData.specs, origin: pageData.origins };
const labels = { color: 'Color', spec: 'Specification', origin: 'Ships From' };
let lastCart = JSON.stringify(pageData.cart);

const keyOf = (choice) => choice.color + '|' + choice.spec + '|' + choice.origin;
const complete = () => Boolean(selection.color && (!hasSpec || selection.spec) && selection.origin);

function optionsIn(group) {
  const container = byClass('swatches', groupOf[group]);
  return Array.from(container.children);
}

function available(group, value) {
  const trial = { ...selection, [group]: value };
  return Object.entries(pageData.skus).some(([key, sku]) => {
    const [color, spec, origin] = key.split('|');
    return sku.stock > 0 && (!trial.color || trial.color === color) && (!hasSpec || !trial.spec || trial.spec === spec) && (!trial.origin || trial.origin === origin);
  });
}

function quantity() {
  const parsed = Number(String(quantityBox.value).trim());
  return Number.isInteger(parsed) ? parsed : NaN;
}

function render() {
  for (const group of ['color', 'spec', 'origin']) {
    if (!groupOf[group]) continue;
    byClass('skuLabel', groupOf[group]).innerHTML = labels[group] + ': <b>' + (selection[group] || '') + '</b>';
    optionsIn(group).forEach((option, index) => {
      const value = values[group][index];
      option.classList.toggle(css.optionOn, selection[group] === value);
      option.classList.toggle(css.optionOff, !available(group, value));
    });
  }
  const sku = complete() ? pageData.skus[keyOf(selection)] : null;
  const priceBlock = byClass('priceBlock', info);
  if (sku) {
    const pieces = byClass('bigPrice', priceBlock).children;
    sku.parts.forEach((part, index) => { pieces[index].textContent = part; });
    byClass('priceOriginal', priceBlock).textContent = sku.original;
    byClass('discount', priceBlock).textContent = '-' + sku.off + '%';
    stockNote.textContent = sku.stock + ' pieces available';
  } else {
    stockNote.textContent = '';
  }
  const delivery = byClass('deliveryBox');
  const spans = qsa('span', delivery);
  if (selection.origin) {
    spans[1].textContent = sku ? sku.delivery : spans[1].textContent;
    spans[2].textContent = 'Ships from ' + selection.origin;
  }
  const units = quantity();
  qs('b', byClass('buyTotal')).textContent = sku && units > 0 ? money(sku.unit * units) : '—';
}

for (const group of ['color', 'spec', 'origin']) {
  if (!groupOf[group]) continue;
  optionsIn(group).forEach((option, index) => option.addEventListener('click', () => {
    tip.textContent = '';
    const value = values[group][index];
    if (selection[group] === value) { selection[group] = ''; render(); return; }
    if (!available(group, value)) { tip.textContent = 'This combination is sold out.'; return; }
    selection[group] = value;
    render();
  }));
}

function setQuantity(next) {
  tip.textContent = '';
  const sku = complete() ? pageData.skus[keyOf(selection)] : null;
  const ceiling = sku ? sku.stock : 99;
  if (next > ceiling) { tip.textContent = 'Only ' + ceiling + ' pieces available.'; next = ceiling; }
  quantityBox.value = String(Math.max(1, next));
  render();
}
minus.addEventListener('click', () => setQuantity((quantity() || 1) - 1));
plus.addEventListener('click', () => setQuantity((quantity() || 0) + 1));
quantityBox.addEventListener('input', () => render());
quantityBox.addEventListener('change', () => setQuantity(quantity() || 1));

function ready() {
  tip.textContent = '';
  const missing = ['color', 'spec', 'origin'].find((group) => groupOf[group] && !selection[group]);
  if (missing) { tip.textContent = 'Please select a ' + labels[missing] + '.'; return null; }
  const sku = pageData.skus[keyOf(selection)];
  const units = quantity();
  if (!Number.isInteger(units) || units < 1) { tip.textContent = 'Please enter a quantity.'; return null; }
  if (units > sku.stock) { tip.textContent = 'Only ' + sku.stock + ' pieces available.'; return null; }
  return { listingId: pageData.listingId, color: selection.color, spec: selection.spec, origin: selection.origin, quantity: units };
}

const addButton = byClass('addCart');
const buyButton = byClass('buyNow');
addButton.addEventListener('click', async () => {
  const line = ready();
  if (!line) return;
  const label = addButton.textContent;
  addButton.innerHTML = '<span class="' + css.spinner + '"></span>';
  await sleep(700);
  const result = await mutate('add-to-cart', line);
  addButton.textContent = label;
  const cart = JSON.stringify(result.state.cart);
  if (cart === lastCart || !result.state.cart.some((entry) => entry.listingId === line.listingId)) {
    tip.textContent = 'You have reached the purchase limit for this item.';
    return;
  }
  lastCart = cart;
  toast('Added to cart!');
  await refreshFlyouts();
});
buyButton.addEventListener('click', async () => {
  const line = ready();
  if (!line) return;
  buyButton.innerHTML = '<span class="' + css.spinner + '"></span>';
  await mutate('buy-now', line);
  location.href = boot.root + 'checkout';
});

// The store coupon comes from the promotions team's widget library, rendered into its own shadow root.
class StoreCoupon extends HTMLElement {
  connectedCallback() {
    if (this.shadowRoot) return;
    const root = this.attachShadow({ mode: 'open' });
    const storeId = this.getAttribute('store');
    let collected = this.getAttribute('collected') === 'yes';
    root.innerHTML = '<style>.w{display:flex;align-items:center;justify-content:space-between;gap:12px;border:1px dashed #e62e04;background:#fff7f4;border-radius:8px;padding:8px 12px;margin:8px 0}.d{font-size:13px}.b{background:#e62e04;color:#fff;border-radius:14px;padding:5px 14px;font-weight:700;cursor:pointer;white-space:nowrap}.b.x{background:#ccc;cursor:default}.e{color:#c40000;font-size:12px;min-height:16px}</style>'
      + '<div class="w"><div class="d">Store coupon<br><b>' + this.getAttribute('off') + ' off</b> orders over ' + this.getAttribute('minimum') + '</div><div class="b' + (collected ? ' x' : '') + '">' + (collected ? 'Collected' : 'Get coupons') + '</div></div><div class="e"></div>';
    const button = root.querySelector('.b');
    const error = root.querySelector('.e');
    button.addEventListener('click', async () => {
      if (collected || button.textContent === '…') return;
      error.textContent = '';
      button.textContent = '…';
      await sleep(800);
      const result = await mutate('claim-coupon', { storeId });
      if (result.state.coupons.stores.includes(storeId)) {
        collected = true;
        button.textContent = 'Collected';
        button.classList.add('x');
        toast('Coupon collected. It will be applied at checkout.');
        await refreshFlyouts();
      } else {
        button.textContent = 'Get coupons';
        error.textContent = 'Network busy, please try again';
        console.error('[coupon] claim failed: BUSY');
      }
    });
  }
}
customElements.define('fb-store-coupon', StoreCoupon);

render();
`;
