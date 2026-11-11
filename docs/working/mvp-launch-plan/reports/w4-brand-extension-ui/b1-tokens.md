# W4-B1 report: brand tokens in Core ui-components (lane t900)

## Outcome
Done. Nothing committed.

## What changed and why
All under `!FluxIQ/packages/ui-components` (worktree fxwork/t900):
- `src/theme/tokens.css` rewritten: dark brand is the default (`:root { color-scheme: dark }`); every colour is a single `light-dark(light, dark)`; `data-theme="light"` -> `color-scheme: light`, `data-theme="system"` -> `light dark`. Shadows carry `light-dark()` on the colour inside. All 39 pre-existing custom property names are kept; the new I2 names are added (`--text-soft --text-dim --line --edge --accent-hover --accent-edge --accent-wash --accent-row --accent-ink --font-sans --font-mono --focus-width --focus-offset`). `--chat-font`/`--chat-mono` now alias the font tokens; `:root` font-family is `var(--font-sans)`.
- `src/theme/fonts.css` (new) holds the two @font-face rules (weight 100 900, swap, relative url); `src/theme/fonts/` holds geist-latin.woff2, geist-mono-latin.woff2, OFL.txt (copied from the website repo).
- `package.json`: export `./styles/fonts.css`; `files` gains `src/theme/fonts.css` and `src/theme/fonts`. Version untouched.
- `README.md`: new Theme section (dark default, data-theme, fonts.css import, token list, contrast table, OFL note); the old sentence now points to it.
- `src/chat/chat.css`: NOT changed. It already reads fonts only through `--chat-font`/`--chat-mono` (or `inherit`) and focus only through `var(--focus)`, so the token change reaches it; outline-offsets untouched.

## Token table (dark / light)
| token | dark | light |
| --- | --- | --- |
| canvas | #0c0d0f | #f6f3ee |
| surface | #111214 | #fffdf9 |
| surface-raised | #16171a | #efebe4 |
| surface-muted | #0f1012 | #f1ede6 |
| divider | #23252a | #ddd8ce |
| line | #1b1d21 | #e6e1d7 |
| edge | #2e3035 | #c9c3b6 |
| text | #e8e6e3 | #16130d |
| text-soft | #d6d3ce | #3d3a34 |
| muted | #b5b2ac | #5c584f |
| text-dim | #8c8a85 | #6b665c |
| accent (fill) | #f5b83d | #f5b83d |
| accent-hover | #ffc95c | #e8a620 |
| accent-edge | #5a4618 | #e3c379 |
| accent-wash | #15130d | #fcf5e2 |
| accent-row / accent-soft | #1a1710 | #fbefd0 |
| accent-text | #f5b83d | #6e4a00 |
| accent-ink | #0c0d0f | #0c0d0f |
| success | #7fc99b | #1d6f40 |
| warning / -soft / -text | #f5b94a / #1a1710 / #f5b94a | #8a5a00 / #fdf1d6 / #6b4500 |
| danger / -soft / -text | #fa6571 / #1d1315 / #fa6571 | #b92b38 / #fdeaec / #9b1f2c |
| neutral-dot | #8c8a85 | #6b665c |
| focus | #f5b83d | #8a5a00 |
| hover | #1b1d21 | #e8e3da |
| bubble / code-bg | #16171a / #0a0b0d | #efebe4 / #efebe4 |
| composer / composer-focus | #111214 / #3a3c42 | #fffdf9 / #b5ae9f |
| send / send-text | #f5b83d / #0c0d0f | #f5b83d / #0c0d0f |
| send-off / send-off-text | #1b1d21 / #8c8a85 | #e6e1d7 / #5c584f |
| shadow | 0 12px 32px rgb(0 0 0/48%) | same, rgb(22 19 13/16%) |
| shadow-sm | 0 1px 4px rgb(0 0 0/40%) | same, rgb(22 19 13/8%) |

Non-colour: focus-width 2px, focus-offset 4px, font-sans/mono as specified.
Decision note: `--accent`, `--send`, `--send-text`, `--accent-ink` are the same in both themes (amber fill with ink text works on either ground); amber-as-text is `--accent-text` (darker in light).

## Contrast (dark / light), computed with WCAG relative luminance
text/canvas 15.61/16.75; text/surface 15.05/18.24; text-soft/surface 12.56/11.15; muted/canvas 9.19/6.40; muted/surface 8.86/6.97; muted/surface-raised 8.47/5.96; text-dim/surface 5.43/5.62; accent-text/surface 10.54/7.82; accent-text/accent-soft 10.06/6.95; accent-ink (and send-text)/amber 10.93/10.93; success/surface 9.58/6.08; warning/surface 10.64/5.83; warning-text/warning-soft 10.15/7.56; danger/surface 6.39/5.96; danger-text/danger-soft 6.20/6.91; send-off-text/send-off 4.89/5.44; text/bubble 14.39/15.60; text/code-bg 15.81/15.60. All >= 4.5. Listed in tokens.css comment and README. Script: scratchpad w4b1-contrast.mjs.

## Commands run and observed results
- `pnpm exec vitest run src/chat/view/tests/styles.test.ts` (in packages/ui-components): 1 file, 3 tests passed.
- Old names (from `git show HEAD:...tokens.css`, 39) each grepped in new tokens.css: no MISSING lines.
- `node scripts/structure-audit.mjs` (repo root): `structure-audit: passed (529 warning(s), 969 baselined).` exit 0; warnings are the existing file-lines advisories, none from the files I touched except chat.css (pre-existing, unchanged).
- Free RAM before tests: 3.24 GB.

## Not verified
- No browser render of light-dark() / fonts; apps/web chat-widget-tokens test not run (expected to fail on new names, left alone per brief).
- Font files load via relative url only checked by path existence, not by a bundler build.
- light-dark() needs Chrome/Edge 123+, Firefox 120+; older engines drop the declarations.

## Open questions
None.
