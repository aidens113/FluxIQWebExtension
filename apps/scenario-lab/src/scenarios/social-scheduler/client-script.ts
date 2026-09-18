import { connectedAccounts } from "./accounts.js";
import { SCHEDULER_ROOT } from "./format.js";
import { POST_LIMIT } from "./types.js";
import type { SchedulerClasses } from "./styles.js";

/** How long the search box waits before filtering, as a real console does rather than filtering on every keystroke. */
const SEARCH_DELAY_MS = 120;

/**
 * Everything the page does in the browser.
 *
 * Filtering is a real re-render: the rows that do not match are taken out of
 * the document rather than hidden, which is what a keyed list does and what
 * makes an extraction after a filter honest. The row elements themselves are
 * reused, so a post keeps its element across filters.
 *
 * A row the composer adds is not built here. The page asks the server for that
 * one row's markup and inserts what comes back, so a row added during a run is
 * byte-for-byte the markup a row that was already there has. The toast's slot
 * text is read out of that row for the same reason.
 *
 * The class names arrive as data. That is not a convenience -- it is the same
 * arrangement the real page has, where the bundle and the markup are emitted
 * from one build and share its hashes, and it is why the `restyled` rendering
 * needs no second copy of this script.
 */
export function schedulerClientScript(css: SchedulerClasses): string {
  const accounts = connectedAccounts.map(({ slug, handle, display }) => ({ slug, handle, display }));
  return `const css = ${JSON.stringify(css)};
const accounts = ${JSON.stringify(accounts)};
const schedulerRoot = ${JSON.stringify(SCHEDULER_ROOT)};
const postLimit = ${POST_LIMIT};
const searchDelayMs = ${SEARCH_DELAY_MS};
${QUEUE_CORE}
${COMPOSER_AND_RETRY}`;
}

/**
 * The queue itself: filters, selection, the chips that say what is narrowed,
 * and the counts that follow. Every value it filters on is read out of the
 * row's own cells, found by the header text rather than by cell position, so
 * the reordered rendering needs no second copy of this either.
 */
const QUEUE_CORE = String.raw`
function esc(text) {
  return String(text).replace(/[&<>"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[character]);
}

function el(tag, className, attributes = {}, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
  if (text !== undefined) node.textContent = text;
  return node;
}

const tbody = document.querySelector('[data-testid="queue-rows"]');
const table = tbody.closest('table');
const card = table.closest('section');
const tableWrap = card.querySelector('.' + css.tableWrap);
const toolbar = card.querySelector('.' + css.toolbar);
const searchInput = document.querySelector('[data-testid="queue-search"]');
const accountFilter = document.querySelector('[data-testid="account-filter"]');
const statusFilter = document.querySelector('[data-testid="status-filter"]');
const rangeFilter = document.querySelector('[data-testid="range-filter"]');
const resultCount = document.querySelector('[data-testid="result-count"]');
const stats = document.querySelector('[data-testid="queue-stats"]');
const toastRegion = document.querySelector('[data-testid="toast-region"]');
const selectAll = table.tHead.querySelector('input[type="checkbox"]');

const headerIndex = {};
Array.from(table.tHead.rows[0].cells).forEach((cell, index) => { headerIndex[cell.textContent.trim()] = index; });

const minutesPerWeek = 10080;
let queue = Array.from(tbody.rows).map(recordFromRow);
const selected = new Set();
let search = '';
let searchTimer = 0;
let chipRow = null;
let bulkBar = null;

function recordFromRow(row) {
  return {
    row,
    id: row.dataset.postId,
    account: row.dataset.account,
    offset: Number(row.dataset.offset),
    body: row.querySelector('.' + css.postExcerpt).getAttribute('title') || '',
  };
}

function cellOf(record, column) { return record.row.cells[headerIndex[column]]; }
function statusOf(record) { return cellOf(record, 'Status').textContent.trim(); }
function accountTextOf(record) { return cellOf(record, 'Account').textContent.replace(/\s+/g, ' ').trim(); }
function labelOf(select) { return select.value ? select.selectedOptions[0].textContent : ''; }

function inRange(offset, range) {
  if (range === 'next-7') return offset >= 0 && offset < minutesPerWeek;
  if (range === 'upcoming') return offset >= 0;
  if (range === 'last-7') return offset < 0 && offset > -minutesPerWeek;
  if (range === 'past') return offset < 0;
  return true;
}

function visibleRecords() {
  const needle = search.trim().toLowerCase();
  const status = labelOf(statusFilter);
  return queue.filter((record) =>
    (needle === '' || record.body.toLowerCase().includes(needle) || accountTextOf(record).toLowerCase().includes(needle))
    && (accountFilter.value === '' || record.account === accountFilter.value)
    && (status === '' || statusOf(record) === status)
    && inRange(record.offset, rangeFilter.value));
}

function emptyRow() {
  const row = el('tr', '');
  row.append(el('td', css.empty, { colspan: String(table.tHead.rows[0].cells.length) }, 'No posts match these filters.'));
  return row;
}

function apply() {
  const shown = visibleRecords();
  tbody.replaceChildren(...(shown.length > 0 ? shown.map((record) => record.row) : [emptyRow()]));
  resultCount.textContent = 'Showing ' + shown.length + ' of ' + queue.length + ' posts';
  renderChips();
  renderBulk();
}

function refreshStats() {
  const scheduled = queue.filter((record) => statusOf(record) === 'Scheduled').length;
  const failed = queue.filter((record) => statusOf(record) === 'Failed').length;
  stats.textContent = queue.length + ' posts · ' + scheduled + ' scheduled · ' + failed + ' failed';
}

function renderChips() {
  if (chipRow) { chipRow.remove(); chipRow = null; }
  const chips = [];
  if (search.trim() !== '') chips.push('Search: ' + search.trim());
  if (labelOf(accountFilter) !== '') chips.push('Account: ' + labelOf(accountFilter));
  if (labelOf(statusFilter) !== '') chips.push('Status: ' + labelOf(statusFilter));
  if (labelOf(rangeFilter) !== '') chips.push('When: ' + labelOf(rangeFilter));
  if (chips.length === 0) return;
  chipRow = el('div', css.chipRow, { 'data-testid': 'filter-summary' });
  for (const chip of chips) chipRow.append(el('span', css.chip, {}, chip));
  const clear = el('button', css.button, { type: 'button' }, 'Clear filters');
  clear.addEventListener('click', () => {
    searchInput.value = '';
    search = '';
    accountFilter.value = '';
    statusFilter.value = '';
    rangeFilter.value = '';
    apply();
  });
  chipRow.append(clear);
  toolbar.after(chipRow);
}

function renderBulk() {
  if (bulkBar) { bulkBar.remove(); bulkBar = null; }
  const shown = visibleRecords();
  if (selected.size === 0) {
    selectAll.checked = false;
    selectAll.indeterminate = false;
    return;
  }
  bulkBar = el('div', css.bulkBar, { 'data-testid': 'bulk-toolbar' });
  bulkBar.append(el('p', css.bulkCount, {}, selected.size + ' selected'));
  const actions = el('div', css.pageActions);
  const exportCsv = el('button', css.button, { type: 'button' }, 'Export CSV');
  exportCsv.addEventListener('click', () => showToast('Export queued. You will get an email when it is ready.'));
  const retry = el('button', css.button, { type: 'button' }, 'Retry');
  retry.addEventListener('click', () => openRetryDialog([...selected]));
  actions.append(exportCsv, retry);
  bulkBar.append(actions);
  tableWrap.before(bulkBar);
  selectAll.checked = shown.length > 0 && shown.every((record) => selected.has(record.id));
  selectAll.indeterminate = !selectAll.checked;
}

function setSelected(record, on) {
  if (on) selected.add(record.id); else selected.delete(record.id);
  record.row.classList.toggle(css.rowSelected, on);
  record.row.cells[0].firstElementChild.checked = on;
}

searchInput.addEventListener('input', () => {
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(() => { search = searchInput.value; apply(); }, searchDelayMs);
});
for (const control of [accountFilter, statusFilter, rangeFilter]) control.addEventListener('change', apply);

table.addEventListener('change', (event) => {
  const box = event.target;
  if (!(box instanceof HTMLInputElement) || box.type !== 'checkbox') return;
  if (box === selectAll) {
    for (const record of visibleRecords()) setSelected(record, box.checked);
  } else {
    const record = queue.find((candidate) => candidate.row === box.closest('tr'));
    if (record) setSelected(record, box.checked);
  }
  renderBulk();
});

toolbar.addEventListener('click', (event) => {
  const action = event.target.closest('[data-action="export"]');
  if (action) showToast('Export queued. You will get an email when it is ready.');
});

for (const button of document.querySelectorAll('[data-action="import"], [data-action="connect"]')) {
  button.addEventListener('click', () => showToast('Ask a workspace owner to connect or import accounts.'));
}

const announcement = document.querySelector('[data-testid="whats-new-scrim"]');
if (announcement) {
  const closeAnnouncement = () => {
    if (!announcement.isConnected) return;
    announcement.remove();
    document.querySelector('.' + css.app).removeAttribute('inert');
  };
  announcement.querySelector('[data-action="dismiss-whats-new"]').addEventListener('click', closeAnnouncement);
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeAnnouncement(); });
}
`;

/**
 * The composer, the retry confirmation, the row menu and the toast.
 *
 * Both the composer and the confirmation post their change through the
 * fixture's mutation endpoint before touching the page, so the moment the
 * toast is readable the server oracle already agrees with it.
 *
 * A retry ends by moving the Status filter to Queued. That is what the console
 * does -- it shows you what you just did -- and it is the reason a table read
 * after a retry is evidence that the retry ran: nothing else in this fixture
 * can put a post into Queued.
 */
const COMPOSER_AND_RETRY = String.raw`
let menuNode = null;
let menuButton = null;
let scrimNode = null;

const composer = document.querySelector('[data-testid="composer"]');
const composerForm = document.querySelector('[data-testid="composer-form"]');
const composerBody = composerForm.querySelector('textarea[name="body"]');
const composerCount = document.querySelector('[data-testid="composer-count"]');

function showToast(message) {
  const toast = el('div', css.toast, { 'data-testid': 'toast', role: 'status' });
  toast.append(el('span', '', {}, message));
  toastRegion.replaceChildren(toast);
}

function closeMenu() {
  if (menuNode) menuNode.remove();
  if (menuButton) menuButton.setAttribute('aria-expanded', 'false');
  menuNode = null;
  menuButton = null;
}

function openMenu(button, title, items) {
  closeMenu();
  const rect = button.getBoundingClientRect();
  const node = el('div', css.menu, { role: 'menu', 'aria-label': 'Post actions' });
  node.style.top = (rect.bottom + window.scrollY + 4) + 'px';
  node.style.left = Math.max(8, rect.right + window.scrollX - 208) + 'px';
  node.append(el('p', css.menuHead, {}, title));
  for (const item of items) {
    const entry = el('button', item.danger ? css.menuItem + ' ' + css.menuDanger : css.menuItem, { type: 'button', role: 'menuitem' }, item.label);
    entry.addEventListener('click', () => { closeMenu(); item.run(); });
    node.append(entry);
  }
  document.body.append(node);
  button.setAttribute('aria-expanded', 'true');
  menuNode = node;
  menuButton = button;
}

function closeOverlay() {
  if (scrimNode) scrimNode.remove();
  scrimNode = null;
}

function openOverlay(html) {
  closeOverlay();
  const scrim = el('div', css.scrim);
  scrim.innerHTML = html;
  document.body.append(scrim);
  scrimNode = scrim;
  const cancel = scrim.querySelector('[data-action="cancel"]');
  if (cancel) cancel.addEventListener('click', closeOverlay);
  return scrim;
}

function openRetryDialog(ids) {
  const failed = ids.filter((id) => {
    const record = queue.find((candidate) => candidate.id === id);
    return record && statusOf(record) === 'Failed';
  });
  const scrim = openOverlay(
    '<div class="' + css.dialog + '" role="dialog" aria-modal="true" aria-label="Retry posts" data-testid="confirm-dialog">'
    + '<p class="' + css.dialogHead + '">Retry these posts?</p>'
    + '<div class="' + css.dialogBody + '"><p>' + failed.length + ' of ' + ids.length + ' selected posts failed and can go back into the queue at their next free slot.</p></div>'
    + '<div class="' + css.dialogFoot + '"><button class="' + css.button + '" type="button" data-action="cancel">Cancel</button>'
    + '<button class="' + css.button + ' ' + css.buttonPrimary + '" type="button" data-action="confirm-retry">Retry posts</button></div></div>');
  scrim.querySelector('[data-action="confirm-retry"]').addEventListener('click', async () => {
    closeOverlay();
    if (failed.length === 0) { showToast('Nothing to retry: none of the selected posts failed.'); return; }
    await mutate('retry-posts', { ids: failed });
    for (const id of failed) {
      const record = queue.find((candidate) => candidate.id === id);
      const badge = cellOf(record, 'Status').firstElementChild;
      badge.className = css.badge + ' ' + css.badgeQueued;
      badge.textContent = 'Queued';
      setSelected(record, false);
    }
    selected.clear();
    statusFilter.value = 'queued';
    apply();
    refreshStats();
    showToast(failed.length + ' posts queued for retry');
  });
}

async function scheduleComposedPost() {
  const data = new FormData(composerForm);
  const payload = {
    accountSlug: String(data.get('account') || ''),
    body: String(data.get('body') || '').trim(),
    date: String(data.get('date') || '').trim(),
    time: String(data.get('time') || '').trim(),
  };
  const account = accounts.find((candidate) => candidate.slug === payload.accountSlug);
  if (!account || payload.body === '' || !/^\d{4}-\d{2}-\d{2}$/.test(payload.date) || !/^\d{2}:\d{2}$/.test(payload.time)) {
    showToast('Choose an account and give the post a date as YYYY-MM-DD and a time as HH:MM.');
    return;
  }
  const snapshot = await mutate('schedule-post', payload);
  const id = 'pst_new' + String(snapshot.state.composed.length).padStart(3, '0');
  const response = await fetch(schedulerRoot + 'rows/' + id);
  if (!response.ok) throw new Error('The queue could not render the new post: ' + response.status);
  const holder = document.createElement('tbody');
  holder.innerHTML = await response.text();
  const row = holder.rows[0];
  const record = recordFromRow(row);
  const at = record.offset >= 0
    ? queue.findIndex((candidate) => candidate.offset < 0 || candidate.offset > record.offset)
    : queue.findIndex((candidate) => candidate.offset < 0 && candidate.offset < record.offset);
  queue.splice(at < 0 ? queue.length : at, 0, record);
  composer.hidden = true;
  composerForm.reset();
  composerCount.textContent = '0 of ' + postLimit + ' characters';
  apply();
  refreshStats();
  showToast('Post scheduled to ' + account.handle + ' for ' + cellOf(record, 'Scheduled').lastElementChild.textContent);
}

composerBody.addEventListener('input', () => {
  composerCount.textContent = composerBody.value.length + ' of ' + postLimit + ' characters';
});
composerForm.addEventListener('submit', (event) => {
  event.preventDefault();
  void scheduleComposedPost();
});

for (const button of document.querySelectorAll('[data-action="new-post"]')) {
  button.addEventListener('click', () => { composer.hidden = false; composerBody.focus(); });
}
for (const button of document.querySelectorAll('[data-action="close-composer"]')) {
  button.addEventListener('click', () => { composer.hidden = true; });
}
for (const button of document.querySelectorAll('[data-action="save-draft"]')) {
  button.addEventListener('click', () => { composer.hidden = true; showToast('Saved to drafts. Nothing has been scheduled.'); });
}

tbody.addEventListener('click', (event) => {
  const button = event.target.closest('button[aria-haspopup="menu"]');
  if (!button) return;
  const record = queue.find((candidate) => candidate.row === button.closest('tr'));
  if (!record) return;
  openMenu(button, cellOf(record, 'Scheduled').firstElementChild.textContent, [
    { label: 'Edit post', run: () => showToast('Editing is available on the post page.') },
    { label: 'Duplicate', run: () => showToast('A copy has been saved to drafts.') },
    { label: 'Move to drafts', run: () => showToast('Moved to drafts.') },
    { label: 'Delete post', danger: true, run: () => showToast('Deleting needs an owner to confirm.') },
  ]);
});

document.addEventListener('click', (event) => {
  if (menuNode && !menuNode.contains(event.target) && event.target !== menuButton && !menuButton.contains(event.target)) closeMenu();
});
`;
