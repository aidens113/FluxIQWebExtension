import { applyIdentifierPolicy } from "../../identifier-policy/index.js";
import { fixtureClient, page } from "../../html.js";
import { adminConsoleClientScript } from "./client-script.js";
import { recordsFor } from "./records.js";
import { ADMIN_CONSOLE_STYLE, CX } from "./styles.js";
import type { AdminConsoleState, AdminRecord } from "./types.js";

/**
 * The whole document, identical for every in-app path.
 *
 * The server serves one shell and the client routes from `location`, the way a
 * production single-page console does. That is deliberate rather than
 * convenient: it is what makes a record deep link and a settings tab reachable
 * with no navigation event, and it means the customer list and the detail pane
 * exist in exactly one implementation -- the client's -- instead of a server
 * copy the client would have to agree with.
 *
 * The settings screen is static, so it is rendered here in full. Everything a
 * variant changes about it -- the shadow-rooted switch, or the light-DOM
 * control that replaces it -- is therefore already in the served HTML.
 */
export function renderConsoleDocument(state: AdminConsoleState, runToken: string): string {
  const records = recordsFor(state.recordCount);
  const body = `<div class="${CX.shell}" data-testid="app-root" data-variant="${state.variant}">
  <header class="${CX.topbar}">
    <span class="${CX.brand}" data-testid="workspace-name">Atlas Admin</span>
    <span data-testid="workspace-plan">Bramblewick Group &middot; Enterprise</span>
  </header>
  <div class="${CX.main}">
    <nav class="${CX.sidebar}" aria-label="Console sections">
      <button type="button" class="${CX.navLink} ${CX.navLinkOn}" data-testid="nav-records" aria-current="page">Customers</button>
      <button type="button" class="${CX.navLink}" data-testid="nav-settings" aria-current="false">Settings</button>
    </nav>
    <div class="${CX.board}">
      <div class="${CX.split}" data-testid="records-screen">${listPane(records.length)}${detailPane(state)}</div>
      ${settingsView(state)}
    </div>
  </div>
</div>
<script type="application/json" data-testid="bootstrap-records">${bootstrapJson(records)}</script>
<style>${ADMIN_CONSOLE_STYLE}</style>`;
  const document = page("Atlas Admin", body, `${fixtureClient(runToken, "admin-console")}\n${adminConsoleClientScript(state)}`);
  // Over the finished document, script included: the customer rows, the detail
  // pane and the shadow-rooted switch are all built in the browser from the
  // same attributes the served markup uses, so a policy applied to the markup
  // alone would leave every control the client renders still labelled.
  return applyIdentifierPolicy(document, state.identifiers);
}

/** The list pane's chrome. Its rows are the client's, and only ever the ones near the viewport. */
function listPane(recordCount: number): string {
  return `<section class="${CX.listPane}" data-testid="records-view">
        <div class="${CX.listHeader}">
          <h2 id="customer-list-heading">Customers</h2>
          <label for="record-search">Search customers</label>
          <input class="${CX.search}" id="record-search" type="search" autocomplete="off" placeholder="Search by company" data-testid="record-search">
          <p data-testid="list-summary" role="status">${recordCount} records</p>
        </div>
        <div class="${CX.viewport}" data-testid="list-viewport" role="grid" aria-labelledby="customer-list-heading" aria-rowcount="${recordCount}" tabindex="0">
          <div class="${CX.canvas}" data-testid="list-canvas"></div>
        </div>
      </section>`;
}

/** The detail pane. The read-only banner is server-rendered; the body below it is replaced by the client. */
function detailPane(state: AdminConsoleState): string {
  const banner = state.variant === "read-only"
    ? `<p class="${CX.badge}" data-testid="read-only-banner">Read-only access &mdash; ask a workspace owner to make changes</p>`
    : "";
  return `<section class="${CX.detail}" data-testid="detail-pane" aria-live="polite">${banner}
        <div data-testid="detail-body"><p class="${CX.empty}" data-testid="detail-empty">Select a customer to see their account.</p></div>
      </section>`;
}

/**
 * The settings screen, hidden until the client routes to it. Its three "Reset
 * to default" buttons carry no test id and no distinguishing name on purpose:
 * they are one accessible name repeated three times, told apart only by the
 * section they sit in.
 */
function settingsView(state: AdminConsoleState): string {
  return `<section class="${CX.detail}" data-testid="settings-view" hidden>
        <div class="${CX.detailHead}"><h2>Workspace settings</h2><p>Applies to everyone in Bramblewick Group.</p></div>
        <div class="${CX.tabs}" role="tablist" aria-label="Settings sections">
          <button type="button" class="${CX.tab} ${CX.tabOn}" role="tab" aria-selected="true" data-testid="tab-profile" data-tab="profile">Profile</button>
          <button type="button" class="${CX.tab}" role="tab" aria-selected="false" data-testid="tab-notifications" data-tab="notifications">Notifications</button>
          <button type="button" class="${CX.tab}" role="tab" aria-selected="false" data-testid="tab-security" data-tab="security">Security</button>
        </div>
        <div class="${CX.panel}" role="tabpanel" data-testid="profile-panel" data-panel="profile">
          <div class="${CX.pref}"><span>Workspace display name</span><span>Bramblewick Group</span></div>
          <div class="${CX.pref}"><span>Default currency</span><span>USD</span></div>
          <button type="button" class="${CX.ghost}">Reset to default</button>
        </div>
        <div class="${CX.panel}" role="tabpanel" data-testid="notifications-panel" data-panel="notifications" hidden>
          <div class="${CX.pref}"><span id="digest-label">Weekly digest email</span>${digestControl(state)}</div>
          <p data-testid="digest-status">Weekly digest: ${state.preferences.weeklyDigest ? "on" : "off"}</p>
          <button type="button" class="${CX.ghost}">Reset to default</button>
        </div>
        <div class="${CX.panel}" role="tabpanel" data-testid="security-panel" data-panel="security" hidden>
          <div class="${CX.pref}"><span>Session timeout</span><span>8 hours</span></div>
          <button type="button" class="${CX.ghost}">Reset to default</button>
        </div>
      </section>`;
}

/**
 * The digest switch. Under `light-dom-toggle` it is an ordinary button; under
 * every other variant it is `<fx-toggle>`, whose open shadow root holds a
 * button with the same test id, the same `switch` role and the same accessible
 * name. Nothing else differs, so a run that succeeds on one and fails on the
 * other has isolated the shadow boundary and nothing else.
 */
function digestControl(state: AdminConsoleState): string {
  const checked = state.preferences.weeklyDigest ? "true" : "false";
  if (state.variant === "light-dom-toggle") {
    return `<button type="button" class="${CX.ghost}" role="switch" aria-checked="${checked}" aria-label="Weekly digest email" data-testid="digest-toggle">${state.preferences.weeklyDigest ? "On" : "Off"}</button>`;
  }
  return `<fx-toggle data-testid="digest-toggle-host" data-pref="weeklyDigest" data-control-testid="digest-toggle" data-checked="${checked}"></fx-toggle>`;
}

/** The account book the client renders from, the way a production console ships its bootstrap state. */
function bootstrapJson(records: readonly AdminRecord[]): string {
  return JSON.stringify(records).replaceAll("<", "\\u003c");
}
