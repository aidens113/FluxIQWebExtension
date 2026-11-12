# w5-tokens (lane t901, W5 P1)

## Outcome
Done, with one caveat: `pnpm structure:check` still reports one violation, in a file I do not own (see Open questions). No browser look was taken.

## What changed and why
The panel now uses only Core's `tokens.css`. Loaded once in `app/layout.tsx` (`@fluxiq/ui-components/styles/fonts.css`, `.../tokens.css`, before `globals.css`). The panel's palette is gone and every stylesheet was rewritten by a property-aware script (colour vs text vs border vs background) plus hand fixes.

### Old to new token mapping (CSS)
- `--color-background`, `--color-bg`, `--surface-shell` -> `--canvas`
- `--color-surface`, `--surface-pane`, `--surface-input` -> `--surface`
- `--color-surface-raised` -> `--surface-raised`; `--color-surface-muted` -> `--surface-raised`
- `--color-surface-subtle`, `--surface-tool` -> `--surface-muted`
- `--color-surface-hover`, `--surface-hover` -> `--hover`
- `--color-text` -> `--text`; `--color-text-muted` -> `--muted`; `--color-text-subtle` -> `--text-dim`; `--color-text-soft` -> `--text-soft`; `--color-text-inverse` -> `--accent-ink`
- `--color-border`, `--border` -> `--divider`; `--color-border-subtle` -> `--line`; `--color-border-strong` -> `--edge`
- `--color-primary` -> `--accent` (as a fill/border) or `--accent-text` (when the property is `color`/`fill`/`stroke`); `-hover`/`-strong` -> `--accent-hover` / `--accent-text`
- `--color-primary-soft`, `--color-selected-surface`, `--surface-selected`, `--color-selection` -> `--accent-soft`; `--color-selected-border` -> `--accent-edge`
- `--color-focus`, `--color-accent`, `--focus-ring` -> `--focus`; `--focus-ring-width/offset` -> `--focus-width/--focus-offset` (so the ring is now 2px at 4px offset, as the brand says)
- `--color-info` -> `--accent-text`, `-surface` -> `--accent-soft`, `-border` -> `--accent-edge`; `--color-link` -> `--accent-text`
- `--color-success` -> `--success`; `-surface` / `-border` -> `color-mix(in srgb, var(--success) 12% / 45%, var(--surface))`
- `--color-warning` -> `--warning-text` (text) or `--warning`; `-surface` -> `--warning-soft`; `-border` -> color-mix of `--warning`; `-strong` -> `--warning-text`
- `--color-danger` -> `--danger-text` (text) or `--danger`; `-surface` -> `--danger-soft`; `-border` -> color-mix of `--danger`; `-strong` -> `--danger-text`
- `--color-code-surface`, `--surface-code` -> `--code-bg`; `--color-code-text`, `--content-code` -> `--text`
- `--color-overlay` -> color-mix of `--canvas` over transparent
- `--shadow-panel`, `--shadow-control` -> `--shadow-sm`; `--shadow-popover`, `--shadow-modal` -> `--shadow`
- `--font-family-sans/mono` -> `--font-sans/--font-mono`; `--font-weight-normal` -> `--font-weight-regular`; `--motion-ease` -> `--motion-easing`
- `var(--x, #fallback)` fallbacks were dropped.
- Colour literals (hex/rgb/rgba, about 300 lines): mapped by property and by hue family (success/warning/danger/accent, slate greys treated as neutral) to the tokens above, tints as `color-mix(in srgb, var(--token) N%, var(--surface|transparent))`. Box-shadows with a literal became `--shadow` / `--shadow-sm`, or an accent `color-mix` ring for focus rings.
- Gradients (11, none allowed) became a flat `--surface-muted`, `--surface-raised` or a warning `color-mix` tint; the flow-editor and state-canvas grid/checker backgrounds are now flat; the skeleton shimmer is now an opacity pulse (`skeleton-pulse`).

### Kept as panel tokens (non-colour only)
`app/styles/global-foundation/01-tokens-and-reset.css` keeps the type scale, spacing, control heights, radii, border widths, motion, layers. It defines no colour, no shadow and no font family. The focus ring now uses `--focus`, `--focus-width`, `--focus-offset`.

### Files changed
- CSS: every `*.css` under `apps/web/src` that used a panel token or literal (about 55 files, including `app/styles/**`, `features/automation-studio/styles/**`, `features/flows`, `home`, `runs`, `security`, `settings-page/ui/settings-page.css`, `accounts.css`).
- `features/chat-widget/chat-widget.css`: the `.chat-widget-host` token remap and `color-scheme: light` removed; only layout stays.
- `features/chat-widget/tests/chat-widget-tokens.test.ts`: deleted. Replaced by `apps/web/src/tests/panel-tokens.test.ts`.
- `app/layout.tsx`: imports `fonts.css` and `tokens.css`; `suppressHydrationWarning` on `<html>`; inline `themeInitScript` is the first child inside the body provider (see Open questions for why not `<head>`).
- TS colour literals: `flow-editor/components/FlowEdge.tsx` (`var(--accent)`), `graph/ports.ts` and `graph/viewport-store.ts` (`var(--...)` strings). `graph/tests/viewport-store.test.ts` updated for the two minimap colours it asserted (`#b35c00` -> `var(--warning)`, `#d13212` -> `var(--danger)`). Port tones with no brand equivalent now share tokens (boolean=success, number=accent-text, text=text-soft, object=muted, signal=warning-text, routine=danger-text, flow=accent, neutral=text-dim); CSS tone colours match.
- Appearance: new `features/settings-page/appearance/` (`AppearanceSection.tsx`, `apply-theme.ts`, `parse-theme.ts`, `read-theme.ts`, `theme/{choice,choices,init-script,storage-key,index}.ts`, barrel, `tests/theme.test.ts`), wired into `ui/SettingsPage.tsx` and `settings-page/index.ts`. Storage key `fluxiq-theme`, every access in try/catch (`applyTheme` returns false when storage is blocked), dark when nothing is stored.
- `docs/architecture/ui-theme.md`: new "One Token System" section; blue/orange/`--color-*`/`--surface-shell...` lines corrected.
- `.structure-baseline.json`: untouched (nothing to shrink from my changes).

## Commands run and observed results
- `grep -rnE "#[0-9a-fA-F]{3,8}\b|rgba?\(|gradient\(" apps/web/src --include=*.css | wc -l` -> `0`.
- `pnpm exec vitest run src/tests/panel-tokens.test.ts` (apps/web) -> 4 passed (finds tokens, no clash, no literal/gradient, every `var(--x)` resolves unless it carries its own fallback).
- `pnpm --filter @fluxiq/web exec vitest run src/tests src/features/chat-widget src/features/settings-page src/app` -> first run: 108 files passed, 2 failed (`app/product/tests/layout.test.tsx`, `session-reauthentication` test) because I had put the script in `<head>`. After moving it, `vitest run src/app/product/tests/layout.test.tsx src/app/session-reauthentication src/tests src/features/chat-widget src/features/settings-page/appearance` -> 21 files, 135 tests passed. Final re-run after the appearance restructure: `src/features/settings-page/appearance src/tests` -> 4 files, 14 tests passed. I did not re-run the whole acceptance set once more after the restructure.
- `pnpm structure:check` -> first run had 2 violations of mine (naming prefix `theme-`, swallowed catch); fixed. Final: 1 violation, `[swallowed-failure] apps/web/src/server/provisioning-listener/platform-services.ts line 55` (not my file).

## Not verified
- No browser look: dark/light/system appearance, contrast of the remapped colours, the flash-free inline script, the Settings radio group, and the studio canvases (now flat) were not seen.
- No apps/web typecheck (supervisor runs it). TS edits are string-only plus new small modules.
- Tone/hue mappings were done by a script; individual studio components (flow editor, state canvas, recordings) deserve a visual pass for lost distinctions (several data-type hues collapsed onto the single amber / status colours).
- Package vitest suites beyond the named directories were not run.

## Open questions or contradictions found
- Script placement: the brief says "tiny inline script in app/layout.tsx". `app/product/tests/layout.test.tsx` expects `<html lang="en"><head></head><body>` and `session-reauthentication` reaches the provider via `.props.children` chains, both outside my owned paths. So the script is the first child inside `<body>`'s provider, which still runs before any content paints. Moving it to `<head>` needs those two tests changed.
- Not mappable by name: `--port-color`, `--port-bg`, `--state-visual-color`, `--state-overlay-accent`, `--action-preview-accent` are component-scoped custom properties kept in the panel; their values are only package tokens or color-mix of them. The guard bans literals, not these names. Also `--state-direct-*` and `--automation-runtime-part-depth` are set from TSX and are used with fallbacks (the guard exempts uses with a fallback).
- `features/settings-page/tools/docs/model/sandboxedDocumentationHtml.ts` left as is: it styles a sandboxed iframe document that cannot see `:root`.
- `.structure-baseline.json` has pre-existing uncommitted changes from other lanes; I did not touch it.
- `apps/web/e2e/chat-widget.spec.ts` (not mine) may still reference the old light colours; worth a grep.
- The structure violation in `server/provisioning-listener/platform-services.ts` belongs to another lane.
