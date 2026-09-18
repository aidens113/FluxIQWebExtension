import { INBOX_TEAM } from "./conversations.js";
import { INBOX_ROOT } from "./format.js";
import { loadControlMarkup } from "./table.js";
import type { InboxClasses } from "./styles.js";

/** How long the search box waits before asking the server, as a real inbox does rather than refetching on every keystroke. */
const SEARCH_DELAY_MS = 140;
/**
 * Fixed latency before each page is fetched. The rows already on screen stay
 * there until the answer arrives, so a reader that does not wait after a
 * filter reads the previous filter's rows instead of racing a fast fetch.
 */
const LOAD_DELAY_MS = 150;

/**
 * Everything the page does in the browser.
 *
 * Filtering and paging are the server's: the toolbar asks the `items` route
 * for a page and the page puts back what it is given, which is what a real
 * inbox over 320 conversations does. Loading older conversations *appends*,
 * so a row already on screen keeps the element it had -- that is what lets a
 * paginated read take each conversation exactly once.
 *
 * Every count the page shows after a change comes from the fixture's own
 * snapshot rather than from counting the rows on screen, because only
 * twenty-five of them are on screen. The page and the server oracle therefore
 * cannot drift.
 *
 * The reply dialog itself is the server's: one dialog for the whole page,
 * shipped closed, which this script fills in and opens. Which rendering it is
 * therefore needs no flag here -- the markup already says so.
 *
 * The class names arrive as data, the same way the real page has them: the
 * bundle and the markup are emitted from one build and share its hashes, which
 * is why the `restyled` rendering needs no second copy of this script.
 */
export function inboxClientScript(css: InboxClasses): string {
  return `const css = ${JSON.stringify(css)};
const inboxRoot = ${JSON.stringify(INBOX_ROOT)};
const loadControlHtml = ${JSON.stringify(loadControlMarkup(css))};
const team = ${JSON.stringify(INBOX_TEAM)};
const searchDelayMs = ${SEARCH_DELAY_MS};
const loadDelayMs = ${LOAD_DELAY_MS};
${INBOX_CORE}
${INBOX_ACTIONS}`;
}

/** Filters, paging, chips, selection and the counts that follow from them. */
const INBOX_CORE = String.raw`
function el(tag, className, attributes = {}, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
  if (text !== undefined) node.textContent = text;
  return node;
}

const results = document.querySelector('[data-testid="inbox-results"]');
const tbody = document.querySelector('[data-testid="inbox-rows"]');
const table = tbody.closest('table');
const card = table.closest('section');
const toolbar = card.querySelector('.' + css.toolbar);
const tableWrap = card.querySelector('.' + css.tableWrap);
const statusLine = document.querySelector('[data-testid="inbox-status"]');
const moreHolder = document.querySelector('[data-testid="inbox-more"]');
const stats = document.querySelector('[data-testid="inbox-stats"]');
const toastRegion = document.querySelector('[data-testid="toast-region"]');
const searchInput = document.querySelector('[data-testid="inbox-search"]');
const accountFilter = document.querySelector('[data-testid="account-filter"]');
const kindFilter = document.querySelector('[data-testid="kind-filter"]');
const statusFilter = document.querySelector('[data-testid="status-filter"]');
const ageFilter = document.querySelector('[data-testid="age-filter"]');
const selectAll = table.tHead.querySelector('input[type="checkbox"]');

const headerIndex = {};
Array.from(table.tHead.rows[0].cells).forEach((cell, index) => { headerIndex[cell.textContent.trim()] = index; });

const selected = new Set();
let currentPage = 1;
let searchTimer = 0;
let latest = 0;
let chipRow = null;
let bulkBar = null;

function cellOf(row, column) { return row.cells[headerIndex[column]]; }
function labelOf(select) { return select.value ? select.selectedOptions[0].textContent : ''; }
function rowFor(id) { return tbody.querySelector('[data-conversation-id="' + id + '"]'); }

function filterParams() {
  const params = new URLSearchParams();
  if (searchInput.value.trim() !== '') params.set('q', searchInput.value.trim());
  if (accountFilter.value) params.set('account', accountFilter.value);
  if (kindFilter.value) params.set('kind', kindFilter.value);
  if (statusFilter.value) params.set('status', statusFilter.value);
  if (ageFilter.value) params.set('age', ageFilter.value);
  return params;
}

async function load(page, append) {
  const ticket = ++latest;
  results.setAttribute('aria-busy', 'true');
  await new Promise((resolve) => setTimeout(resolve, loadDelayMs));
  const params = filterParams();
  params.set('page', String(page));
  const response = await fetch(inboxRoot + 'items?' + params.toString());
  if (!response.ok) throw new Error('The inbox could not load page ' + page + ': ' + response.status);
  const html = await response.text();
  if (ticket !== latest) return;
  if (append) tbody.insertAdjacentHTML('beforeend', html);
  else { tbody.innerHTML = html; selected.clear(); }
  currentPage = page;
  statusLine.textContent = 'Showing ' + response.headers.get('x-inbox-shown') + ' of ' + response.headers.get('x-inbox-matched') + ' conversations';
  moreHolder.innerHTML = response.headers.get('x-inbox-more') === 'true' ? loadControlHtml : '';
  renderChips();
  renderBulk();
  results.setAttribute('aria-busy', 'false');
}

function renderChips() {
  if (chipRow) { chipRow.remove(); chipRow = null; }
  const chips = [];
  if (searchInput.value.trim() !== '') chips.push(['chip-search', 'Search: ' + searchInput.value.trim()]);
  if (labelOf(accountFilter) !== '') chips.push(['chip-account', 'Account: ' + labelOf(accountFilter)]);
  if (labelOf(kindFilter) !== '') chips.push(['chip-kind', 'Kind: ' + labelOf(kindFilter)]);
  if (labelOf(statusFilter) !== '') chips.push(['chip-status', 'Status: ' + labelOf(statusFilter)]);
  if (labelOf(ageFilter) !== '') chips.push(['chip-age', 'Age: ' + labelOf(ageFilter)]);
  if (chips.length === 0) return;
  chipRow = el('div', css.chipRow, { 'data-testid': 'filter-summary' });
  for (const [id, text] of chips) chipRow.append(el('span', css.chip, { 'data-testid': id }, text));
  const clear = el('button', css.button, { type: 'button' }, 'Clear filters');
  clear.addEventListener('click', () => {
    searchInput.value = '';
    for (const control of [accountFilter, kindFilter, statusFilter, ageFilter]) control.value = '';
    void load(1, false);
  });
  chipRow.append(clear);
  toolbar.after(chipRow);
}

function renderBulk() {
  if (bulkBar) { bulkBar.remove(); bulkBar = null; }
  const loaded = Array.from(tbody.querySelectorAll('[data-conversation-id]'));
  if (selected.size === 0) {
    selectAll.checked = false;
    selectAll.indeterminate = false;
    return;
  }
  bulkBar = el('div', css.bulkBar, { 'data-testid': 'bulk-toolbar' });
  bulkBar.append(el('p', css.bulkCount, {}, selected.size + ' selected'));
  const actions = el('div', css.pageActions);
  const handle = el('button', css.button, { type: 'button' }, 'Mark all handled');
  handle.addEventListener('click', () => { void markHandled([...selected]); });
  const assign = el('button', css.button, { type: 'button' }, 'Assign all');
  assign.addEventListener('click', (event) => openAssignMenu(event.currentTarget, [...selected]));
  actions.append(handle, assign);
  bulkBar.append(actions);
  tableWrap.before(bulkBar);
  selectAll.checked = loaded.length > 0 && loaded.every((row) => selected.has(row.dataset.conversationId));
  selectAll.indeterminate = !selectAll.checked;
}

function setSelected(row, on) {
  if (on) selected.add(row.dataset.conversationId); else selected.delete(row.dataset.conversationId);
  row.classList.toggle(css.rowSelected, on);
  row.cells[0].firstElementChild.checked = on;
}

searchInput.addEventListener('input', () => {
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(() => { void load(1, false); }, searchDelayMs);
});
for (const control of [accountFilter, kindFilter, statusFilter, ageFilter]) {
  control.addEventListener('change', () => { void load(1, false); });
}
moreHolder.addEventListener('click', (event) => {
  if (event.target.closest('[data-testid="load-older"]')) void load(currentPage + 1, true);
});

table.addEventListener('change', (event) => {
  const box = event.target;
  if (!(box instanceof HTMLInputElement) || box.type !== 'checkbox') return;
  if (box === selectAll) {
    for (const row of tbody.querySelectorAll('[data-conversation-id]')) setSelected(row, box.checked);
  } else {
    const row = box.closest('tr');
    if (row && row.dataset.conversationId) setSelected(row, box.checked);
  }
  renderBulk();
});

toolbar.addEventListener('click', (event) => {
  if (event.target.closest('[data-action="views"]')) showToast('Saved views are managed by a workspace owner.');
});
for (const button of document.querySelectorAll('[data-action="refresh"]')) {
  button.addEventListener('click', () => { void load(1, false); });
}
`;

/**
 * The reply dialog, the assignment menu, marking handled, and the toast.
 *
 * Each of them posts its change through the fixture's mutation endpoint before
 * touching the page, and then writes the counts straight out of the snapshot
 * that comes back, so the moment the toast is readable the server oracle
 * already agrees with it.
 *
 * `moved-send` changes one thing: Send is in the dialog's header rather than
 * its footer, without the test id the recording took, and Discard stands in
 * the footer where the recorded control was. Discard is a real control that
 * sends nothing, which is what makes the repair a choice rather than a guess.
 */
const INBOX_ACTIONS = String.raw`
let menuNode = null;
let menuButton = null;
let replyingTo = null;

const replyScrim = document.querySelector('[data-testid="reply-scrim"]');
const replyDialog = document.querySelector('[data-testid="reply-dialog"]');
const replyTo = document.querySelector('[data-testid="reply-to"]');
const replyQuote = document.querySelector('[data-testid="reply-quote"]');
const replyText = replyDialog.querySelector('textarea[name="reply"]');

function showToast(message) {
  const toast = el('div', css.toast, { 'data-testid': 'toast', role: 'status' });
  toast.append(el('span', '', {}, message));
  toastRegion.replaceChildren(toast);
}

function applyOracle(oracle) {
  stats.textContent = oracle.conversationCount + ' conversations · ' + oracle.unansweredCount + ' unanswered · ' + oracle.assignedCount + ' assigned';
}

function setRowStatus(id, status, assignee) {
  const row = rowFor(id);
  if (!row) return;
  const badge = cellOf(row, 'Status').firstElementChild;
  badge.className = css.badge + ' ' + (status === 'Handled' ? css.badgeHandled : status === 'Assigned' ? css.badgeAssigned : css.badgeUnanswered);
  badge.textContent = status;
  cellOf(row, 'Assigned').textContent = assignee === '' ? '—' : assignee;
  setSelected(row, false);
}

function closeReply() {
  replyScrim.hidden = true;
  replyingTo = null;
}

function closeMenu() {
  if (menuNode) menuNode.remove();
  if (menuButton) menuButton.setAttribute('aria-expanded', 'false');
  menuNode = null;
  menuButton = null;
}

function openReplyDialog(row) {
  replyingTo = { id: row.dataset.conversationId, person: cellOf(row, 'From').querySelector('.' + css.personName).textContent };
  replyTo.textContent = 'Reply to ' + replyingTo.person;
  replyQuote.textContent = cellOf(row, 'Message').firstElementChild.getAttribute('title');
  replyText.value = '';
  replyScrim.hidden = false;
  replyText.focus();
}

async function sendReply() {
  if (!replyingTo) return;
  const text = replyText.value.trim();
  if (text === '') { showToast('Write something before sending.'); return; }
  const { id, person } = replyingTo;
  closeReply();
  const snapshot = await mutate('reply', { id, text });
  applyOracle(snapshot.state.oracle);
  setRowStatus(id, 'Handled', '');
  renderBulk();
  showToast('Replied to ' + person + '. The conversation is now marked handled.');
}

replyDialog.querySelector('[data-action="cancel"]').addEventListener('click', closeReply);
replyDialog.querySelector('[data-action="send"]').addEventListener('click', () => { void sendReply(); });
const discardControl = replyDialog.querySelector('[data-action="discard"]');
if (discardControl) discardControl.addEventListener('click', () => { closeReply(); showToast('Draft discarded. Nothing was sent.'); });

async function markHandled(ids) {
  if (ids.length === 0) return;
  const snapshot = await mutate('mark-handled', { ids });
  applyOracle(snapshot.state.oracle);
  for (const id of ids) setRowStatus(id, 'Handled', '');
  selected.clear();
  renderBulk();
  showToast(ids.length === 1 ? 'Marked as handled' : ids.length + ' conversations marked as handled');
}

function openAssignMenu(button, ids) {
  closeMenu();
  const rect = button.getBoundingClientRect();
  const node = el('div', css.menu, { role: 'menu', 'aria-label': 'Assign to' });
  node.style.top = (rect.bottom + window.scrollY + 4) + 'px';
  node.style.left = Math.max(8, rect.left + window.scrollX) + 'px';
  node.append(el('p', css.menuHead, {}, 'Assign to'));
  for (const person of team) {
    const entry = el('button', css.menuItem, { type: 'button', role: 'menuitem' }, person);
    entry.addEventListener('click', async () => {
      closeMenu();
      const snapshot = await mutate('assign', { ids, to: person });
      applyOracle(snapshot.state.oracle);
      for (const id of ids) setRowStatus(id, 'Assigned', person);
      selected.clear();
      renderBulk();
      showToast(ids.length === 1 ? 'Assigned to ' + person : ids.length + ' conversations assigned to ' + person);
    });
    node.append(entry);
  }
  document.body.append(node);
  button.setAttribute('aria-expanded', 'true');
  menuNode = node;
  menuButton = button;
}

tbody.addEventListener('click', (event) => {
  const control = event.target.closest('[data-action]');
  const row = event.target.closest('[data-conversation-id]');
  if (!control || !row) return;
  if (control.dataset.action === 'reply') openReplyDialog(row);
  if (control.dataset.action === 'handle') void markHandled([row.dataset.conversationId]);
  if (control.dataset.action === 'assign') openAssignMenu(control, [row.dataset.conversationId]);
});

document.addEventListener('click', (event) => {
  if (menuNode && !menuNode.contains(event.target) && menuButton && !menuButton.contains(event.target)) closeMenu();
});
`;
