/**
 * A results page in the browser.
 *
 * The grid is built the way a client-rendered storefront builds it: skeletons
 * first, then the first batch of cards from an inert template 600 ms later,
 * then the rest fetched and drawn 400 ms after the grid is scrolled to them.
 * Images load when they scroll into view. Every filter, sort tab and chip is a
 * styled div whose handler navigates; Previous and the page numbers are
 * ordinary links. Next is broken the way it is on the live site: its handler
 * reads pagination state a refactor stopped providing, throws, and does
 * nothing, so the only way forward is a page number or "Go to page".
 */
export function searchScript(): string {
  return SEARCH;
}

const SEARCH = String.raw`
const grid = byClass('grid') || byClass('listView');
const skeletons = grid ? Array.from(grid.children) : [];

function place(fromIndex, html) {
  const holder = document.createElement('div');
  holder.innerHTML = html;
  const cards = Array.from(holder.children);
  cards.forEach((card, offset) => {
    const target = skeletons[fromIndex + offset];
    if (target) target.replaceWith(card);
  });
  watchImages(cards);
}

const imageWatcher = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    const image = entry.target;
    image.src = image.getAttribute('data-src');
    image.removeAttribute('data-src');
    imageWatcher.unobserve(image);
  }
}, { rootMargin: '100px' });

function watchImages(cards) {
  for (const card of cards) for (const image of qsa('img[data-src]', card)) imageWatcher.observe(image);
}

if (grid) setTimeout(() => {
  const template = document.getElementById('fb-first-cards');
  if (template) { place(0, template.innerHTML); template.remove(); }
  const rest = skeletons.slice(pageData.firstBatch);
  if (rest.length === 0) return;
  const restWatcher = new IntersectionObserver(async (entries) => {
    if (!entries.some((entry) => entry.isIntersecting)) return;
    restWatcher.disconnect();
    const response = await fetch(boot.root + pageData.cardsHref, { cache: 'no-store' });
    if (!response.ok) throw new Error('Result cards failed to load: ' + response.status);
    const html = await response.text();
    await sleep(400);
    place(pageData.firstBatch, html);
  }, { rootMargin: '0px' });
  rest.forEach((skeleton) => restWatcher.observe(skeleton));
}, 600);

const sidebar = byClass('sidebar');
if (sidebar) {
  const options = allByClass('filterOption', sidebar);
  options.slice(0, pageData.filterHrefs.length).forEach((option, index) => option.addEventListener('click', () => { location.href = pageData.filterHrefs[index]; }));
  options.slice(pageData.filterHrefs.length).forEach((option) => option.addEventListener('click', () => toast('Brand filters are temporarily unavailable.')));
  const [minBox, maxBox] = allByClass('priceInput', byClass('priceInputs', sidebar));
  byClass('btn', byClass('priceInputs', sidebar)).addEventListener('click', () => {
    const url = new URL(pageData.priceBase, location.origin);
    if (minBox.value.trim()) url.searchParams.set('minPrice', minBox.value.trim());
    if (maxBox.value.trim()) url.searchParams.set('maxPrice', maxBox.value.trim());
    location.href = url.pathname + url.search;
  });
}

allByClass('sortTab').forEach((tab, index) => tab.addEventListener('click', () => { location.href = pageData.sortHrefs[index]; }));
allByClass('chip', byClass('chips') || document.createElement('div')).forEach((chip, index) => chip.addEventListener('click', () => { location.href = pageData.chipHrefs[index]; }));

const pager = byClass('pager');
if (pager) {
  const items = allByClass('pagerItem', pager);
  const next = items[items.length - 1];
  let pagination;
  next.addEventListener('click', () => {
    const target = pagination.current + 1;
    if (target <= pageData.pageCount) location.href = pageData.jumpBase + '&page=' + target;
  });
  const jump = byClass('pagerJump', pager);
  byClass('btn', jump).addEventListener('click', () => {
    const wanted = Number(qs('input', jump).value);
    if (!Number.isInteger(wanted) || wanted < 1 || wanted > pageData.pageCount) { toast('Please enter a page between 1 and ' + pageData.pageCount + '.'); return; }
    location.href = pageData.jumpBase + (wanted > 1 ? '&page=' + wanted : '');
  });
}
`;
