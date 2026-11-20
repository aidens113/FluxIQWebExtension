# settings-extension report (t925, key-security-ux)

## Outcome
Partial. All four items are fixed and tested; the 140 settings/shell/theme-choice tests pass. The acceptance `pnpm ... extension check` is refused by its own guard because Core's ui-components build is stale (the other worker is editing Core); a direct typecheck (`node scripts/check-extension.mjs`, through the gate) was still running when this was written (see Commands).

## Item 1: one control style (jank 15)
- Wrong: native 13 px amber checkboxes and radios beside 26 px segmented buttons.
- Cause: no styling on `input[type=checkbox|radio]` in `.settings-screen`.
- Fix: `settings.css` draws one family from tokens (`--edge`, `--surface-muted`, `--accent`, `--accent-edge`): 18 px marks, rounded square vs round, tick as an inline SVG (the accent-ink dark both themes use), disabled and hover states. Rows are at least 32 px (label is the hit area; hint indent 32 px). The Core segmented `.chat-setting-option` is raised to 28 px by a settings-scoped override (Core untouched). Theme chips stay 32 px.
- Files: `X/panel/settings/settings.css`. Not exercised in a real browser (see Not verified).

## Items 2 (jank 16, 18): no jumps
- Wrong: humanness change and Report a problem inserted lines and pushed the rest down.
- Cause: the status lines were `display:none` when empty (`.humanness-status:empty` in Core; `hidden` on the report line).
- Fix: `.settings-screen .humanness .humanness-status` always takes one line; the report line gets class `reserved-line` (2.8 em, `[hidden]` keeps layout with `visibility:hidden`, so it is also out of the accessibility tree).
- Files: `settings.css`, `problem-report-section.ts`.
- Test: `settings/tests/unsaved-changes.test.ts` (class present; stylesheet rules present).

## Item 3 (jank 17): Advanced, one save model
- Wrong: hint "Usually ws://127.0.0.1:4777/client."; a draft bar at the foot with no word on what was unsaved.
- Fix: hint is now "Where this browser connects to FluxIQ." (`form-fields.ts`). One model kept: the form (addresses, switches, slider) is saved by one "Save changes"; the bar now names what is unsaved, "Not saved yet: Starting humanness, Reconnect automatically." (new `unsaved-changes.ts`, wired in `settings-view.ts`, exported from the barrel). The two things that apply at once (theme, status on the page) say so: Appearance hint "Applies at once, no Save needed. ..." (`appearance-section.ts`).
- Tests: `unsaved-changes.test.ts` (no port in the hint; labels in display order, padding not a change; bar text after a switch and slider change, cleared after Save).

## Item 4 (new defect 7): header tabs
- Cause found: not an inert region (nothing in `shell/` sets `inert` or `aria-hidden` on the header). The tabs are `role="tab"` inside a tablist, so `getByRole("button", {name:"Chat"})` can never match them by design.
- Fix: kept the tablist pattern (arrow keys, aria-controls, tests rely on it); each tab now has an explicit `aria-label` equal to its text, so `getByRole("tab", { name: "Chat" })` and "Automations" are stable. The gear stays a button named "Settings". Anything driving the panel should use the tab role.
- Files: `X/panel/shell/top-bar.ts`; test in `shell/tests/top-bar.test.ts` (role, name, text).

## Commands run and observed
- `heavy-slot run t925-xset-check -- pnpm --filter @fluxiq-web-extension/extension check` -> refused: "FluxIQ Core's build ... is not current with its source. Stale: ui-components:build: inputs changed: packages/ui-components". I did not rebuild Core (not mine).
- `heavy-slot run t925-xset-tests -- env EXTENSION_TEST_BUILD_LABEL=t925-xset node scripts/test-extension.mjs panel/settings panel/shell panel/theme-choice` -> `# tests 140  # pass 140  # fail 0`.
- `node scripts/structure-audit.mjs` (EXT, not through the gate; light) -> `structure-audit: passed (254 warning(s), 551 baselined).`
- `iconv -f UTF-8 -t UTF-8` on every written file -> no errors.
- `heavy-slot run t925-xset-tc -- node scripts/check-extension.mjs` -> queued/running at write time; result not captured here.

## Not verified
- No browser run: the look of the new checkboxes/radios in both themes, and that the reserved lines remove the 19 px / 0.02 shift, are not measured. I could not find the humanness jump's exact cause by reading (Core's draft-mode control shows no status line); the reservation is the prescribed remedy, not a confirmed root cause.
- Typecheck of the extension (above).

## Open
- Wording of the Lab: anything that looked for the header tabs as buttons must use role tab.
