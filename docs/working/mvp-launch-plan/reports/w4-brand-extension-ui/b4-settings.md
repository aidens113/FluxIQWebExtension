# W4-B4 settings screen (lane t900)

## Outcome
Partial. Build and unit tests done and passing; `check-extension` fails only on an unbuilt sibling package (domain), not on my code. No live browser check done.

## What changed and why
- settings-view.ts: new order Connection (state, approval, project line, Reconnect switch, Disconnect), Model (key status + Open FluxIQ; Core's readModelKey only gives ready/missing/locked/unknown, so key status only), Behaviour (Humanness slider, Status on the page), Permissions (captureMutations, captureInputValues, captureSnapshots, requestsEnabled), one Save row (draft line, Save, Saved./failure), Appearance, Help, Advanced (addresses, Forget this pairing). The separate Project group was folded into Connection.
- address-form.ts: new `parts` (addresses, reconnect, permissions) so the screen places each switch in its own group; `element`, ids, read/fill/allow unchanged. form-fields.ts: clearer one-line explanations for reconnect, page changes, page snapshots.
- settings/humanness/ (limits.ts mirror 0/100/0 "until t898 lands", normalise-humanness.ts, settings.ts local type, read-humanness.ts, with-humanness.ts, slider.ts, barrel). Save sends `humanness` (clamped, rounded); absent reads 0. Humanness edits mark settings dirty like other fields.
- settings/appearance-section.ts + panel/theme-choice/ (key "fluxiq.ui.theme", dark default, applied as data-theme dark|light|system, applied immediately in mountPanel via one call line `mountThemeChoice()`, follows chrome.storage.onChanged live).
- settings.css: tokens only; mono uppercase labels, amber slider thumb, focus ring, theme chips, narrow-width rules.
- Tests: settings/tests/humanness-settings.test.ts (clamp/round, absent = 0, slider shows saved value, Save sends `humanness: 100` for 177.4), theme-choice/tests/theme-choice.test.ts (store, default dark, apply, live follow); settings-order.test.ts updated for the new groups and to assert switch ids kept and out of Advanced.

## Commands run and observed results
- `node scripts/test-extension.mjs panel/settings/tests panel/theme-choice/tests` -> `# pass 59`, `# fail 0`.
- `heavy-slot run t900 -- node scripts/check-extension.mjs` -> 14 tsc errors, all `Cannot find module '@fluxiq-web-extension/domain/node'` or the implicit-any that follows (e2e/content offline-reads, packages/test-runner offline-snapshot-page). None in panel code. This is the unbuilt domain package, not Core ui-components. That run started before my last renames, so panel files were not re-typechecked afterwards.
- `node scripts/structure-audit.mjs` (extension root) -> 2 FAIL left, both not mine: shared/protocol.ts 803 lines (>800), background/panel/tests/panel-control.test.ts statement packing at line 335. My earlier failures (as-never, humanness- prefix, statement packing, swallowed-failure) were fixed and no longer reported. Not "passed" as required.

## Not verified
- No browser run: slider look at 360-400px and in the Firefox popup, theme switching on screen, data-theme flash on first paint (dark applied at once, stored choice a tick later).
- Whole-package typecheck of my edits after the final rename (see above); a rerun needs domain built first.
- Appearance section's radio wiring has no direct test (covered through theme-choice module only).

## Open questions or contradictions found
- Persistent humanness needs protocol.ts/storage from the other lane; until then the background may drop the field on save.
- The brief's e2e/Lab ids kept; the Save button and Disconnect moved out of Advanced, so the Lab's `open-settings-advanced.ts` step still works but is no longer required for them.
- protocol.ts is already over 800 lines on this branch (other lane).
