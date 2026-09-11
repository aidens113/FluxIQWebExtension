import type { IdentityDriftMode } from "./modes.js";

/**
 * The "Save changes" submit button as each mode renders it. Only the baseline
 * keeps the recorded `data-testid`: every drifted rendering drops or changes
 * it on purpose, so a run recovers the action only through the identity
 * signals its mode leaves intact. Where the button sits (the `moved` footer)
 * belongs to the page layout in `render.ts`.
 */
export function renderSaveAction(mode: IdentityDriftMode): string {
  switch (mode) {
    case "baseline":
      return '<button type="submit" id="save-settings" class="btn btn-primary" data-testid="save-changes">Save changes</button>';
    case "selector-only":
      // id, class, and test id change; text, role, and position do not.
      return '<button type="submit" id="workspace-settings-submit" class="ui-button ui-button--accent" data-testid="settings-submit">Save changes</button>';
    case "text-only":
      // Visible text and accessible name change; id, class, and position do not.
      return '<button type="submit" id="save-settings" class="btn btn-primary">Apply changes</button>';
    case "moved":
      // The baseline button without its test id; the layout moves it to the footer.
      return '<button type="submit" id="save-settings" class="btn btn-primary">Save changes</button>';
    case "wrapped-aria":
      // Wrappers outside and inside the button; the name comes from aria-labelledby.
      return '<span class="action-slot"><span class="action-frame"><button type="submit" id="save-settings" class="btn btn-primary" aria-labelledby="save-settings-label"><span class="btn-content"><span id="save-settings-label" class="btn-label">Save changes</span></span></button></span></span>';
  }
}
