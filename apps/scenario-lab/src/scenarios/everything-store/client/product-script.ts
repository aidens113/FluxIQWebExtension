import { STORE_PATHS } from "../catalog/index.js";
import type { StoreClasses, StoreIds } from "../style/index.js";
import { STORE_TIMINGS } from "./timings.js";

/**
 * A product page's script.
 *
 * The page is rendered on the server and "hydrated" `productHydrate` after
 * load: until then every control on it is inert markup, so a click that
 * arrives early is simply lost and has to be made again. Swatches and size
 * tiles navigate to the chosen child listing. Add to Cart spins for
 * `addToCart`, reports the add, fires the event the header badge miscounts,
 * and opens a side sheet whose "Proceed to checkout" checks out the whole
 * cart. Buy Now opens checkout for this listing alone.
 */
export function productScript(css: StoreClasses, ids: StoreIds, sku: string): string {
  const config = { css, ids, sku, timings: STORE_TIMINGS, checkout: STORE_PATHS.checkout, cart: STORE_PATHS.cart, summary: `${STORE_PATHS.cart}/summary` };
  return `const PRODUCT = ${JSON.stringify(config)};
${PRODUCT_BODY}`;
}

const PRODUCT_BODY = String.raw`
function quantity() {
  const select = document.getElementById(PRODUCT.ids.qty);
  return select ? Number(select.value) : 1;
}
function protection() {
  const box = document.getElementById(PRODUCT.ids.protection);
  return Boolean(box && box.checked);
}
async function openSheet() {
  document.getElementById(PRODUCT.ids.sideSheet)?.remove();
  const response = await fetch(PRODUCT.summary);
  const summary = response.ok ? await response.text() : '';
  const sheet = document.createElement('div');
  sheet.className = PRODUCT.css.sideSheet;
  sheet.id = PRODUCT.ids.sideSheet;
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-label', 'Added to cart');
  sheet.innerHTML = '<p><strong>Added to cart</strong></p>' + summary
    + '<p><button type="button" class="' + PRODUCT.css.button + ' ' + PRODUCT.css.buttonPrimary + '" data-sheet-checkout>Proceed to checkout</button></p>'
    + '<p><a class="' + PRODUCT.css.button + '" href="' + PRODUCT.cart + '">Go to Cart</a></p>'
    + '<p><span class="' + PRODUCT.css.linkish + '" data-sheet-close>Continue shopping</span></p>';
  document.body.append(sheet);
  sheet.querySelector('[data-sheet-close]').addEventListener('click', () => sheet.remove());
  sheet.querySelector('[data-sheet-checkout]').addEventListener('click', async () => {
    await mutate('start-checkout', { pipeline: 'cart' });
    location.href = PRODUCT.checkout;
  });
}
function hydrate() {
  for (const picker of document.querySelectorAll('[data-href]')) {
    if (picker.tagName === 'OPTION') continue;
    picker.addEventListener('click', () => { location.href = picker.dataset.href; });
  }
  const box = document.querySelector('[data-buy-box]');
  if (box) {
    const [add, buyNow] = box.querySelectorAll('button[type="button"]');
    add.addEventListener('click', async () => {
      if (add.dataset.busy) return;
      add.dataset.busy = 'yes';
      const label = add.textContent;
      add.innerHTML = '<span class="' + PRODUCT.css.spinner + '" aria-hidden="true"></span>';
      await new Promise((resolve) => setTimeout(resolve, PRODUCT.timings.addToCart));
      await mutate('add-to-cart', { sku: PRODUCT.sku, quantity: quantity(), protection: protection() });
      window.dispatchEvent(new CustomEvent('store:cart-added'));
      add.textContent = label;
      delete add.dataset.busy;
      await openSheet();
    });
    buyNow.addEventListener('click', async () => {
      await mutate('start-checkout', { pipeline: 'buy-now', sku: PRODUCT.sku, quantity: quantity(), protection: protection() });
      location.href = PRODUCT.checkout;
    });
  }
  const offers = document.getElementById(PRODUCT.ids.offers);
  for (const opener of document.querySelectorAll('[data-action="other-sellers"]')) {
    opener.addEventListener('click', () => { if (offers) offers.hidden = false; });
  }
  if (offers) {
    offers.querySelector('[data-action="close-offers"]').addEventListener('click', () => { offers.hidden = true; });
    for (const button of offers.querySelectorAll('[data-offer]')) {
      button.addEventListener('click', async () => {
        await mutate('add-to-cart', { sku: PRODUCT.sku, quantity: 1, offerId: button.dataset.offer });
        window.dispatchEvent(new CustomEvent('store:cart-added'));
        offers.hidden = true;
        await openSheet();
      });
    }
  }
  const bundle = document.querySelector('[data-bundle]');
  if (bundle) {
    bundle.addEventListener('click', async () => {
      await mutate('add-bundle', { skus: bundle.dataset.bundle.split(',') });
      window.dispatchEvent(new CustomEvent('store:cart-added'));
      await openSheet();
    });
  }
  const list = document.querySelector('[data-action="add-to-list"]');
  if (list) list.addEventListener('click', () => { list.textContent = 'Added to Shopping List'; });
}
setTimeout(hydrate, PRODUCT.timings.productHydrate);
`;
