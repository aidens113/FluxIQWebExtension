import { PROPERTY_ROOT } from "./format.js";

/**
 * Fixed latency before each page of results is fetched. The results already on
 * screen stay there until the new ones replace them, so a reader that does not
 * wait after Next reads the same page twice instead of racing a fast fetch.
 */
const RESULTS_DELAY_MS = 150;

/**
 * The page's behaviour. The facets apply on Search only -- which is how a
 * portal behaves, and what makes the submit button worth pressing -- and the
 * pagination control applies on click. Each asks the `results` route for the
 * new page; the route renders it and records it, so the page needs no run
 * token. `aria-busy` on the results region is true while a page is loading.
 */
export function propertyClientScript(): string {
  return `
const resultsUrl = ${JSON.stringify(`${PROPERTY_ROOT}results`)};
const results = document.querySelector('[data-testid="results"]');
const form = document.querySelector('[data-testid="search-form"]');
const control = (name) => form.querySelector('[name="' + name + '"]');
let search = { page: 1, area: '', beds: '', band: '', newThisWeek: false, sort: 'recent' };
let latest = 0;
async function show(next) {
  search = next;
  const ticket = ++latest;
  results.setAttribute('aria-busy', 'true');
  await new Promise((resolve) => setTimeout(resolve, ${RESULTS_DELAY_MS}));
  const params = new URLSearchParams({ page: String(next.page), sort: next.sort });
  if (next.area) params.set('area', next.area);
  if (next.beds) params.set('beds', next.beds);
  if (next.band) params.set('band', next.band);
  if (next.newThisWeek) params.set('new', 'yes');
  const response = await fetch(resultsUrl + '?' + params.toString());
  if (!response.ok) throw new Error('Property results failed: ' + response.status);
  const html = await response.text();
  if (ticket !== latest) return;
  results.innerHTML = html;
  results.setAttribute('aria-busy', 'false');
}
form.addEventListener('submit', (event) => {
  event.preventDefault();
  void show({
    page: 1,
    area: control('area').value,
    beds: control('beds').value,
    band: control('band').value,
    newThisWeek: control('new').checked,
    sort: control('sort').value
  });
});
results.addEventListener('click', (event) => {
  const pager = event.target.closest('[data-page]');
  if (!pager) return;
  // renamed-pagination renders the control as a link, so the default
  // navigation has to be stopped; on a button preventDefault does nothing.
  event.preventDefault();
  void show({ ...search, page: Number(pager.dataset.page) });
});`;
}
