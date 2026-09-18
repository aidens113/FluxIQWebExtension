import { DISPATCH_RUN } from "./filters.js";
import { ORDER_OPERATIONS_ROOT } from "./format.js";
import { emptyOrderRowMarkup } from "./order-table.js";
import { ORDER_GLYPHS, orderIcon, type OrderClasses } from "./styles.js";

/** How long the search box waits before filtering, as a real back office does rather than filtering on every keystroke. */
const SEARCH_DELAY_MS = 120;

/** Where the dispatch note and one order's summary panel are fetched from after a change. */
const DISPATCH_NOTE_PATH = `${ORDER_OPERATIONS_ROOT}dispatch-note`;

/**
 * The order book's browser half.
 *
 * Filtering is a real re-render: rows that do not match are taken out of the
 * document rather than hidden, which is what a keyed list does and what makes
 * an extraction after a filter honest. The row elements themselves are reused,
 * so an order keeps its element across filters.
 *
 * The dispatch-run shortcut is wired by its position in the header's action
 * group rather than by a hook of its own, which is how a real bundle finds it:
 * the script and the markup come out of one build. That is also what lets the
 * `relabelled-dispatch` rendering drop every identifier from the control
 * without the page ceasing to work.
 */
export function orderBookScript(css: OrderClasses): string {
  return `${preamble(css)}
const dispatchRun = ${JSON.stringify(DISPATCH_RUN)};
const dispatchNotePath = ${JSON.stringify(DISPATCH_NOTE_PATH)};
const emptyRowHtml = ${JSON.stringify(emptyOrderRowMarkup(css))};
const searchDelayMs = ${SEARCH_DELAY_MS};
${SHARED}
${BOOK_CORE}`;
}

/**
 * One order page's browser half: the refund control, the dispatch and cancel
 * actions, and their confirmations.
 *
 * After any of them the summary panel is fetched back from the desk rather
 * than rewritten here, so the page and the server can never write the same
 * state differently. The two header buttons are the one thing this script
 * decides for itself, from the text the served panel carries.
 */
export function orderDetailScript(css: OrderClasses, reference: string): string {
  return `${preamble(css)}
const reference = ${JSON.stringify(reference)};
const summaryPath = ${JSON.stringify(`${ORDER_OPERATIONS_ROOT}orders/`)} + reference + '/summary';
${SHARED}
${DETAIL_CORE}`;
}

function preamble(css: OrderClasses): string {
  return `const css = ${JSON.stringify(css)};
const crossGlyph = ${JSON.stringify(orderIcon("", ORDER_GLYPHS.cross))};`;
}

/** Helpers and overlays both screens need: escaping, element building, the toast, the scrim and the row menu. */
const SHARED = String.raw`
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

function fromHtml(html) {
  const holder = document.createElement('div');
  holder.innerHTML = html;
  return holder.firstElementChild;
}

const toastRegion = document.querySelector('[data-testid="toast-region"]');
let scrimNode = null;
let menuNode = null;
let menuButton = null;

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

/** A confirmation with one destructive answer. The run callback fires only when that answer is pressed. */
function confirmAction(heading, body, confirmLabel, run) {
  const scrim = openOverlay(
    '<div class="' + css.dialog + '" role="alertdialog" aria-modal="true" aria-labelledby="confirm-heading" data-testid="confirm-dialog">'
    + '<div class="' + css.dialogHead + '"><h2 id="confirm-heading">' + esc(heading) + '</h2></div>'
    + '<div class="' + css.dialogBody + '"><p>' + esc(body) + '</p></div>'
    + '<form><div class="' + css.dialogFoot + '"><button class="' + css.button + '" type="button" data-action="cancel">Cancel</button>'
    + '<button class="' + css.button + ' ' + css.buttonDanger + '" type="submit">' + esc(confirmLabel) + '</button></div></form></div>');
  scrim.querySelector('form').addEventListener('submit', (event) => {
    event.preventDefault();
    clearToast();
    void run();
  });
}

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

document.addEventListener('click', (event) => {
  if (menuNode && !menuNode.contains(event.target) && event.target !== menuButton && !menuButton.contains(event.target)) closeMenu();
}, true);

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  if (menuNode) closeMenu();
  else closeOverlay();
});

for (const button of document.querySelectorAll('[data-action="export"], [data-action="new-order"], [data-action="table-settings"]')) {
  button.addEventListener('click', () => showToast('That is handled in the admin console'));
}

const accountButton = document.querySelector('[data-action="account"]');
accountButton.addEventListener('click', (event) => {
  openMenu(event.currentTarget, 'Rowan Pike', 'Account', [
    { label: 'Profile', run: () => showToast('Profile is managed by your identity provider') },
    { label: 'Switch store', run: () => showToast('You have one store') },
    { label: 'Sign out', run: () => showToast('Signing out') },
  ]);
});
`;

/** The book: filters, the dispatch-run shortcut, selection, bulk dispatch and the note it leaves. */
const BOOK_CORE = String.raw`
const tbody = document.querySelector('[data-testid="order-rows"]');
const table = tbody.closest('table');
const card = table.closest('section');
const toolbar = card.querySelector('.' + css.toolbar);
const noteRegion = card.querySelector('[data-testid="dispatch-note-region"]');
const searchInput = document.querySelector('[data-testid="order-search"]');
const paymentFilter = document.querySelector('[data-testid="payment-filter"]');
const fulfilmentFilter = document.querySelector('[data-testid="fulfilment-filter"]');
const placedFrom = document.querySelector('[data-testid="placed-from"]');
const placedTo = document.querySelector('[data-testid="placed-to"]');
const resultCount = document.querySelector('[data-testid="result-count"]');
const bookSummary = document.querySelector('[data-testid="book-summary"]');
const selectAll = table.tHead.querySelector('input[type="checkbox"]');

const book = Array.from(tbody.rows).map((row) => ({
  row,
  reference: row.dataset.orderRef,
  placed: row.dataset.placed,
  customer: row.cells[2].textContent,
}));
const byRow = new Map(book.map((record) => [record.row, record]));
const selected = new Set();
let search = '';
let searchTimer = 0;
let chipRow = null;
let bulkBar = null;

function recordFor(row) { return byRow.get(row); }
function paymentOf(record) { return record.row.cells[5].textContent; }
function fulfilmentOf(record) { return record.row.cells[6].textContent; }
function labelOf(select) { return select.value ? select.selectedOptions[0].textContent : ''; }
function isoDay(value) { return /^\d{4}-\d{2}-\d{2}$/.test(value.trim()) ? value.trim() : ''; }

function visibleRecords() {
  const needle = search.trim().toLowerCase();
  const payment = labelOf(paymentFilter);
  const fulfilment = labelOf(fulfilmentFilter);
  const from = isoDay(placedFrom.value);
  const to = isoDay(placedTo.value);
  return book.filter((record) =>
    (needle === '' || record.reference.toLowerCase().includes(needle) || record.customer.toLowerCase().includes(needle))
    && (payment === '' || paymentOf(record) === payment)
    && (fulfilment === '' || fulfilmentOf(record) === fulfilment)
    && (from === '' || record.placed >= from)
    && (to === '' || record.placed <= to));
}

function apply() {
  const shown = visibleRecords();
  tbody.replaceChildren(...(shown.length > 0 ? shown.map((record) => record.row) : [fromHtml(emptyRowHtml)]));
  resultCount.textContent = 'Showing ' + shown.length + ' of ' + book.length + ' orders';
  renderChips();
  renderBulk();
}

function refreshSummary() {
  const awaiting = book.filter((record) => fulfilmentOf(record) === 'Unfulfilled').length;
  const refunded = book.filter((record) => paymentOf(record) === 'Part refunded' || paymentOf(record) === 'Refunded').length;
  bookSummary.textContent = book.length + ' orders · ' + awaiting + ' awaiting dispatch · ' + refunded + ' refunded';
}

function renderChips() {
  if (chipRow) { chipRow.remove(); chipRow = null; }
  const chips = [];
  if (search.trim() !== '') chips.push('Search: ' + search.trim());
  if (labelOf(paymentFilter) !== '') chips.push('Payment: ' + labelOf(paymentFilter));
  if (labelOf(fulfilmentFilter) !== '') chips.push('Fulfilment: ' + labelOf(fulfilmentFilter));
  if (isoDay(placedFrom.value) !== '') chips.push('From: ' + isoDay(placedFrom.value));
  if (isoDay(placedTo.value) !== '') chips.push('To: ' + isoDay(placedTo.value));
  if (chips.length === 0) return;
  chipRow = el('div', css.chipRow, { 'data-testid': 'filter-summary' });
  for (const chip of chips) chipRow.append(el('span', css.chip, {}, chip));
  const clear = el('button', css.button, { type: 'button' }, 'Clear filters');
  clear.addEventListener('click', () => {
    searchInput.value = '';
    search = '';
    paymentFilter.value = '';
    fulfilmentFilter.value = '';
    placedFrom.value = '';
    placedTo.value = '';
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
  const dispatch = el('button', css.button + ' ' + css.buttonPrimary, { type: 'button' }, 'Mark dispatched');
  dispatch.addEventListener('click', () => openDispatchConfirmation([...selected]));
  const exportCsv = el('button', css.button, { type: 'button' }, 'Export CSV');
  exportCsv.addEventListener('click', () => showToast('Export queued. You will get an email when it is ready.'));
  actions.append(dispatch, exportCsv);
  bulkBar.append(actions);
  noteRegion.before(bulkBar);
  selectAll.checked = shown.length > 0 && shown.every((record) => selected.has(record.reference));
  selectAll.indeterminate = !selectAll.checked;
}

function setSelected(record, on) {
  if (on) selected.add(record.reference); else selected.delete(record.reference);
  record.row.classList.toggle(css.rowSelected, on);
  record.row.cells[0].firstElementChild.checked = on;
}

function openDispatchConfirmation(references) {
  const heading = references.length === 1 ? 'Dispatch ' + references[0] + '?' : 'Dispatch ' + references.length + ' orders?';
  confirmAction(heading, 'The carrier is told straight away and the customer gets a dispatch mail. This cannot be undone from here.', 'Mark as dispatched', () => dispatchOrders(references));
}

async function dispatchOrders(references) {
  await mutate('dispatch-orders', { references });
  const sent = new Set(references);
  for (const record of book) {
    if (!sent.has(record.reference)) continue;
    record.row.cells[6].firstElementChild.textContent = 'Dispatched';
    record.row.cells[6].firstElementChild.className = css.badge + ' ' + css.badgeSent;
    setSelected(record, false);
  }
  closeOverlay();
  refreshSummary();
  apply();
  const response = await fetch(dispatchNotePath);
  if (!response.ok) throw new Error('Dispatch note failed: ' + response.status);
  noteRegion.innerHTML = await response.text();
  showToast(references.length + (references.length === 1 ? ' order dispatched' : ' orders dispatched'));
}

searchInput.addEventListener('input', () => {
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(() => { search = searchInput.value; apply(); }, searchDelayMs);
});
paymentFilter.addEventListener('change', apply);
fulfilmentFilter.addEventListener('change', apply);
placedFrom.addEventListener('input', apply);
placedTo.addEventListener('input', apply);

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

tbody.addEventListener('click', (event) => {
  const button = event.target.closest('button[aria-haspopup="menu"]');
  if (!button) return;
  const record = recordFor(button.closest('tr'));
  if (!record) return;
  openMenu(button, record.reference, 'Actions for ' + record.reference, [
    { label: 'Open order', run: () => { window.location.assign(record.row.cells[1].firstElementChild.getAttribute('href')); } },
    { label: 'Copy reference', run: () => showToast('Reference copied to the clipboard') },
    { label: 'Mark dispatched', danger: true, run: () => openDispatchConfirmation([record.reference]) },
  ]);
});

// The dispatch-run shortcut is the first control in the header's action group.
// The bundle knows the build's class names, so it needs no hook on the control
// itself, which is what lets that control be redesigned without the page
// breaking -- and what makes the redesign a genuine drift rather than a
// fixture switch.
const dispatchShortcut = document.querySelector('.' + css.pageActions + ' button');
dispatchShortcut.addEventListener('click', () => {
  paymentFilter.value = dispatchRun.payment;
  fulfilmentFilter.value = dispatchRun.fulfilment;
  placedFrom.value = dispatchRun.placedFrom;
  placedTo.value = dispatchRun.placedTo;
  apply();
});
`;

/** One order's page: the refund control and the two header actions, each behind a confirmation. */
const DETAIL_CORE = String.raw`
const detail = document.querySelector('[data-testid="order-detail"]');
const markDispatched = document.querySelector('[data-testid="mark-dispatched"]');
const cancelOrder = document.querySelector('[data-testid="cancel-order"]');

function summaryField(field) {
  const cell = detail.querySelector('[data-field="' + field + '"]');
  return cell ? cell.textContent : '';
}

function amountPence() {
  const typed = document.querySelector('[data-testid="refund-amount"]').value.replace(/[^0-9.]/g, '');
  const pounds = Number.parseFloat(typed);
  return Number.isFinite(pounds) ? Math.round(pounds * 100) : 0;
}

const refundForm = detail.querySelector('[data-testid="refund-form"]');
const refundAmount = refundForm.querySelector('[data-testid="refund-amount"]');
const refundReason = refundForm.querySelector('[data-testid="refund-reason"]');
const issueRefundButton = refundForm.querySelector('[data-testid="issue-refund"]');

/**
 * Every control whose availability depends on where the order has got to,
 * decided from the text the served summary carries. It mirrors the desk's own
 * rule: money has been taken and not all of it given back, and nobody has sent
 * the order yet.
 */
function syncActions() {
  const payment = summaryField('payment');
  const fulfilment = summaryField('fulfilment');
  const refundable = payment === 'Paid' || payment === 'Part refunded';
  markDispatched.disabled = !(refundable && fulfilment === 'Unfulfilled');
  cancelOrder.disabled = fulfilment === 'Dispatched' || fulfilment === 'Delivered' || fulfilment === 'Cancelled';
  refundAmount.disabled = !refundable;
  refundReason.disabled = !refundable;
  issueRefundButton.disabled = !(refundable && amountPence() > 0 && refundReason.value !== '');
}

refundAmount.addEventListener('input', syncActions);
refundReason.addEventListener('change', syncActions);
refundForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const pence = amountPence();
  const chosen = refundReason.selectedOptions[0].textContent;
  confirmAction(
    'Refund ' + refundAmount.value.trim() + ' against ' + reference + '?',
    'The money leaves the merchant account today and the customer is told by mail.',
    'Refund this order',
    () => issueRefund(pence, chosen));
});

async function refreshSummaryPanel() {
  const response = await fetch(summaryPath);
  if (!response.ok) throw new Error('Order summary failed: ' + response.status);
  const panel = detail.querySelector('[data-testid="order-summary"]');
  panel.replaceWith(fromHtml(await response.text()));
  syncActions();
}

async function issueRefund(pence, reason) {
  await mutate('refund-order', { reference, amountPence: pence, reason });
  closeOverlay();
  await refreshSummaryPanel();
  showToast('Refund recorded against ' + reference);
}

async function dispatchThisOrder() {
  await mutate('dispatch-orders', { references: [reference] });
  closeOverlay();
  await refreshSummaryPanel();
  showToast(reference + ' dispatched');
}

async function cancelThisOrder() {
  await mutate('cancel-order', { reference });
  closeOverlay();
  await refreshSummaryPanel();
  showToast(reference + ' cancelled');
}

markDispatched.addEventListener('click', () => confirmAction(
  'Dispatch ' + reference + '?',
  'The carrier is told straight away and the customer gets a dispatch mail.',
  'Mark as dispatched',
  dispatchThisOrder));

cancelOrder.addEventListener('click', () => confirmAction(
  'Cancel ' + reference + '?',
  'The order stops being picked and the customer is told. Any money already taken stays until it is refunded.',
  'Cancel this order',
  cancelThisOrder));

syncActions();
`;
