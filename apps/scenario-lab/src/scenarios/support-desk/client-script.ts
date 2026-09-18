import { SUPPORT_DESK_ROOT } from "./format.js";
import { emptyQueueRowMarkup } from "./queue-table.js";
import { supportAgents } from "./tickets.js";
import { DESK_GLYPHS, deskIcon, type DeskClasses } from "./styles.js";
import { slug } from "./views.js";
import { UNASSIGNED } from "./types.js";

/** How long the search box waits before filtering, as a real desk does rather than filtering on every keystroke. */
const SEARCH_DELAY_MS = 120;

/**
 * Everything the queue does in the browser.
 *
 * Filtering is a real re-render: rows that do not match are taken out of the
 * document rather than hidden, which is what a keyed list does and what makes
 * an extraction after a filter honest. The row elements themselves are reused,
 * so a ticket keeps its element across views, filters and sorts.
 *
 * Two pieces of markup are handed in rather than written here, so that the page
 * and this script cannot spell the same thing differently: the class names and
 * the empty-queue row.
 *
 * The triage shortcut is wired by its position in the header's action group
 * rather than by a hook of its own, which is how a real bundle finds it: the
 * script and the markup come out of one build. That is also what lets the
 * `relabelled-triage` rendering drop every identifier from the control without
 * the page ceasing to work.
 */
export function deskClientScript(css: DeskClasses): string {
  const agentOptions = supportAgents.map((agent) => `<option value="${slug(agent)}">${agent}</option>`).join("");
  return `const css = ${JSON.stringify(css)};
const agentOptions = ${JSON.stringify(agentOptions)};
const emptyRowHtml = ${JSON.stringify(emptyQueueRowMarkup(css))};
const crossGlyph = ${JSON.stringify(deskIcon("", DESK_GLYPHS.cross))};
const ticketPath = ${JSON.stringify(`${SUPPORT_DESK_ROOT}tickets/`)};
const unassignedLabel = ${JSON.stringify(UNASSIGNED)};
const signedInAs = "Avery Rowe";
const searchDelayMs = ${SEARCH_DELAY_MS};
${QUEUE_CORE}
${OVERLAYS}`;
}

/**
 * The queue itself: views, filters, selection, sorting, and the counts that
 * follow from them. It reads a row's priority, status and assignee out of the
 * row's own cells rather than from a parallel data structure, so what the page
 * filters on is always what the page shows.
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

/**
 * The first element of a markup fragment.
 *
 * Parsed inside a template, not a div. A table row set as a div's innerHTML is
 * dropped outright by the HTML parser -- there is no table for it to sit in --
 * so the empty-queue row came back as nothing at all. A template's contents are
 * parsed in the one insertion mode that keeps table fragments whole.
 */
function fromHtml(html) {
  const template = document.createElement('template');
  template.innerHTML = html;
  return template.content.firstElementChild;
}

const tbody = document.querySelector('[data-testid="ticket-rows"]');
const table = tbody.closest('table');
const card = table.closest('section');
const tableWrap = card.querySelector('.' + css.tableWrap);
const toolbar = card.querySelector('.' + css.toolbar);
const savedView = document.querySelector('[data-testid="saved-view"]');
const searchInput = document.querySelector('[data-testid="ticket-search"]');
const priorityFilter = document.querySelector('[data-testid="priority-filter"]');
const statusFilter = document.querySelector('[data-testid="status-filter"]');
const assigneeFilter = document.querySelector('[data-testid="assignee-filter"]');
const resultCount = document.querySelector('[data-testid="result-count"]');
const queueSummary = document.querySelector('[data-testid="queue-summary"]');
const triageSummary = document.querySelector('[data-testid="triage-summary"]');
const workload = document.querySelector('[data-testid="workload"]');
const toastRegion = document.querySelector('[data-testid="toast-region"]');
const selectAll = table.tHead.querySelector('input[type="checkbox"]');

const roster = Array.from(tbody.rows).map((row) => ({
  row,
  reference: row.dataset.ticketRef,
  requester: row.cells[2].firstElementChild.textContent,
  email: row.cells[2].lastElementChild.textContent,
  subject: row.cells[3].firstElementChild.getAttribute('title'),
}));
const byRow = new Map(roster.map((record) => [record.row, record]));
const agentNames = Array.from(fromHtml('<select>' + agentOptions + '</select>').options).map((option) => option.textContent);
const selected = new Set();
let search = '';
let sortColumn = 'age';
let searchTimer = 0;
let chipRow = null;
let bulkBar = null;

function recordFor(row) { return byRow.get(row); }
function priorityOf(record) { return record.row.cells[4].textContent; }
function statusOf(record) { return record.row.cells[5].textContent; }
function assigneeOf(record) { return record.row.cells[6].textContent; }
function minutesOf(record) { return Number(record.row.cells[7].dataset.minutes); }
function slaOf(record) { return record.row.cells[8].textContent; }
function breaching(record) { return statusOf(record) !== 'Resolved' && slaOf(record).startsWith('Breached'); }
function labelOf(select) { return select.value ? select.selectedOptions[0].textContent : ''; }

function inView(record, view) {
  if (view === 'unassigned-priority') return assigneeOf(record) === unassignedLabel && statusOf(record) !== 'Resolved' && (priorityOf(record) === 'Urgent' || priorityOf(record) === 'High');
  if (view === 'breaching') return breaching(record);
  if (view === 'waiting-on-us') return statusOf(record) === 'New' || statusOf(record) === 'Open';
  if (view === 'resolved') return statusOf(record) === 'Resolved';
  return true;
}

function visibleRecords() {
  const needle = search.trim().toLowerCase();
  const priority = labelOf(priorityFilter);
  const status = labelOf(statusFilter);
  const assignee = labelOf(assigneeFilter);
  return roster.filter((record) =>
    inView(record, savedView.value)
    && (needle === '' || [record.reference, record.requester, record.email, record.subject].some((field) => field.toLowerCase().includes(needle)))
    && (priority === '' || priorityOf(record) === priority)
    && (status === '' || statusOf(record) === status)
    && (assignee === '' || assigneeOf(record) === assignee));
}

function apply() {
  const shown = visibleRecords();
  tbody.replaceChildren(...(shown.length > 0 ? shown.map((record) => record.row) : [fromHtml(emptyRowHtml)]));
  resultCount.textContent = 'Showing ' + shown.length + ' of ' + roster.length + ' tickets';
  renderChips();
  renderBulk();
}

function refreshCounts() {
  const open = roster.filter((record) => statusOf(record) !== 'Resolved');
  const unassigned = roster.filter((record) => assigneeOf(record) === unassignedLabel).length;
  const awaiting = roster.filter((record) => inView(record, 'unassigned-priority')).length;
  queueSummary.textContent = roster.length + ' tickets · ' + roster.filter(breaching).length + ' breaching · ' + unassigned + ' unassigned';
  triageSummary.textContent = awaiting === 1
    ? '1 unassigned ticket is urgent or high priority'
    : awaiting + ' unassigned tickets are urgent or high priority';
  workload.textContent = agentNames
    .map((agent) => agent + ' ' + open.filter((record) => assigneeOf(record) === agent).length)
    .join(' · ');
}

function setAssignee(record, agent) {
  record.row.cells[6].textContent = agent;
}

function setStatus(record, status) {
  record.row.cells[5].firstElementChild.textContent = status;
  if (status !== 'Resolved') return;
  const sla = record.row.cells[8].firstElementChild;
  sla.textContent = 'Met';
  sla.className = css.slaDue;
}

function renderChips() {
  if (chipRow) { chipRow.remove(); chipRow = null; }
  const chips = [];
  if (savedView.value !== 'all') chips.push('View: ' + labelOf(savedView));
  if (search.trim() !== '') chips.push('Search: ' + search.trim());
  if (labelOf(priorityFilter) !== '') chips.push('Priority: ' + labelOf(priorityFilter));
  if (labelOf(statusFilter) !== '') chips.push('Status: ' + labelOf(statusFilter));
  if (labelOf(assigneeFilter) !== '') chips.push('Assignee: ' + labelOf(assigneeFilter));
  if (chips.length === 0) return;
  chipRow = el('div', css.chipRow, { 'data-testid': 'filter-summary' });
  for (const chip of chips) chipRow.append(el('span', css.chip, {}, chip));
  const clear = el('button', css.button, { type: 'button' }, 'Clear filters');
  clear.addEventListener('click', () => {
    savedView.value = 'all';
    searchInput.value = '';
    search = '';
    priorityFilter.value = '';
    statusFilter.value = '';
    assigneeFilter.value = '';
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
  const assign = el('button', css.button + ' ' + css.buttonPrimary, { type: 'button' }, 'Assign');
  assign.addEventListener('click', () => openAssignDialog([...selected]));
  const exportCsv = el('button', css.button, { type: 'button' }, 'Export CSV');
  exportCsv.addEventListener('click', () => showToast('Export queued. You will get an email when it is ready.'));
  actions.append(assign, exportCsv);
  bulkBar.append(actions);
  tableWrap.before(bulkBar);
  selectAll.checked = shown.length > 0 && shown.every((record) => selected.has(record.reference));
  selectAll.indeterminate = !selectAll.checked;
}

function setSelected(record, on) {
  if (on) selected.add(record.reference); else selected.delete(record.reference);
  record.row.classList.toggle(css.rowSelected, on);
  record.row.cells[0].firstElementChild.checked = on;
}

savedView.addEventListener('change', apply);
priorityFilter.addEventListener('change', apply);
statusFilter.addEventListener('change', apply);
assigneeFilter.addEventListener('change', apply);
searchInput.addEventListener('input', () => {
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(() => { search = searchInput.value; apply(); }, searchDelayMs);
});

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
  roster.sort((left, right) => sortColumn === 'sla'
    ? slaRank(left) - slaRank(right)
    : minutesOf(right) - minutesOf(left));
  for (const cell of table.tHead.rows[0].cells) cell.removeAttribute('aria-sort');
  button.closest('th').setAttribute('aria-sort', 'ascending');
  apply();
});

/** Worst first: how long a ticket has been past its target, with anything not past it behind. */
function slaRank(record) {
  const text = slaOf(record);
  if (!text.startsWith('Breached')) return Number.MAX_SAFE_INTEGER;
  const match = /Breached (?:(\d+)d )?(?:(\d+)h )?(?:(\d+)m )?ago/.exec(text);
  if (!match) return Number.MAX_SAFE_INTEGER;
  return -(Number(match[1] || 0) * 1440 + Number(match[2] || 0) * 60 + Number(match[3] || 0));
}

toolbar.addEventListener('click', (event) => {
  const action = event.target.closest('[data-action]');
  if (!action) return;
  if (action.dataset.action === 'save-view') showToast('View saved for this desk');
  if (action.dataset.action === 'table-settings') showToast('Column settings are coming soon');
});

for (const button of document.querySelectorAll('[data-action="new-ticket"], [data-action="import"]')) {
  button.addEventListener('click', () => showToast('That is handled in the admin console'));
}

// The triage shortcut is the first control in the header's action group. The
// bundle knows the build's class names, so it needs no hook on the control
// itself, which is what lets that control be redesigned without the page
// breaking -- and what makes the redesign a genuine drift rather than a
// fixture switch.
const triageShortcut = document.querySelector('.' + css.pageActions + ' button');
triageShortcut.addEventListener('click', () => {
  savedView.value = 'unassigned-priority';
  apply();
});
`;

/**
 * The overlays: the row action menu, the assignment dialog, the resolve
 * confirmation, the toast, and the detail pane.
 *
 * All of them are portalled to the end of `<body>`, which is where every design
 * system puts them and which has one consequence worth stating: the menu that
 * belongs to a row is not inside that row, so nothing in the menu's ancestry
 * says which of the 320 identical action buttons opened it. Only one menu is
 * ever open, which is what makes its items findable at all.
 *
 * The pane is fetched from the desk rather than built here, so the requester's
 * account and the conversation are not sitting in the queue's markup.
 */
const OVERLAYS = String.raw`
let menuNode = null;
let menuButton = null;
let scrimNode = null;
let paneNode = null;
let paneRecord = null;

function closeMenu() {
  if (menuNode) menuNode.remove();
  if (menuButton) menuButton.setAttribute('aria-expanded', 'false');
  menuNode = null;
  menuButton = null;
}

function openMenu(button, title, label, items) {
  closeMenu();
  const rect = button.getBoundingClientRect();
  const node = el('div', css.menu, { role: 'menu', 'aria-label': label });
  node.style.top = (rect.bottom + window.scrollY + 4) + 'px';
  node.style.left = Math.max(8, rect.right + window.scrollX - 212) + 'px';
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

/**
 * Empties the toast region before an action that will raise a new one. Without
 * it a run waiting for "the toast" after a second action is handed the first
 * action's toast and reads the page before the second has finished.
 */
function clearToast() {
  toastRegion.replaceChildren();
}

function showToast(message) {
  const node = el('div', css.toast);
  node.innerHTML = '<p class="' + css.toastText + '" data-testid="toast" role="status">' + esc(message) + '</p>'
    + '<button class="' + css.iconButton + '" type="button" aria-label="Dismiss">' + crossGlyph + '</button>';
  node.querySelector('button').addEventListener('click', () => node.remove());
  toastRegion.replaceChildren(node);
}

function openAssignDialog(references) {
  const heading = references.length === 1 ? 'Assign ' + references[0] : 'Assign ' + references.length + ' tickets';
  const scrim = openOverlay(
    '<div class="' + css.dialog + '" role="dialog" aria-modal="true" aria-labelledby="assign-heading" data-testid="assign-dialog">'
    + '<div class="' + css.dialogHead + '"><h2 id="assign-heading">' + esc(heading) + '</h2></div>'
    + '<form><div class="' + css.dialogBody + '">'
    + '<p><label class="' + css.fieldLabel + '" for="assign-agent">Agent</label><br>'
    + '<select class="' + css.select + '" id="assign-agent" data-testid="assign-agent" name="agent">' + agentOptions + '</select></p>'
    + '<p class="' + css.hint + '">The agent picks the tickets up in their own inbox straight away.</p>'
    + '</div>'
    + '<div class="' + css.dialogFoot + '"><button class="' + css.button + '" type="button" data-action="cancel">Cancel</button>'
    + '<button class="' + css.button + ' ' + css.buttonPrimary + '" type="submit" data-testid="assign-confirm">Assign tickets</button>'
    + '</div></form></div>');
  const form = scrim.querySelector('form');
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    clearToast();
    void assignTickets(references, form.elements.agent.selectedOptions[0].textContent);
  });
}

async function assignTickets(references, agent) {
  await mutate('assign-tickets', { references, agent });
  const assigned = new Set(references);
  for (const record of roster) {
    if (!assigned.has(record.reference)) continue;
    setAssignee(record, agent);
    setSelected(record, false);
  }
  closeOverlay();
  refreshCounts();
  apply();
  if (paneRecord && assigned.has(paneRecord.reference)) await openTicket(paneRecord);
  showToast(references.length + (references.length === 1 ? ' ticket assigned to ' : ' tickets assigned to ') + agent);
}

function openResolveDialog(record) {
  const scrim = openOverlay(
    '<div class="' + css.dialog + '" role="alertdialog" aria-modal="true" aria-labelledby="resolve-heading" data-testid="confirm-dialog">'
    + '<div class="' + css.dialogHead + '"><h2 id="resolve-heading">Resolve ' + esc(record.reference) + '?</h2></div>'
    + '<div class="' + css.dialogBody + '"><p>' + esc(record.requester) + ' stops receiving updates and the response clock stops. Replying to the ticket reopens it.</p></div>'
    + '<form><div class="' + css.dialogFoot + '"><button class="' + css.button + '" type="button" data-action="cancel">Cancel</button>'
    + '<button class="' + css.button + ' ' + css.buttonDanger + '" type="submit">Resolve this ticket</button></div></form></div>');
  scrim.querySelector('form').addEventListener('submit', (event) => {
    event.preventDefault();
    clearToast();
    void resolveTicket(record);
  });
}

async function resolveTicket(record) {
  await mutate('resolve-ticket', { reference: record.reference });
  setStatus(record, 'Resolved');
  closeOverlay();
  refreshCounts();
  apply();
  if (paneRecord && paneRecord.reference === record.reference) await openTicket(record);
  showToast(record.reference + ' resolved');
}

function closePane() {
  if (paneNode) paneNode.remove();
  paneNode = null;
  paneRecord = null;
}

async function openTicket(record) {
  const response = await fetch(ticketPath + record.reference);
  if (!response.ok) throw new Error('Ticket fetch failed: ' + response.status);
  const pane = fromHtml(await response.text());
  closePane();
  document.body.append(pane);
  paneNode = pane;
  paneRecord = record;
  wirePane(pane, record);
}

function wirePane(pane, record) {
  pane.querySelector('[aria-label="Close ticket"]').addEventListener('click', closePane);
  const template = pane.querySelector('[data-testid="reply-template"]');
  const body = pane.querySelector('[data-testid="reply-body"]');
  const send = pane.querySelector('[data-testid="send-reply"]');
  const syncSend = () => { send.disabled = body.value.trim() === ''; };
  body.addEventListener('input', syncSend);
  pane.querySelector('[data-testid="insert-template"]').addEventListener('click', () => {
    const chosen = template.selectedOptions[0];
    body.value = chosen && chosen.value ? chosen.dataset.body || '' : '';
    syncSend();
  });
  send.addEventListener('click', () => { clearToast(); void sendReply(record, template.value, body); });
  pane.querySelector('[data-testid="reassign-ticket"]').addEventListener('click', () => openAssignDialog([record.reference]));
  pane.querySelector('[data-testid="tag-ticket"]').addEventListener('click', () => showToast('Tag added to ' + record.reference));
  pane.querySelector('[data-testid="resolve-ticket"]').addEventListener('click', () => openResolveDialog(record));
}

async function sendReply(record, template, body) {
  const text = body.value.trim();
  await mutate('reply-ticket', { reference: record.reference, template: template || 'free-text' });
  const thread = paneNode.querySelector('[data-testid="ticket-thread"]');
  const message = el('li', css.message);
  message.append(el('p', css.messageMeta, {}, signedInAs + ' · Just now'), el('p', css.messageBody, {}, text));
  thread.append(message);
  body.value = '';
  paneNode.querySelector('[data-testid="send-reply"]').disabled = true;
  showToast('Reply sent to ' + record.requester);
}

tbody.addEventListener('click', (event) => {
  const subject = event.target.closest('[aria-controls="ticket-detail"]');
  if (subject) {
    const record = recordFor(subject.closest('tr'));
    if (record) void openTicket(record);
    return;
  }
  const button = event.target.closest('button[aria-haspopup="menu"]');
  if (!button) return;
  const record = recordFor(button.closest('tr'));
  if (!record) return;
  openMenu(button, record.reference, 'Actions for ' + record.reference, [
    { label: 'Open ticket', run: () => { void openTicket(record); } },
    { label: 'Assign to…', run: () => openAssignDialog([record.reference]) },
    { label: 'Add tag', run: () => showToast('Tag added to ' + record.reference) },
    { label: 'Resolve', danger: true, run: () => openResolveDialog(record) },
  ]);
});

document.querySelector('[data-action="account"]').addEventListener('click', (event) => {
  openMenu(event.currentTarget, signedInAs, 'Account', [
    { label: 'Profile', run: () => showToast('Profile is managed by your identity provider') },
    { label: 'Availability', run: () => showToast('You are marked available') },
    { label: 'Sign out', run: () => showToast('Signing out') },
  ]);
});

document.addEventListener('click', (event) => {
  if (menuNode && !menuNode.contains(event.target) && event.target !== menuButton && !menuButton.contains(event.target)) closeMenu();
}, true);

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  if (menuNode) closeMenu();
  else if (scrimNode) closeOverlay();
  else closePane();
});

refreshCounts();
`;
