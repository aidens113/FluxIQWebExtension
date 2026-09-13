/**
 * The customer list's virtualiser.
 *
 * Rows are mounted only while their index is inside the scroll viewport's band
 * plus an overscan on each side; a row that leaves the band is removed from the
 * document, not hidden. Rows still inside the band keep their element, the way
 * a keyed virtualiser reuses nodes, so the churn a recording meets is the real
 * one and not an artefact of re-rendering everything on every scroll tick.
 *
 * The consequence this fixture exists for: the element a recording captured is
 * gone from the DOM by the time a replay looks for it, and the list's own
 * scroll container -- not the window -- is what has to move for it to come back.
 */
export const virtualListScript = `
function money(cents) {
  var whole = String(Math.floor(Math.abs(cents) / 100)).replace(/\\B(?=(\\d{3})+(?!\\d))/g, ',');
  return (cents < 0 ? '-' : '') + '$' + whole + '.' + String(Math.abs(cents) % 100).padStart(2, '0');
}
function matchingRecords(query) {
  var needle = query.trim().toLowerCase();
  if (!needle) return records;
  return records.filter(function (record) { return record.company.toLowerCase().indexOf(needle) >= 0; });
}
function buildRow(record, index) {
  var row = document.createElement('div');
  row.className = CX.row;
  row.setAttribute('role', 'row');
  row.setAttribute('data-testid', 'record-row');
  row.setAttribute('data-record-id', record.id);
  row.setAttribute('aria-rowindex', String(index + 1));
  row.setAttribute('tabindex', '-1');
  var main = document.createElement('span');
  main.className = CX.rowMain;
  var company = document.createElement('span');
  company.className = CX.rowCompany;
  company.setAttribute('data-testid', 'row-company');
  company.textContent = record.company;
  var meta = document.createElement('span');
  meta.className = CX.rowMeta;
  meta.setAttribute('data-testid', 'row-contact');
  meta.textContent = record.id + ' \\u00b7 ' + record.contact;
  main.append(company, meta);
  var plan = document.createElement('span');
  plan.className = CX.chip;
  plan.setAttribute('data-testid', 'row-plan');
  plan.textContent = record.plan;
  var mrr = document.createElement('span');
  mrr.setAttribute('data-testid', 'row-mrr');
  mrr.textContent = money(currentMrrCents(record));
  var menu = document.createElement('button');
  menu.type = 'button';
  menu.className = CX.rowMenu;
  menu.setAttribute('aria-label', 'Row actions');
  menu.textContent = '\\u22ef';
  row.append(main, plan, mrr, menu);
  return row;
}
function placeRow(row, record, index, selectedId) {
  row.style.top = (index * ROW_H) + 'px';
  row.setAttribute('aria-rowindex', String(index + 1));
  row.className = record.id === selectedId ? CX.row + ' ' + CX.rowOn : CX.row;
  // A reused node still has to show current data: an edit saved in the detail
  // pane changes the revenue this row reads, and reuse without a refresh would
  // leave the list quietly stale.
  row.querySelector('[data-testid="row-mrr"]').textContent = money(currentMrrCents(record));
}
function renderRows() {
  var visible = ui.filtered;
  canvas.style.height = (visible.length * ROW_H) + 'px';
  var top = viewport.scrollTop;
  var start = Math.max(0, Math.floor(top / ROW_H) - OVERSCAN);
  var end = Math.min(visible.length, Math.ceil((top + VIEW_H) / ROW_H) + OVERSCAN);
  var wanted = new Map();
  for (var index = start; index < end; index += 1) wanted.set(visible[index].id, index);
  var mounted = new Map();
  var existing = Array.prototype.slice.call(canvas.children);
  for (var each = 0; each < existing.length; each += 1) {
    var node = existing[each];
    var id = node.getAttribute('data-record-id');
    if (wanted.has(id)) mounted.set(id, node);
    else node.remove();
  }
  for (var position = start; position < end; position += 1) {
    var record = visible[position];
    var row = mounted.get(record.id);
    if (!row) {
      row = buildRow(record, position);
      canvas.append(row);
    }
    placeRow(row, record, position, ui.selectedId);
  }
}
function applyQuery(query) {
  ui.query = query;
  ui.filtered = matchingRecords(query);
  viewport.scrollTop = 0;
  summary.textContent = query.trim()
    ? ui.filtered.length + ' of ' + records.length + ' records'
    : records.length + ' records';
  renderRows();
}`;
