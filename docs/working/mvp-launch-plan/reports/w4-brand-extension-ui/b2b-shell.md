# B2b shell report

Outcome: Partial (work done; two acceptance commands blocked by environment/B2a-side issues).

## What changed and why
- New apps/extension/src/panel/icons/logo-mark.ts (createElementNS, aria-hidden, strokes currentColor, node class `logo-node`), exported from icons/index.ts.
- shell/top-bar.ts: CSS "F" replaced by logoMark(24); wordmark h1 stays the name.
- shell/shell.css: Geist via --font-sans on body; brand-mark is now plain (no amber tile), node filled --accent; tabs dim/active semibold, no pill; gear active = amber text; 6px connection dot; secondary buttons 1px --edge transparent; primary = --accent fill + --accent-ink, hover --accent-hover; cards use --line; removed notice shadow (1px --edge instead); no hardcoded colours.
- getting-started.css: #ffffff -> --accent-ink / --canvas on green; recording.css: #fff -> --canvas on danger, var(--border,#bbb) -> --edge, scrim -> color-mix(in srgb, var(--canvas) 72%, transparent).
- No mono connection label added: the bar only has the dot (aria-label carries the sentence); a label would crowd 360px. Say if wanted.
- All class/id/selectors kept; popup 380x580 sizing untouched.

## Commands and results
- grep literals over the six css files -> none left.
- test-extension panel/tests/css-tokens.test.ts -> pass 1, fail 0.
- test-extension panel/shell/tests/top-bar.test.ts -> pass 3; screen-state.test.ts -> pass 5.
- test-extension panel/shell/tests (whole dir) -> BUILD FAILS: esbuild "No loader configured for .woff2" from Core fonts.css, pulled in by the new `@import fonts.css` in panel/theme/tokens.css (other worker). Test bundler (APP/scripts) needs `loader: {".woff2": "file"}` like build-extension.mjs has.
- check-extension -> fails: popup bundle cannot read Core ui-components dist/chat/stream/step/brief-wait.js (Core dist stale/unbuilt), plus TS2307 for @fluxiq-web-extension/domain/node in packages/test-runner. Environmental, not from these edits.
- node scripts/structure-audit.mjs -> "passed (245 warning(s), 552 baselined)".

## Not verified
Visual rendering at 360-400px and popup (B5); full shell dir test and check once the woff2 loader and Core dist are fixed.

## Open
Test bundler woff2 loader (B2a scripts owner).
