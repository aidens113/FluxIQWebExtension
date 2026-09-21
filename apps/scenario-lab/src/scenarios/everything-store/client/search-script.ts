import type { StoreClasses, StoreIds } from "../style/index.js";
import { STORE_TIMINGS } from "./timings.js";

/**
 * A results page's script.
 *
 * - After `resultsHydrate`, the results template replaces the placeholder
 *   cards. Until then the list holds eight empty cards.
 * - The sentinel under the twelfth result fetches the rest of the page
 *   `lazyResults` after a scroll brings it within reach of the viewport, or
 *   past it, and only after a scroll: a page nobody scrolls never loads it.
 * - Images keep a transparent pixel until they scroll into view.
 * - "Add to cart" on a card adds one and fires the event the header badge
 *   miscounts.
 * - Under `deal-wheel`, the spin-to-win promotion opens over an inert page
 *   `dealWheel` after load. Its way out is a line of text that reads like an
 *   insult and is not a button.
 */
export function searchScript(css: StoreClasses, ids: StoreIds, options: { dealWheel: boolean }): string {
  return `const SEARCH = ${JSON.stringify({ css, ids, dealWheel: options.dealWheel, timings: STORE_TIMINGS })};
${SEARCH_BODY}`;
}

const SEARCH_BODY = String.raw`
function showImages(scope) {
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const image = entry.target;
      if (image.dataset.src) image.src = image.dataset.src;
      observer.unobserve(image);
    }
  });
  for (const image of scope.querySelectorAll('img[data-src]')) observer.observe(image);
}
function toast(text) {
  const note = document.createElement('div');
  note.className = SEARCH.css.toast;
  note.setAttribute('role', 'status');
  note.textContent = text;
  document.body.append(note);
  setTimeout(() => note.remove(), 3000);
}
function wireCards(scope) {
  for (const button of scope.querySelectorAll('[data-add-sku]')) {
    button.addEventListener('click', async () => {
      button.disabled = true;
      await mutate('add-to-cart', { sku: button.dataset.addSku, quantity: 1 });
      window.dispatchEvent(new CustomEvent('store:cart-added'));
      button.textContent = 'Added';
      toast('Added to cart');
    });
  }
  for (const info of scope.querySelectorAll('[aria-label="Leave ad feedback"]')) {
    info.addEventListener('click', () => toast('Thanks. Your feedback helps us show more relevant ads.'));
  }
  showImages(scope);
}
function watchSentinel() {
  const sentinel = document.getElementById(SEARCH.ids.sentinel);
  if (!sentinel) return;
  let requested = false;
  const load = async () => {
    const response = await fetch(sentinel.dataset.more, { headers: { accept: 'text/html' } });
    if (!response.ok) { sentinel.textContent = 'Something went wrong. Reload to see more results.'; return; }
    const holder = document.createElement('div');
    holder.innerHTML = await response.text();
    const nodes = [...holder.children];
    sentinel.replaceWith(...nodes);
    for (const node of nodes) wireCards(node);
  };
  const onScroll = () => {
    if (requested || sentinel.getBoundingClientRect().top > window.innerHeight + 200) return;
    requested = true;
    window.removeEventListener('scroll', onScroll);
    setTimeout(load, SEARCH.timings.lazyResults);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
}
function hydrate() {
  const results = document.getElementById(SEARCH.ids.results);
  const template = document.getElementById(SEARCH.ids.resultsTemplate);
  if (!results || !template) return;
  results.replaceChildren(template.content.cloneNode(true));
  results.removeAttribute('aria-busy');
  template.remove();
  wireCards(results);
  watchSentinel();
}
setTimeout(hydrate, SEARCH.timings.resultsHydrate);
showImages(document);

const sort = document.getElementById(SEARCH.ids.sort);
if (sort) sort.addEventListener('change', () => { location.href = sort.selectedOptions[0].dataset.href; });

function openWheel() {
  if (window.storeModals.busy()) { setTimeout(openWheel, 1000); return; }
  const scrim = document.createElement('div');
  scrim.className = SEARCH.css.scrim;
  scrim.innerHTML = '<div class="' + SEARCH.css.dialog + ' ' + SEARCH.css.wheel + '" role="dialog" aria-modal="true" aria-labelledby="' + SEARCH.ids.wheel + '" data-testid="deal-wheel">'
    + '<p class="' + SEARCH.css.dialogHead + '" id="' + SEARCH.ids.wheel + '">Spin to win up to 20% off!</p>'
    + '<div class="' + SEARCH.css.dialogBody + '"><div class="' + SEARCH.css.wheelDisc + '" aria-hidden="true"></div><p data-wheel-result>One spin per customer. Today only.</p></div>'
    + '<div class="' + SEARCH.css.dialogFoot + '"><button type="button" class="' + SEARCH.css.button + ' ' + SEARCH.css.buttonPrimary + '" data-spin>Spin the wheel</button></div>'
    + '<p class="' + SEARCH.css.linkish + '" data-decline>No thanks, I would rather pay full price</p></div>';
  window.storeModals.open('deal-wheel', scrim);
  const done = async () => {
    window.storeModals.close('deal-wheel', scrim);
    await mutate('dismiss-nudge', { nudge: 'deal-wheel' });
  };
  scrim.querySelector('[data-decline]').addEventListener('click', done);
  const spin = scrim.querySelector('[data-spin]');
  spin.addEventListener('click', () => {
    if (spin.dataset.spun) { done(); return; }
    spin.dataset.spun = 'yes';
    scrim.querySelector('[data-wheel-result]').textContent = 'You won 5% off your next order! Code SPIN5 has been saved to your account.';
    spin.textContent = 'Continue shopping';
  });
}
if (SEARCH.dealWheel) setTimeout(openWheel, SEARCH.timings.dealWheel);
`;
