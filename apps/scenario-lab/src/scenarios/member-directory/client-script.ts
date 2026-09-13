import { directoryDialogsScript } from "./client-dialogs.js";
import { teamNames } from "./members.js";
import { ROLE_OPTIONS } from "./options.js";
import type { DirectoryClasses } from "./styles.js";

/** How long the search box waits before filtering, as a real console does rather than filtering on every keystroke. */
const SEARCH_DELAY_MS = 120;

/**
 * Everything the page does in the browser.
 *
 * Filtering is a real re-render: the rows that do not match are taken out of
 * the document rather than hidden, which is what a keyed list does and what
 * makes an extraction after a filter honest. The row elements themselves are
 * reused, so a member keeps its element across filters and sorts.
 *
 * The class names arrive as data. That is not a convenience -- it is the same
 * arrangement the real page has, where the bundle and the markup are emitted
 * from one build and share its hashes, and it is why the `restyled` rendering
 * needs no second copy of this script.
 */
export function directoryClientScript(css: DirectoryClasses): string {
  const roleNames = ROLE_OPTIONS.slice(1).map((option) => option.label);
  return `const css = ${JSON.stringify(css)};
const roleNames = ${JSON.stringify(roleNames)};
const teamNames = ${JSON.stringify(teamNames)};
const workspaceName = "Halden Robotics";
const crossGlyph = '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>';
const searchDelayMs = ${SEARCH_DELAY_MS};
${DIRECTORY_CORE}
${directoryDialogsScript()}`;
}

/**
 * The table itself: filters, selection, sorting, and the counts that follow
 * from them. It reads a row's role, team and status out of the row's own cells
 * rather than from a parallel data structure, so what the page filters on is
 * always what the page shows.
 */
const DIRECTORY_CORE = String.raw`
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

const tbody = document.querySelector('[data-testid="member-rows"]');
const table = tbody.closest('table');
const card = table.closest('section');
const tableWrap = card.querySelector('.' + css.tableWrap);
const toolbar = card.querySelector('.' + css.toolbar);
const searchInput = document.querySelector('[data-testid="member-search"]');
const roleFilter = document.querySelector('[data-testid="role-filter"]');
const statusFilter = document.querySelector('[data-testid="status-filter"]');
const resultCount = document.querySelector('[data-testid="result-count"]');
const sortStatus = document.querySelector('[data-testid="sort-status"]');
const stats = document.querySelector('[data-testid="member-stats"]');
const toastRegion = document.querySelector('[data-testid="toast-region"]');
const selectAll = table.tHead.querySelector('input[type="checkbox"]');

let roster = Array.from(tbody.rows).map((row) => ({
  row,
  id: row.dataset.memberId,
  name: row.querySelector('.' + css.personName).textContent,
  email: row.querySelector('.' + css.personEmail).textContent,
}));
const byRow = new Map(roster.map((record) => [record.row, record]));
const selected = new Set();
let search = '';
let sortColumn = table.tHead.querySelector('th[aria-sort] [data-sort]')?.dataset.sort ?? 'name';
let searchTimer = 0;
let chipRow = null;
let bulkBar = null;

function recordFor(row) { return byRow.get(row); }
function roleOf(record) { return record.row.cells[2].textContent; }
function teamOf(record) { return record.row.cells[3].textContent; }
function statusOf(record) { return record.row.cells[4].textContent; }
function minutesOf(record) { return Number(record.row.cells[5].dataset.minutes); }
function labelOf(select) { return select.value ? select.selectedOptions[0].textContent : ''; }
function compareNames(left, right) { return left.name < right.name ? -1 : left.name > right.name ? 1 : 0; }

function visibleRecords() {
  const needle = search.trim().toLowerCase();
  const role = labelOf(roleFilter);
  const status = labelOf(statusFilter);
  return roster.filter((record) =>
    (needle === '' || record.name.toLowerCase().includes(needle) || record.email.includes(needle))
    && (role === '' || roleOf(record) === role)
    && (status === '' || statusOf(record) === status));
}

function emptyRow() {
  const row = el('tr', '');
  row.append(el('td', css.empty, { colspan: '7' }, 'No members match these filters.'));
  return row;
}

function apply() {
  const shown = visibleRecords();
  tbody.replaceChildren(...(shown.length > 0 ? shown.map((record) => record.row) : [emptyRow()]));
  resultCount.textContent = 'Showing ' + shown.length + ' of ' + roster.length + ' members';
  renderChips();
  renderBulk();
}

function refreshStats() {
  const admins = roster.filter((record) => roleOf(record) === 'Admin').length;
  const pending = roster.filter((record) => statusOf(record) === 'Invited').length;
  stats.textContent = roster.length + ' members · ' + admins + ' admins · ' + pending + ' pending';
}

function renderChips() {
  if (chipRow) { chipRow.remove(); chipRow = null; }
  const chips = [];
  if (search.trim() !== '') chips.push('Search: ' + search.trim());
  if (labelOf(roleFilter) !== '') chips.push('Role: ' + labelOf(roleFilter));
  if (labelOf(statusFilter) !== '') chips.push('Status: ' + labelOf(statusFilter));
  if (chips.length === 0) return;
  chipRow = el('div', css.chipRow, { 'data-testid': 'filter-summary' });
  for (const chip of chips) chipRow.append(el('span', css.chip, {}, chip));
  const clear = el('button', css.button, { type: 'button' }, 'Clear filters');
  clear.addEventListener('click', () => {
    searchInput.value = '';
    search = '';
    roleFilter.value = '';
    statusFilter.value = '';
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
  const remove = el('button', css.button + ' ' + css.buttonDanger, { type: 'button' }, 'Remove');
  remove.addEventListener('click', () => openRemoveDialog([...selected]));
  actions.append(exportCsv, remove);
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
roleFilter.addEventListener('change', apply);
statusFilter.addEventListener('change', apply);

table.addEventListener('change', (event) => {
  const box = event.target;
  if (!(box instanceof HTMLInputElement) || box.type !== 'checkbox') return;
  if (box === selectAll) {
    for (const record of visibleRecords()) setSelected(record, box.checked);
  } else {
    const record = recordFor(box.closest('tr'));
    if (record) setSelected(record, box.checked);
  }
  renderBulk();
});

table.tHead.addEventListener('click', (event) => {
  const button = event.target.closest('[data-sort]');
  if (!button) return;
  sortColumn = button.dataset.sort;
  roster.sort((left, right) => sortColumn === 'activity'
    ? (minutesOf(left) - minutesOf(right)) || compareNames(left, right)
    : compareNames(left, right));
  for (const cell of table.tHead.rows[0].cells) cell.removeAttribute('aria-sort');
  button.closest('th').setAttribute('aria-sort', 'ascending');
  sortStatus.textContent = sortColumn === 'activity' ? 'Sorted by Last active' : 'Sorted by Name';
  apply();
});

toolbar.addEventListener('click', (event) => {
  const action = event.target.closest('[data-action]');
  if (!action) return;
  if (action.dataset.action === 'save-view') showToast('View saved for this workspace');
  if (action.dataset.action === 'table-settings') showToast('Column settings are coming soon');
});

for (const button of document.querySelectorAll('[data-action="invite"]')) {
  button.addEventListener('click', () => showToast('Invitations are managed by your identity provider'));
}
`;
