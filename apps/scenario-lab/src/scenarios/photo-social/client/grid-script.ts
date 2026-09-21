/**
 * A profile's grid, and the modal a cell opens.
 *
 * - The grid loads a screen at a time as the visitor nears the bottom, behind
 *   a row of skeleton cells.
 * - Asking for another screen within a moment and a half of the last one
 *   trips the rate limit: a spinner and "Please wait a few moments before you
 *   try again", a countdown, then a "Try again" control. The spinner does not
 *   clear on its own; only "Try again" does.
 * - The third screen waits behind the session check the server sends instead
 *   of cells; "Continue as" confirms the session and the grid carries on.
 * - A cell opens its post in a modal and puts the post's address in the
 *   location bar. The modal's Next and Go back move through the cells already
 *   loaded; at the last loaded cell Next is still drawn and does nothing,
 *   because the grid behind it has not been asked for more.
 */
export const GRID_SCRIPT = String.raw`
const GRID_THROTTLE_MS = 1500;
const RETRY_AFTER_S = 4;
const grid = document.querySelector('.' + H.grid);
let gridLoaded = FL.page.loaded || 0;
let gridBusy = false;
let gridEnded = gridLoaded >= (FL.page.total || 0);
let gridWalled = false;
let gridThrottled = false;
let lastLoadEnded = performance.now();

async function loadGrid(force) {
  if (!grid || gridBusy || gridEnded || gridWalled || (gridThrottled && !force)) return;
  if (!force && performance.now() - lastLoadEnded < GRID_THROTTLE_MS) { throttleGrid(); return; }
  gridBusy = true;
  const skeletons = [];
  for (let i = 0; i < 6; i += 1) { const cell = el('<div class="' + C.skeleton + '" style="aspect-ratio:1;margin:0"></div>'); grid.appendChild(cell); skeletons.push(cell); }
  const tab = FL.page.tab === 'reels' ? '&tab=reels' : '';
  const [response] = await Promise.all([fetch(ROOT + FL.page.handle + '/grid?offset=' + gridLoaded + tab), wait(400)]);
  skeletons.forEach((cell) => cell.remove());
  if (response.status === 204) gridEnded = true;
  else if (response.status === 401) {
    gridWalled = true;
    const wall = el(await response.text());
    grid.after(wall);
    wall.querySelector('[role="button"]').addEventListener('click', async () => {
      await act('session', {});
      wall.remove();
      gridWalled = false;
      loadGrid(true);
    });
  } else {
    const html = await response.text();
    grid.insertAdjacentHTML('beforeend', html);
    gridLoaded = grid.querySelectorAll('.' + H.cell).length;
    gridEnded = gridLoaded >= FL.page.total;
  }
  lastLoadEnded = performance.now();
  gridBusy = false;
}

function throttleGrid() {
  gridThrottled = true;
  const box = el('<div style="text-align:center;padding:16px"><div class="' + C.spinner + '"></div><p>Please wait a few moments before you try again.</p><p class="' + C.meta + '">Try again in ' + RETRY_AFTER_S + 's</p></div>');
  grid.after(box);
  let left = RETRY_AFTER_S;
  const timer = setInterval(() => {
    left -= 1;
    if (left > 0) { box.querySelector('.' + H.meta).textContent = 'Try again in ' + left + 's'; return; }
    clearInterval(timer);
    box.querySelector('.' + H.meta).replaceWith(el('<div role="button" tabindex="0" class="' + C.secondary + '">Try again</div>'));
    box.querySelector('[role="button"]').addEventListener('click', () => { box.remove(); gridThrottled = false; loadGrid(true); });
  }, 1000);
}

if (grid && FL.page.kind === 'profile') {
  window.addEventListener('scroll', () => {
    if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 300) loadGrid(false);
  }, { passive: true });
}

let modal = null;
let modalCode = null;
function loadedCodes() { return Array.from(grid.querySelectorAll('.' + H.cell)).map((cell) => cell.getAttribute('href').match(/\/p\/([^/]+)\//)[1]); }

async function showInModal(code) {
  modalCode = code;
  const holder = modal.querySelector('.' + H.article) || modal.appendChild(el('<article class="' + C.article + '"></article>'));
  holder.innerHTML = '<div class="' + C.skeleton + '" style="margin:0;height:100%"></div>';
  const response = await fetch(ROOT + 'p/' + code + '/?fragment=1');
  holder.outerHTML = await response.text();
  history.replaceState({}, '', ROOT + 'p/' + code + '/');
  if (window.flUpsell) window.flUpsell();
}

function openModal(code) {
  history.pushState({}, '', ROOT + 'p/' + code + '/');
  modal = el('<div class="' + C.modal + '" role="dialog" aria-modal="true"><div role="button" tabindex="0" class="' + C.close + '">' + icon('close', C.navIcon, 'Close') + '</div><div role="button" tabindex="0" class="' + C.modalNav + '" style="left:24px">' + icon('back', C.navIcon, 'Go back') + '</div><div role="button" tabindex="0" class="' + C.modalNav + '" style="right:24px">' + icon('next', C.navIcon, 'Next') + '</div></div>');
  document.body.appendChild(modal);
  modal.addEventListener('click', (event) => {
    const control = event.target.closest('[role="button"]');
    if (event.target === modal) { closeModal(); return; }
    if (!control || control.parentElement !== modal) return;
    const label = labelOf(control);
    if (label === 'Close') { closeModal(); return; }
    const codes = loadedCodes();
    const at = codes.indexOf(modalCode);
    if (label === 'Next' && at >= 0 && at < codes.length - 1) showInModal(codes[at + 1]);
    if (label === 'Go back' && at > 0) showInModal(codes[at - 1]);
  });
  showInModal(code);
}

function closeModal() {
  if (!modal) return;
  modal.remove();
  modal = null;
  history.replaceState({}, '', ROOT + FL.page.handle + '/' + (FL.page.tab === 'reels' ? 'reels/' : ''));
}

document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && modal) closeModal(); });
if (grid && FL.page.kind === 'profile') {
  grid.addEventListener('click', (event) => {
    const cell = event.target.closest('.' + H.cell);
    if (!cell || event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    openModal(cell.getAttribute('href').match(/\/p\/([^/]+)\//)[1]);
  });
}
`;
