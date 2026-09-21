import { GEO_PLACES } from "../data/index.js";
import type { ShellKit } from "../shell/index.js";
import { companyOptions, type FilterBarIds } from "./filter-bar.js";
import type { UpsellIds } from "./people-page.js";
import type { PeopleQuery } from "./query.js";

type Input = { query: PeopleQuery; resultsId: string; bar: FilterBarIds; upsell: UpsellIds | undefined; skeleton: string };

/**
 * The people page's behaviour, defects included:
 *
 * - results load 0.7 seconds after the page, and after every page change,
 *   behind skeleton cards; a page change scrolls back to the top;
 * - Next was written against the page the address had when it loaded, so
 *   from a first page it reaches page 2, and from page 2 it reaches page 2
 *   again, forever. Page numbers and Previous work;
 * - a results request answered with the security check shows the check, which
 *   retries by itself after the answer's `retryAfter`, or two seconds after
 *   its box is clicked;
 * - applying a filter reloads the page at page 1 with the filter in the
 *   address.
 */
export function peopleClientScript(kit: ShellKit, input: Input): string {
  const j = JSON.stringify;
  const c = kit.css;
  const places = GEO_PLACES.map((place) => ({ value: place.id, label: place.label }));
  return `const byId = (id) => document.getElementById(id);
const GL = window.GL;
const QUERY = ${j(input.query)};
const initialPage = QUERY.page;
let current = QUERY.page;
let cards = {};
let upsellShown = false;
let attempt = 0;
const results = byId(${j(input.resultsId)});
const listHref = (q, endpoint) => {
  const parts = ['keywords=' + encodeURIComponent(q.keywords)];
  if (q.network.length) parts.push('network=' + encodeURIComponent(JSON.stringify(q.network)));
  if (q.geo.length) parts.push('geoUrn=' + encodeURIComponent(JSON.stringify(q.geo)));
  if (q.company.length) parts.push('currentCompany=' + encodeURIComponent(JSON.stringify(q.company)));
  parts.push('origin=FACETED_SEARCH');
  if (q.page > 1 || endpoint) parts.push('page=' + q.page);
  return GL.root + 'search/results/people/' + (endpoint ? 'fragment' : '') + '?' + parts.join('&');
};
async function load(page, push) {
  const mine = ++attempt;
  results.innerHTML = ${j(input.skeleton)};
  const q = { ...QUERY, page };
  if (push) { history.pushState({ page }, '', listHref(q, false)); window.scrollTo(0, 0); }
  await new Promise((resolve) => setTimeout(resolve, 700));
  if (mine !== attempt) return;
  const response = await fetch(listHref(q, true), { headers: { accept: 'application/json' } });
  const body = await response.json();
  if (mine !== attempt) return;
  results.innerHTML = body.html;
  if (response.status === 429) return challenge(page, body.retryAfter);
  cards = body.cards;
  current = page;
  const offer = ${j(input.upsell ?? null)};
  if (offer && !upsellShown) { upsellShown = true; byId(offer.scrim).hidden = false; }
}
function challenge(page, retryAfter) {
  const mine = attempt;
  const retry = () => { if (mine === attempt) load(page, false); };
  setTimeout(retry, retryAfter * 1000);
  const box = results.querySelector(${j(`.${c.fakeCheck}`)});
  box.addEventListener('click', () => {
    box.innerHTML = '<div class=${j(c.spinner)}></div><span>Verifying…</span>';
    setTimeout(retry, 2000);
  }, { once: true });
}
const offer = ${j(input.upsell ?? null)};
if (offer) {
  const close = () => { byId(offer.scrim).hidden = true; GL.mutate('dismiss-upsell', {}).catch(() => {}); };
  byId(offer.dismiss).addEventListener('click', close);
  byId(offer.noThanks).addEventListener('click', close);
}
results.addEventListener('click', (event) => {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.closest(${j(`.${c.pager}`)})) {
    const label = button.textContent.trim();
    if (label === 'Next') return void load(initialPage + 1, true);
    if (label === 'Previous') return void load(Math.max(1, current - 1), true);
    const number = Number(label);
    if (number) load(number, true);
    return;
  }
  const item = button.closest('li[data-urn]');
  const card = item && cards[item.getAttribute('data-urn')];
  if (!card) return;
  const label = button.textContent.trim();
  if (label === 'Connect') GL.openConnect({ memberUrn: card.memberUrn, name: card.name, onSent: () => { button.textContent = 'Pending'; } });
  else if (label === 'Pending') GL.openWithdraw({ urn: card.sentUrn, text: 'If you withdraw now, you won’t be able to resend to ' + card.name + ' for up to 3 weeks.', onDone: () => { button.textContent = 'Connect'; } });
  else if (label === 'Follow' || label === 'Following') button.textContent = label === 'Follow' ? 'Following' : 'Follow';
  else if (label === 'Accept') GL.mutate('accept-invitation', { urn: card.receivedUrn }).then(() => { button.textContent = 'Message'; GL.toast(card.name + ' is now a connection.'); });
  else if (label === 'Message') location.assign(GL.root + 'messaging/');
});
window.addEventListener('popstate', () => load(Number(new URL(location.href).searchParams.get('page')) || 1, false));
const bar = ${j(input.bar)};
const PLACES = ${j(places)};
const COMPANIES = ${j(companyOptions())};
const panels = bar.facets.map((facet) => byId(facet.panel));
const closePanels = () => panels.forEach((panel) => { panel.hidden = true; });
const apply = (facets) => {
  const q = { ...QUERY, page: 1 };
  for (const [name, values] of Object.entries(facets)) {
    if (name === 'network') q.network = values; else if (name === 'geoUrn') q.geo = values; else q.company = values;
  }
  location.assign(listHref(q, false));
};
const checked = (container) => [...container.querySelectorAll('input[type=checkbox]:checked')].map((box) => box.value);
for (const facet of bar.facets) {
  const panel = byId(facet.panel);
  byId(facet.pill).addEventListener('click', (event) => { if (panel.contains(event.target)) return; const open = panel.hidden; closePanels(); panel.hidden = !open; });
  byId(facet.cancel).addEventListener('click', () => { panel.hidden = true; });
  byId(facet.apply).addEventListener('click', () => apply({ [facet.facet]: checked(byId(facet.list)) }));
  if (!facet.input) continue;
  const input = byId(facet.input);
  const suggestions = byId(facet.suggestions);
  const pool = facet.facet === 'geoUrn' ? PLACES : COMPANIES;
  let timer = 0;
  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const typed = input.value.trim().toLowerCase();
      const listed = new Set(checked(byId(facet.list)).concat([...byId(facet.list).querySelectorAll('input')].map((box) => box.value)));
      suggestions.innerHTML = '';
      if (!typed) return;
      for (const option of pool.filter((entry) => entry.label.toLowerCase().includes(typed) && !listed.has(entry.value)).slice(0, 5)) {
        const row = document.createElement('div');
        row.className = ${j(c.typeaheadItem)};
        row.textContent = option.label;
        row.addEventListener('click', () => {
          const id = GL.nextId();
          const line = document.createElement('div');
          line.className = ${j(c.checkRow)};
          line.innerHTML = '<input type="checkbox" checked><label></label>';
          line.firstChild.id = id; line.firstChild.name = facet.facet; line.firstChild.value = option.value;
          line.lastChild.htmlFor = id; line.lastChild.textContent = option.label;
          byId(facet.list).prepend(line);
          input.value = '';
          suggestions.innerHTML = '';
        });
        suggestions.append(row);
      }
    }, 300);
  });
}
document.addEventListener('click', (event) => { if (!event.target.closest(${j(`.${c.pillBar}`)})) closePanels(); });
byId(bar.allPill).addEventListener('click', () => { closePanels(); byId(bar.allScrim).hidden = false; });
byId(bar.allCancel).addEventListener('click', () => { byId(bar.allScrim).hidden = true; });
byId(bar.allApply).addEventListener('click', () => apply(Object.fromEntries(Object.entries(bar.allLists).map(([name, id]) => [name, checked(byId(id))]))));
byId(bar.reset).addEventListener('click', () => location.assign(listHref({ ...QUERY, network: [], geo: [], company: [], page: 1 }, false)));
load(QUERY.page, false);
`;
}
