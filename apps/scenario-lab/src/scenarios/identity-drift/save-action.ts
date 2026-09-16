import type { IdentityDriftMode } from "./modes.js";

/**
 * The "Save changes" submit button as each mode renders it. Only the baseline
 * keeps the recorded `data-testid`: every drifted rendering drops or changes
 * it on purpose, so a run recovers the action only through the identity
 * signals its mode leaves intact. Where the button sits (the `moved` footer)
 * belongs to the page layout in `render.ts`. `save-and-exit` renders a
 * different action in Save's place instead.
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
    case "reworded-aria":
      // The `selector-only` redesign carried through to the label: the same new
      // class vocabulary, no id or test id because the component library emits
      // neither, and the visible label shortened to "Save". The full name is
      // kept in `aria-label`, which is what a shortened label needs anyway to
      // satisfy WCAG 2.5.3 -- so the accessible name is preserved by the
      // redesign's own accessibility rule, not by the fixture's convenience.
      return '<button type="submit" class="ui-button ui-button--accent" aria-label="Save changes">Save</button>';
    case "renamed-redesign":
      // The `reworded-aria` component without the aria-label: the same class
      // vocabulary, no id or test id, and the label renamed outright to
      // `text-only`'s "Apply changes", so the accessible name changes with it.
      // Still the form's one submit button, still in Save's slot, and still a
      // save: `render.ts` routes it to `save` like every drift.
      return '<button type="submit" class="ui-button ui-button--accent">Apply changes</button>';
    case "save-and-exit":
      // Not Save at all: a different action in its slot, carrying nothing but
      // its own text. This is row R7's markup exactly; an added `type`, class
      // or `data-*` hook would change the fingerprint that row was measured on.
      // With no `type` it still submits the form, and `render.ts` routes that
      // submission to the fixture's `save-and-exit` operation, not to `save`.
      return "<button>Save changes and exit</button>";
  }
}
