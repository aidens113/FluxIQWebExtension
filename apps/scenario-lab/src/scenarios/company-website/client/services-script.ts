import type { SiteClasses } from "../styles.js";

/** The price endpoint's apparent latency: how long the skeleton stays up. */
export const PRICE_LATENCY_MS = 700;

/**
 * The price list's loader: fetch the list on a basis, wait out the latency,
 * replace everything, and re-open whichever categories the visitor had open.
 * The accordions toggle with their buttons.
 */
export function servicesScript(ids: Record<"list" | "vat", string>, c: SiteClasses, pricesPath: string): string {
  return `
const sv = ${JSON.stringify(ids)};
const svc = ${JSON.stringify({ vatActive: c.vatActive, skeletonLine: c.skeletonLine })};
const list = document.getElementById(sv.list);
const opened = new Set(['servicing']);
let request = 0;
async function loadPrices(basis) {
  const mine = ++request;
  list.setAttribute('aria-busy', 'true');
  list.innerHTML = Array.from({ length: 6 }, () => '<div class="' + svc.skeletonLine + '"></div>').join('');
  const response = await fetch(${JSON.stringify(pricesPath)} + '?basis=' + basis);
  const html = await response.text();
  await new Promise((resolve) => setTimeout(resolve, ${PRICE_LATENCY_MS}));
  if (mine !== request) return;
  list.innerHTML = html;
  list.querySelectorAll('[data-category]').forEach((section) => setOpen(section, opened.has(section.getAttribute('data-category'))));
  list.removeAttribute('aria-busy');
}
function setOpen(section, open) {
  const head = section.querySelector('button');
  head.setAttribute('aria-expanded', String(open));
  head.lastElementChild.textContent = open ? '\\u2212' : '+';
  head.nextElementSibling.hidden = !open;
}
list.addEventListener('click', (event) => {
  const head = event.target.closest('button[aria-expanded]');
  if (!head) return;
  const section = head.closest('[data-category]');
  const open = head.getAttribute('aria-expanded') !== 'true';
  if (open) opened.add(section.getAttribute('data-category')); else opened.delete(section.getAttribute('data-category'));
  setOpen(section, open);
});
document.getElementById(sv.vat).addEventListener('click', (event) => {
  const option = event.target.closest('[data-basis]');
  if (!option || option.classList.contains(svc.vatActive)) return;
  document.querySelectorAll('#' + CSS.escape(sv.vat) + ' [data-basis]').forEach((node) => node.classList.toggle(svc.vatActive, node === option));
  loadPrices(option.getAttribute('data-basis'));
});
loadPrices('inc');
`;
}
