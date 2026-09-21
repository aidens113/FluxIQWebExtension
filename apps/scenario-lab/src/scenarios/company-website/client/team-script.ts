import { TEAM_AUTO_BATCHES, TEAM_BATCH_SIZE } from "../data/index.js";
import type { SiteClasses } from "../styles.js";

/** How long a batch's skeleton cards stay up after its response arrives. */
export const TEAM_SKELETON_MS = 450;

/**
 * The team grid's loader, with the two faults the live site has.
 *
 * - The first press of "Show more people" shows a spinner and sends nothing;
 *   the spinner stays until the button is pressed again, which loads the
 *   batch. (The site's analytics wrapper swallows the first click's promise.)
 * - A `429` from the batch endpoint is honoured: the status line says so and
 *   the loader asks again after `Retry-After` seconds.
 *
 * Choosing a chip starts the grid again from nothing for that branch.
 */
export function teamScript(ids: Record<"chips" | "grid" | "sentinel" | "status" | "more", string>, c: SiteClasses, batchPath: string): string {
  return `
const t = ${JSON.stringify(ids)};
const tc = ${JSON.stringify({ chipActive: c.chipActive, skeleton: c.skeleton, skeletonLine: c.skeletonLine, spinner: c.spinner, bio: c.bio, bioToggle: c.bioToggle })};
const grid = document.getElementById(t.grid);
const status = document.getElementById(t.status);
const more = document.getElementById(t.more);
const sentinel = document.getElementById(t.sentinel);
let filter = 'all', offset = 0, autoLoads = 0, loading = false, done = false, stuckClickPending = true, generation = 0;
const skeleton = () => '<div class="' + tc.skeleton + '" aria-hidden="true" data-skeleton><div class="' + tc.skeletonLine + '" style="width:40%"></div><div class="' + tc.skeletonLine + '"></div></div>';
async function loadBatch() {
  loading = true;
  more.hidden = true;
  const mine = generation;
  if (!grid.querySelector('[data-skeleton]')) grid.insertAdjacentHTML('beforeend', skeleton() + skeleton() + skeleton() + skeleton());
  const response = await fetch(${JSON.stringify(batchPath)} + '?branch=' + encodeURIComponent(filter) + '&offset=' + offset);
  if (mine !== generation) return;
  if (response.status === 429) {
    const wait = Number(response.headers.get('retry-after') || '2');
    status.textContent = 'We are getting a lot of requests right now. Trying again in ' + wait + ' seconds.';
    setTimeout(() => { if (mine === generation) { status.textContent = ''; loadBatch(); } }, wait * 1000);
    return;
  }
  const html = await response.text();
  const hasMore = response.headers.get('x-has-more') === 'true';
  await new Promise((resolve) => setTimeout(resolve, ${TEAM_SKELETON_MS}));
  if (mine !== generation) return;
  grid.querySelectorAll('[data-skeleton]').forEach((node) => node.remove());
  grid.querySelectorAll('.' + tc.skeleton).forEach((node) => node.remove());
  grid.insertAdjacentHTML('beforeend', html);
  offset += ${TEAM_BATCH_SIZE};
  loading = false;
  done = !hasMore;
  if (done) { status.textContent = 'That is everyone.'; return; }
  if (autoLoads >= ${TEAM_AUTO_BATCHES}) { more.hidden = false; return; }
  // Still at the end of the grid after it grew: keep going, as infinite scroll does.
  if (sentinel.getBoundingClientRect().top < innerHeight) autoLoad();
}
function autoLoad() {
  if (loading || done || autoLoads >= ${TEAM_AUTO_BATCHES}) return;
  autoLoads += 1;
  loadBatch();
}
new IntersectionObserver((entries) => { if (entries.some((entry) => entry.isIntersecting)) autoLoad(); }).observe(sentinel);
more.addEventListener('click', () => {
  if (stuckClickPending) {
    stuckClickPending = false;
    status.innerHTML = '<span class="' + tc.spinner + '"></span> Loading more people&hellip;';
    return;
  }
  status.textContent = '';
  loadBatch();
});
document.getElementById(t.chips).addEventListener('click', (event) => {
  const chip = event.target.closest('[data-filter]');
  if (!chip) return;
  document.querySelectorAll('#' + CSS.escape(t.chips) + ' [data-filter]').forEach((node) => node.classList.toggle(tc.chipActive, node === chip));
  generation += 1;
  filter = chip.getAttribute('data-filter');
  offset = 0; autoLoads = 1; done = false; stuckClickPending = true;
  grid.innerHTML = '';
  status.textContent = '';
  loadBatch();
});
document.addEventListener('click', (event) => {
  const toggle = event.target.closest('.' + tc.bioToggle);
  if (!toggle) return;
  const bio = toggle.nextElementSibling;
  if (bio) bio.hidden = !bio.hidden;
});
autoLoads = 1;
loadBatch();
`;
}
