/**
 * The detail pane and its inline editors.
 *
 * A field is a button until it is clicked; the click replaces the button with
 * an input, and Enter or a blur replaces the input with a freshly built button
 * carrying the committed value. Three different elements therefore stand in the
 * same place during one edit, and none of them is the element that was there
 * when the edit began. Escape puts the original value back.
 *
 * Only the detail body is the client's; the read-only banner beside it is
 * server-rendered, so the client replaces the body's children and never the
 * pane's.
 */
export const detailPaneScript = `
function draftFor(recordId) {
  var existing = ui.drafts.get(recordId);
  if (existing) return existing;
  var created = new Map();
  ui.drafts.set(recordId, created);
  return created;
}
function savedValue(recordId, field) {
  var byField = ui.saved.get(recordId);
  return byField ? byField.get(field) : undefined;
}
function currentMrrCents(record) {
  var saved = savedValue(record.id, 'mrr');
  return saved === undefined ? record.mrrCents : saved;
}
function currentOwner(record) {
  var saved = savedValue(record.id, 'owner');
  return saved === undefined ? record.owner : saved;
}
function selectedRecord() {
  if (!ui.selectedId) return undefined;
  for (var index = 0; index < records.length; index += 1) if (records[index].id === ui.selectedId) return records[index];
  return undefined;
}
function draftedValue(field, record) {
  var draft = draftFor(record.id).get(field);
  if (draft !== undefined) return draft;
  return field === 'mrr' ? currentMrrCents(record) : currentOwner(record);
}
function displayValue(field, record) {
  var value = draftedValue(field, record);
  return field === 'mrr' ? money(value) : value;
}
function fieldControl(field, record) {
  var node = document.createElement(READ_ONLY ? 'span' : 'button');
  node.className = READ_ONLY ? CX.fieldStatic : CX.fieldButton;
  node.setAttribute('data-testid', 'field-' + field);
  node.setAttribute('aria-label', FIELD_LABELS[field]);
  if (!READ_ONLY) {
    node.type = 'button';
    node.setAttribute('data-field', field);
  }
  node.textContent = displayValue(field, record);
  return node;
}
function fieldRow(field, label, record) {
  var wrapper = document.createElement('div');
  wrapper.className = CX.fieldRow;
  var term = document.createElement('dt');
  term.textContent = label;
  var cell = document.createElement('dd');
  cell.setAttribute('data-field-cell', field);
  cell.append(fieldControl(field, record));
  wrapper.append(term, cell);
  return wrapper;
}
function staticRow(field, label, text) {
  var wrapper = document.createElement('div');
  wrapper.className = CX.fieldRow;
  var term = document.createElement('dt');
  term.textContent = label;
  var cell = document.createElement('dd');
  var value = document.createElement('span');
  value.setAttribute('data-testid', 'field-' + field);
  value.textContent = text;
  cell.append(value);
  wrapper.append(term, cell);
  return wrapper;
}
function renderDetail() {
  var record = selectedRecord();
  if (!record) {
    var empty = document.createElement('p');
    empty.className = CX.empty;
    empty.setAttribute('data-testid', 'detail-empty');
    empty.textContent = 'Select a customer to see their account.';
    detailBody.replaceChildren(empty);
    return;
  }
  var head = document.createElement('div');
  head.className = CX.detailHead;
  var heading = document.createElement('h2');
  heading.setAttribute('data-testid', 'detail-heading');
  heading.textContent = record.company;
  var subtitle = document.createElement('p');
  subtitle.setAttribute('data-testid', 'detail-subtitle');
  subtitle.textContent = record.id + ' \\u00b7 ' + record.plan + ' \\u00b7 ' + record.status;
  head.append(heading, subtitle);
  var list = document.createElement('dl');
  list.className = CX.fields;
  list.setAttribute('data-testid', 'detail-fields');
  list.append(
    staticRow('contact', 'Primary contact', record.contact),
    staticRow('email', 'Email', record.email),
    fieldRow('owner', 'Account owner', record),
    fieldRow('mrr', 'Monthly recurring revenue', record),
    staticRow('renews', 'Renews on', record.renewsOn)
  );
  var bar = document.createElement('div');
  bar.className = CX.bar;
  var save = document.createElement('button');
  save.type = 'button';
  save.className = CX.primary;
  save.setAttribute('data-testid', 'save-record');
  save.textContent = 'Save changes';
  save.addEventListener('click', function () { void saveRecord(); });
  var status = document.createElement('p');
  status.setAttribute('role', 'status');
  status.setAttribute('data-testid', 'save-status');
  bar.append(save, status);
  detailBody.replaceChildren(head, list, bar);
  renderSaveBar();
}
function renderSaveBar() {
  var record = selectedRecord();
  if (!record) return;
  var save = detailBody.querySelector('[data-testid="save-record"]');
  var status = detailBody.querySelector('[data-testid="save-status"]');
  if (!save || !status) return;
  var pending = draftFor(record.id).size;
  save.disabled = READ_ONLY || pending === 0;
  var existingBadge = detailBody.querySelector('[data-testid="unsaved-badge"]');
  if (existingBadge) existingBadge.remove();
  if (pending > 0) {
    var badge = document.createElement('span');
    badge.className = CX.badge;
    badge.setAttribute('data-testid', 'unsaved-badge');
    badge.textContent = pending + ' unsaved ' + (pending === 1 ? 'change' : 'changes');
    save.after(badge);
    status.replaceChildren(document.createTextNode('Not saved yet'));
    return;
  }
  var lastSaved = ui.lastSaved.get(record.id);
  if (lastSaved) {
    var marker = document.createElement('span');
    marker.setAttribute('data-testid', 'saved-marker');
    marker.textContent = 'Saved ' + lastSaved + ' ' + (lastSaved === 1 ? 'change' : 'changes');
    status.replaceChildren(marker);
    return;
  }
  status.replaceChildren(document.createTextNode('All changes saved'));
}
function editableText(field, record) {
  var value = draftedValue(field, record);
  return field === 'mrr' ? (value / 100).toFixed(2) : value;
}
function parseMoneyText(raw) {
  var cleaned = raw.replace(/[$,\\s]/g, '');
  if (!/^-?\\d{1,9}(\\.\\d{1,2})?$/.test(cleaned)) return null;
  return Math.round(parseFloat(cleaned) * 100);
}
function parseNameText(raw) {
  var trimmed = raw.replace(/\\s+/g, ' ').trim().slice(0, 60);
  return trimmed ? trimmed : null;
}
function beginEdit(button) {
  var field = button.getAttribute('data-field');
  var record = selectedRecord();
  if (!field || !record || READ_ONLY) return;
  var cell = button.parentElement;
  if (!cell) return;
  var input = document.createElement('input');
  input.className = CX.fieldInput;
  input.setAttribute('data-testid', 'field-' + field + '-input');
  input.setAttribute('aria-label', FIELD_LABELS[field]);
  input.value = editableText(field, record);
  cell.replaceChildren(input);
  input.focus();
  input.select();
  // One editor settles once. Chromium fires blur synchronously while the input
  // is being replaced, and the element is still connected at that moment, so a
  // liveness check is not enough of a guard: without this flag the blur handler
  // re-enters the commit that removed it and the outer replaceChildren then
  // fails on a node it no longer owns.
  var settled = false;
  function settle(commit) {
    if (settled) return;
    settled = true;
    if (commit) commitEdit(field, input.value);
    else { refreshField(field); renderSaveBar(); }
  }
  input.addEventListener('keydown', function (event) {
    if (event.key === 'Enter') { event.preventDefault(); settle(true); }
    else if (event.key === 'Escape') { event.preventDefault(); settle(false); }
  });
  input.addEventListener('blur', function () { settle(true); });
}
function commitEdit(field, raw) {
  var record = selectedRecord();
  if (!record) return;
  var parsed = field === 'mrr' ? parseMoneyText(raw) : parseNameText(raw);
  if (parsed !== null) draftFor(record.id).set(field, parsed);
  refreshField(field);
  renderSaveBar();
  renderRows();
}
function refreshField(field) {
  var record = selectedRecord();
  var cell = detailBody.querySelector('[data-field-cell="' + field + '"]');
  if (record && cell) cell.replaceChildren(fieldControl(field, record));
}
async function saveRecord() {
  var record = selectedRecord();
  if (!record) return;
  var drafts = draftFor(record.id);
  if (drafts.size === 0) return;
  var fields = [];
  drafts.forEach(function (value, field) { fields.push({ field: field, value: field === 'mrr' ? money(value) : value }); });
  await mutate('save-record', { recordId: record.id, fields: fields });
  var saved = ui.saved.get(record.id) || new Map();
  drafts.forEach(function (value, field) { saved.set(field, value); });
  ui.saved.set(record.id, saved);
  ui.lastSaved.set(record.id, drafts.size);
  drafts.clear();
  renderDetail();
  renderRows();
}`;
