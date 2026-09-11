import { CATALOG_ROOT } from "./format.js";

/**
 * Fixed latency before each results view is fetched. The old page stays on
 * screen until the new one replaces it, so a reader that does not wait after
 * Next reads the stale page every time instead of racing a fast fetch.
 */
const RESULTS_DELAY_MS = 150;

/**
 * Page behaviour: search applies on submit only (Enter or the button), the
 * in-stock filter on change, and numbered pages or Next on click. Each asks
 * the `results` route for the new view; the route renders it and records it
 * through `mutate`, so the page needs no run token. `aria-busy` on the
 * results region is true while a view is loading.
 */
export function catalogClientScript(): string {
  return `
const resultsUrl = ${JSON.stringify(`${CATALOG_ROOT}results`)};
const results = document.querySelector('[data-testid="results"]');
const searchInput = document.querySelector('[data-testid="search-input"]');
const inStockOnly = document.querySelector('[data-testid="in-stock-only"]');
let view = { page: 1, query: '', inStockOnly: false };
let latest = 0;
async function show(next) {
  view = next;
  const ticket = ++latest;
  results.setAttribute('aria-busy', 'true');
  await new Promise((resolve) => setTimeout(resolve, ${RESULTS_DELAY_MS}));
  const params = new URLSearchParams({ page: String(next.page) });
  if (next.query) params.set('q', next.query);
  if (next.inStockOnly) params.set('stock', 'in');
  const response = await fetch(resultsUrl + '?' + params.toString());
  if (!response.ok) throw new Error('Catalog results failed: ' + response.status);
  const html = await response.text();
  if (ticket !== latest) return;
  results.innerHTML = html;
  results.setAttribute('aria-busy', 'false');
}
document.querySelector('[data-testid="search-form"]').addEventListener('submit', (event) => {
  event.preventDefault();
  void show({ page: 1, query: searchInput.value.trim(), inStockOnly: view.inStockOnly });
});
inStockOnly.addEventListener('change', () => { void show({ page: 1, query: view.query, inStockOnly: inStockOnly.checked }); });
results.addEventListener('click', (event) => {
  const control = event.target.closest('button[data-page]');
  if (control) void show({ ...view, page: Number(control.dataset.page) });
});`;
}
