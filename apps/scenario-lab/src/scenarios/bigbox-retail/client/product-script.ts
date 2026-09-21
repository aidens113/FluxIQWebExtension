import type { BigboxClasses } from "../theme/index.js";
import type { Fulfilment } from "../types.js";

/** One size as the buy box draws it at the shopper's store. */
export type ProductVariantView = {
  sku: string;
  label: string;
  title: string;
  priceHtml: string;
  price: string;
  options: Array<{ method: Fulfilment; text: string; available: boolean }>;
  preferred: Fulfilment;
};

export type ProductScriptInput = { classes: BigboxClasses; productId: string; views: ProductVariantView[]; selectedSku: string; redesigned: boolean };

/** How long the buy box says it is checking availability before the choices appear. */
export const AVAILABILITY_DELAY_MS = 700;

const REVIEWS = [
  ["Does the job", "Strong enough for spills and they tear cleanly on the perforation."],
  ["Good value", "Cheaper per sheet than the name brand and I honestly can't tell the difference."],
  ["Picked up same day", "Ordered at lunch and it was ready by three. Easy."],
  ["A little thin", "Fine for everyday use, but I double up for greasy pans."],
  ["Buy the bigger pack", "The larger size works out cheaper if you have the storage space."],
  ["Wrapper tore", "Arrived with the outer wrap split, but every roll was fine."],
];

/**
 * The buy box in the browser. Choosing a size redraws the title, the price,
 * the size label, the pinned bar and the fulfilment choices, and rewrites the
 * address without a reload. A fulfilment choice the store cannot offer does
 * nothing when pressed. Add to cart asks the store, redraws the mini cart --
 * never the count badge -- and opens an "Added to cart" panel over a scrim
 * that stays until it is closed. Buy now skips the cart and goes straight to
 * checkout with this one item.
 */
export function productScript(input: ProductScriptInput): string {
  return `{
const VIEWS = ${JSON.stringify(input.views)};
const PRODUCT_ID = ${JSON.stringify(input.productId)};
const REVIEWS = ${JSON.stringify(REVIEWS)};
const METHOD_LABEL = { pickup: 'Pickup', delivery: 'Delivery', shipping: 'Shipping' };
let index = Math.max(0, VIEWS.findIndex((view) => view.sku === ${JSON.stringify(input.selectedSku)}));
let qty = 1; let method = VIEWS[index].preferred;
const live = one(C.buyBoxLive);
setTimeout(() => { const skeleton = one(C.skeleton); if (skeleton) skeleton.remove(); live.hidden = false; }, ${AVAILABILITY_DELAY_MS});
const render = () => {
  const view = VIEWS[index];
  one(C.pdpTitle).textContent = view.title;
  one(C.pdpPrice).innerHTML = view.priceHtml;
  const label = one(C.variantLabel); if (label) label.querySelector('b').textContent = view.label;
  all(C.swatch).forEach((swatch, position) => swatch.classList.toggle(C.swatchOn, position === index));
  if (!view.options.some((option) => option.method === method && option.available)) method = view.preferred;
  all(C.fulfilOption).forEach((node, position) => {
    const option = view.options[position];
    node.querySelector('div').textContent = option.text;
    node.classList.toggle(C.fulfilOptionOff, !option.available);
    node.classList.toggle(C.fulfilOptionOn, option.available && option.method === method);
  });
  one(C.atcBarTitle).textContent = view.title + ' \u00b7 ' + view.price;
  one(C.qtyValue).textContent = String(qty);
};
all(C.swatch).forEach((swatch, position) => swatch.addEventListener('click', () => {
  index = position; render(); history.replaceState(null, '', location.pathname + '?variant=' + VIEWS[position].sku);
}));
all(C.fulfilOption).forEach((node, position) => node.addEventListener('click', () => {
  const option = VIEWS[index].options[position]; if (!option.available) return; method = option.method; render();
}));
const [minus, plus] = all(C.qtyControl);
minus.addEventListener('click', () => { qty = Math.max(1, qty - 1); render(); });
plus.addEventListener('click', () => { qty = Math.min(12, qty + 1); render(); });
one(C.storeLine).querySelector('a').addEventListener('click', (event) => { event.preventDefault(); if (window.vr.openStorePicker) window.vr.openStorePicker(); });
one(C.listLinks).querySelectorAll('a').forEach((link) => link.addEventListener('click', (event) => { event.preventDefault(); window.vr.toast('Sign in to save items to a list.'); }));
const payload = () => ({ productId: PRODUCT_ID, sku: VIEWS[index].sku, qty, fulfilment: method });
function showAdded() {
  const view = VIEWS[index];
  const scrim = document.createElement('div'); scrim.className = C.scrim; scrim.style.zIndex = '1200';
  const panel = document.createElement('aside'); panel.className = C.addedPanel;
  const picks = all(C.railItem).slice(0, 2).map((item) => item.outerHTML).join('');
  panel.innerHTML = '<div class="' + C.addedHead + '"><strong>\u2713 Added to cart</strong><div class="' + C.promoClose + '">\u00d7</div></div>'
    + '<p></p><p>Qty ' + qty + ' \u00b7 ' + METHOD_LABEL[method] + '</p>'
    + '<a class="' + C.btn + ' ' + C.btnPrimary + '" href="' + ROOT + 'cart">View cart</a> '
    + '<button type="button" class="' + C.btn + ' ' + C.btnSecondary + '">Continue shopping</button>'
    + '<h3>Customers also bought</h3><ul class="' + C.railList + '">' + picks + '</ul>';
  panel.querySelector('p').textContent = view.title;
  const close = () => { panel.remove(); scrim.remove(); };
  one(C.promoClose, panel).addEventListener('click', close);
  panel.querySelector('button').addEventListener('click', close);
  document.body.append(scrim, panel);
}
async function addToCart(button) {
  if (!window.vr.wake() || live.hidden) return;
  button.disabled = true;
  const snapshot = await mutate('add-to-cart', payload());
  button.disabled = false;
  await window.vr.refreshMiniCart();
  if (snapshot.state.cart.some((line) => line.sku === VIEWS[index].sku && line.fulfilment === method)) showAdded();
  else window.vr.toast('We could not add this item. Try another way to get it.');
}
async function buyNow(button) {
  if (!window.vr.wake() || live.hidden) return;
  button.disabled = true;
  await mutate('buy-now', payload());
  location.href = ROOT + 'checkout';
}
${input.redesigned
    ? "live.querySelector('button').addEventListener('click', (event) => addToCart(event.currentTarget));\none(C.buyNowButton).addEventListener('click', (event) => buyNow(event.currentTarget));"
    : "one(C.atcButton).addEventListener('click', (event) => addToCart(event.currentTarget));"}
const reviews = one(C.reviews).querySelector('div'); let shownReviews = 0;
const more = (count) => {
  REVIEWS.slice(shownReviews, shownReviews + count).forEach(([heading, text]) => {
    const node = document.createElement('article'); node.className = C.review;
    node.innerHTML = '<strong></strong><p></p>'; node.querySelector('strong').textContent = heading; node.querySelector('p').textContent = text;
    reviews.append(node);
  });
  shownReviews += count; if (shownReviews >= REVIEWS.length) one(C.moreReviews).hidden = true;
};
setTimeout(() => more(3), 900);
one(C.moreReviews).addEventListener('click', () => setTimeout(() => more(3), 600));
}`;
}
