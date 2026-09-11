import { escapeHtml, fixtureClient, page } from "../../html.js";
import type { RenderContext } from "../../types.js";
import { renderSaveAction } from "./save-action.js";
import type { IdentityDriftState } from "./state.js";

// The Advanced section is taller than the viewport, so the form footer, where
// the `moved` mode renders the Save action, starts below the fold at any size.
const styles = `<style>
      .form-actions, .form-footer { display: flex; gap: .75rem; align-items: center; margin: 1rem 0; }
      .form-footer p { margin: 0; }
      .advanced { min-height: 110vh; }
    </style>`;

/**
 * The workspace settings page. Only the Save action differs between modes:
 * its markup comes from `renderSaveAction`, and `moved` places it in the form
 * footer instead of beside Discard. Everything else renders identically.
 */
export function renderIdentityDriftPage(state: IdentityDriftState, context: RenderContext): string {
  const saveAction = renderSaveAction(state.mode);
  const inFooter = state.mode === "moved";
  const body = `${styles}<main>
    <header>
      <h1>Workspace settings</h1>
      <p>Changes apply to everyone in this workspace.</p>
    </header>
    <form id="settings-form" data-testid="settings-form" aria-label="Workspace settings" novalidate>
      <section aria-labelledby="general-heading">
        <h2 id="general-heading">General</h2>
        <label for="display-name">Workspace name</label>
        <input id="display-name" name="displayName" data-testid="display-name" type="text" autocomplete="organization" required aria-describedby="display-name-hint" value="${escapeHtml(state.savedDisplayName ?? state.defaultDisplayName)}">
        <p id="display-name-hint">Shown in the sidebar and on invitations.</p>
        <div class="form-actions" role="group" aria-label="General actions" data-testid="primary-actions">${inFooter ? "" : saveAction}<button type="reset" id="discard-settings" class="btn btn-secondary" data-testid="discard-changes">Discard changes</button></div>
      </section>
      <section class="advanced" aria-labelledby="advanced-heading">
        <h2 id="advanced-heading">Advanced</h2>
        <p>Your organization manages these settings; they are read-only here.</p>
        <dl>
          <dt>Data region</dt><dd>EU (Frankfurt)</dd>
          <dt>Message retention</dt><dd>365 days</dd>
          <dt>Audit log</dt><dd>Enabled for all members</dd>
          <dt>API access</dt><dd>Workspace owners only</dd>
        </dl>
      </section>
      <footer class="form-footer" role="group" aria-label="Footer actions" data-testid="footer-actions">${inFooter ? saveAction : ""}<p>Need something else? Ask a workspace owner.</p></footer>
    </form>
    <p data-testid="save-status" role="status" aria-live="polite">${escapeHtml(state.status)}</p>
  </main>`;
  return page("Workspace settings", body, clientScript(context));
}

/** Submitting saves through `mutate`; Discard (a native reset) is recorded too. */
function clientScript(context: RenderContext): string {
  return `${fixtureClient(context.runToken, "identity-drift")}
const form = document.querySelector('[data-testid="settings-form"]');
const field = document.querySelector('[data-testid="display-name"]');
const status = document.querySelector('[data-testid="save-status"]');
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const displayName = field.value.trim();
  if (!displayName) { status.textContent = 'Enter a workspace name.'; return; }
  const snapshot = await mutate('save', { displayName });
  if (snapshot.state.savedDisplayName) field.defaultValue = snapshot.state.savedDisplayName;
  status.textContent = snapshot.state.status;
});
form.addEventListener('reset', async () => {
  const snapshot = await mutate('discard', {});
  status.textContent = snapshot.state.status;
});`;
}
