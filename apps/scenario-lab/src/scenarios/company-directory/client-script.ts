import { COMPANY_ROOT } from "./format.js";

/**
 * Fixed latency before each page of the register is fetched. The rows already
 * on screen stay there until the new ones replace them, so a reader that does
 * not wait after Next reads the same page twice instead of racing a fast
 * fetch.
 */
const RESULTS_DELAY_MS = 150;

/**
 * The register's behaviour. A letter in the A-Z index and a sector in the
 * sector list apply as soon as they are clicked, as links in an index do; the
 * name search and the size band apply when Search is pressed. Each asks the
 * `results` route for the new page; the route renders it and records it, so
 * the page needs no run token. `aria-busy` on the results region is true while
 * a page is loading.
 */
export function companyClientScript(): string {
  return `
const resultsUrl = ${JSON.stringify(`${COMPANY_ROOT}results`)};
const results = document.querySelector('[data-testid="results"]');
const form = document.querySelector('[data-testid="search-form"]');
const control = (name) => form.querySelector('[name="' + name + '"]');
let browse = { page: 1, letter: '', sector: '', size: '', query: '' };
let latest = 0;
async function show(next) {
  browse = next;
  const ticket = ++latest;
  results.setAttribute('aria-busy', 'true');
  await new Promise((resolve) => setTimeout(resolve, ${RESULTS_DELAY_MS}));
  const params = new URLSearchParams({ page: String(next.page) });
  if (next.letter) params.set('letter', next.letter);
  if (next.sector) params.set('sector', next.sector);
  if (next.size) params.set('size', next.size);
  if (next.query) params.set('q', next.query);
  const response = await fetch(resultsUrl + '?' + params.toString());
  if (!response.ok) throw new Error('Register results failed: ' + response.status);
  const html = await response.text();
  if (ticket !== latest) return;
  results.innerHTML = html;
  results.setAttribute('aria-busy', 'false');
}
form.addEventListener('submit', (event) => {
  event.preventDefault();
  void show({ ...browse, page: 1, size: control('size').value, query: control('q').value.trim() });
});
document.addEventListener('click', (event) => {
  const letter = event.target.closest('[data-letter]');
  if (letter) {
    event.preventDefault();
    void show({ ...browse, page: 1, letter: letter.dataset.letter });
    return;
  }
  const sector = event.target.closest('[data-sector]');
  if (sector) {
    event.preventDefault();
    void show({ ...browse, page: 1, sector: sector.dataset.sector });
    return;
  }
  const pager = event.target.closest('[data-page]');
  if (pager) {
    event.preventDefault();
    void show({ ...browse, page: Number(pager.dataset.page) });
  }
});`;
}
