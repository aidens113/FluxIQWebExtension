import { detailPaneScript } from "./detail-pane.js";
import { ADMIN_CONSOLE_ROOT } from "./format.js";
import { shadowControlScript } from "./shadow-control.js";
import { LIST_OVERSCAN_ROWS, LIST_ROW_HEIGHT_PX, LIST_VIEWPORT_HEIGHT_PX, CX } from "./styles.js";
import { settingsTabs, type AdminConsoleState } from "./types.js";
import { virtualListScript } from "./virtual-list.js";

/**
 * The console's client, assembled from the four scripts that make up its
 * behaviour. They share one module scope: the constants come first because a
 * `const` is not hoisted, and the rest are function declarations, which are.
 *
 * Routing is the part worth reading twice. Selecting a record pushes a new
 * path, and switching a settings tab replaces the current one; both change what
 * `document.location` reads with no request, no document swap, and no load
 * event. `popstate` puts the console back where the history entry says.
 */
export function adminConsoleClientScript(state: AdminConsoleState): string {
  return [constantsScript(state), shadowControlScript, virtualListScript, detailPaneScript, ROUTING_SCRIPT, BOOT_SCRIPT].join("\n");
}

function constantsScript(state: AdminConsoleState): string {
  return `
const ROOT = ${JSON.stringify(ADMIN_CONSOLE_ROOT)};
const ROW_H = ${LIST_ROW_HEIGHT_PX};
const VIEW_H = ${LIST_VIEWPORT_HEIGHT_PX};
const OVERSCAN = ${LIST_OVERSCAN_ROWS};
const TABS = ${JSON.stringify(settingsTabs)};
const CX = ${JSON.stringify(CX)};
const FIELD_LABELS = { owner: 'Account owner', mrr: 'Monthly recurring revenue' };
const SWITCH_LABEL = 'Weekly digest email';
const READ_ONLY = ${state.variant === "read-only"};
const RECORD_PATH = /\\/records\\/(CUS-\\d{4})$/;
const records = JSON.parse(document.querySelector('[data-testid="bootstrap-records"]').textContent);
const app = document.querySelector('[data-testid="app-root"]');
const viewport = document.querySelector('[data-testid="list-viewport"]');
const canvas = document.querySelector('[data-testid="list-canvas"]');
const summary = document.querySelector('[data-testid="list-summary"]');
const search = document.querySelector('[data-testid="record-search"]');
const recordsScreen = document.querySelector('[data-testid="records-screen"]');
const detailBody = document.querySelector('[data-testid="detail-body"]');
const settingsView = document.querySelector('[data-testid="settings-view"]');
const digestStatus = document.querySelector('[data-testid="digest-status"]');
const ui = {
  query: '',
  filtered: records,
  selectedId: null,
  view: 'records',
  tab: 'profile',
  drafts: new Map(),
  saved: new Map(),
  lastSaved: new Map(),
  weeklyDigest: ${state.preferences.weeklyDigest}
};`;
}

/**
 * Client-side routing. `pushState` for a record, `replaceState` for a tab: a
 * tab is a view of the same screen, not a place to come back to, which is how a
 * production console spells the difference. Neither issues a request.
 */
const ROUTING_SCRIPT = `
function routeFromLocation() {
  if (location.pathname.indexOf(ROOT + 'settings') === 0) {
    var asked = new URLSearchParams(location.search).get('tab');
    return { view: 'settings', recordId: null, tab: TABS.indexOf(asked) >= 0 ? asked : 'profile' };
  }
  var match = RECORD_PATH.exec(location.pathname);
  return { view: 'records', recordId: match ? match[1] : null, tab: ui.tab };
}
function settingsHref(tab) {
  return tab === 'profile' ? ROOT + 'settings' : ROOT + 'settings?tab=' + tab;
}
function applyRoute(route) {
  ui.view = route.view;
  ui.selectedId = route.recordId;
  ui.tab = route.tab;
  recordsScreen.hidden = route.view !== 'records';
  settingsView.hidden = route.view !== 'settings';
  document.querySelector('[data-testid="nav-records"]').className = CX.navLink + (route.view === 'records' ? ' ' + CX.navLinkOn : '');
  document.querySelector('[data-testid="nav-settings"]').className = CX.navLink + (route.view === 'settings' ? ' ' + CX.navLinkOn : '');
  document.querySelector('[data-testid="nav-records"]').setAttribute('aria-current', route.view === 'records' ? 'page' : 'false');
  document.querySelector('[data-testid="nav-settings"]').setAttribute('aria-current', route.view === 'settings' ? 'page' : 'false');
  applyTab(route.tab);
  renderRows();
  renderDetail();
}
function applyTab(tab) {
  var buttons = settingsView.querySelectorAll('[data-tab]');
  for (var index = 0; index < buttons.length; index += 1) {
    var button = buttons[index];
    var on = button.getAttribute('data-tab') === tab;
    button.className = on ? CX.tab + ' ' + CX.tabOn : CX.tab;
    button.setAttribute('aria-selected', on ? 'true' : 'false');
  }
  var panels = settingsView.querySelectorAll('[data-panel]');
  for (var panelIndex = 0; panelIndex < panels.length; panelIndex += 1) {
    panels[panelIndex].hidden = panels[panelIndex].getAttribute('data-panel') !== tab;
  }
}
function openRecord(recordId) {
  history.pushState(null, '', ROOT + 'records/' + recordId);
  applyRoute(routeFromLocation());
  void mutate('open-record', { recordId: recordId });
}
function showSection(view) {
  history.pushState(null, '', view === 'settings' ? settingsHref(ui.tab) : ROOT);
  applyRoute(routeFromLocation());
  void mutate('navigate-route', { view: view, tab: ui.tab });
}
function selectTab(tab) {
  history.replaceState(null, '', settingsHref(tab));
  applyRoute(routeFromLocation());
  void mutate('navigate-route', { view: 'settings', tab: tab });
}
function setDigest(checked) {
  ui.weeklyDigest = checked;
  digestStatus.textContent = 'Weekly digest: ' + (checked ? 'on' : 'off');
  void mutate('set-preference', { preference: 'weeklyDigest', value: checked });
}`;

/** Every listener the console installs, and the first render. */
const BOOT_SCRIPT = `
search.addEventListener('input', function () { applyQuery(search.value); });
viewport.addEventListener('scroll', function () { renderRows(); });
viewport.addEventListener('click', function (event) {
  if (event.target.closest('[aria-label="Row actions"]')) return;
  var row = event.target.closest('[data-testid="record-row"]');
  if (row) openRecord(row.getAttribute('data-record-id'));
});
detailBody.addEventListener('click', function (event) {
  var field = event.target.closest('[data-field]');
  if (field) beginEdit(field);
});
document.querySelector('[data-testid="nav-records"]').addEventListener('click', function () { showSection('records'); });
document.querySelector('[data-testid="nav-settings"]').addEventListener('click', function () { showSection('settings'); });
settingsView.addEventListener('click', function (event) {
  var tab = event.target.closest('[data-tab]');
  if (tab) { selectTab(tab.getAttribute('data-tab')); return; }
  var plain = event.target.closest('[data-testid="digest-toggle"]');
  if (!plain) return;
  var next = plain.getAttribute('aria-checked') !== 'true';
  plain.setAttribute('aria-checked', next ? 'true' : 'false');
  plain.textContent = next ? 'On' : 'Off';
  setDigest(next);
});
document.addEventListener('fx-change', function (event) {
  if (event.detail && event.detail.preference === 'weeklyDigest') setDigest(event.detail.checked);
});
window.addEventListener('popstate', function () { applyRoute(routeFromLocation()); });
applyQuery('');
applyRoute(routeFromLocation());
app.setAttribute('data-booted', 'true');`;
