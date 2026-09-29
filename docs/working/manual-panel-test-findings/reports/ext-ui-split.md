# ext-ui-split: split the extension panel UI into per-view modules

Status: SUPERSEDED by Workstream A (see ext-ws-a.md). The popup-local split below is being folded into apps/extension/src/panel/.

## Outcome

Pending.

## Progress log

- Baseline: `apps/extension/src/popup/` and `sidepanel/` clean at HEAD 260a4e17.
- Baseline `node scripts/structure-audit.mjs` -> `structure-audit: passed (109 warning(s), 120 baselined).`
- Ordering constraint: `popup/extraction/panel.ts:265` adds a `document` keydown listener at mount,
  so the settings Escape listener must stay registered after `mountExtractionPanel()`.
- Design: shared app under `popup/app/` (inside owned paths); each view dir has `<x>-elements.ts`
  (lookup), `<x>-view.ts` (render + `bind()`), `index.ts`. Shell order: all lookups -> extraction
  mount -> refresh -> timer -> layout -> binds, preserving the original listener order per target.
- Written so far: app/element.ts, panel-state.ts, panel-surface.ts, format/ (+tests), transport/,
  status/, settings/, pairing/. Remaining: recording, runtime, activity, recordings, errors,
  navigation, shell (mount-panel-app.ts), app/index.ts, popup/index.ts, sidepanel/index.ts.
- All code written (all modules, shell, barrel, both entries).
- Validation of the popup-local split, before it was superseded:
  - `pnpm --filter @fluxiq-web-extension/extension check` -> tsconfig.json clean, all 5 bundles built; tsconfig.test.json failed ONLY on
    untracked `e2e/content/tests/extraction/tests/everything-store-cart.spec.ts(37,18): error TS2352` (not owned; concurrent worker).
  - `EXTENSION_TEST_BUILD_LABEL=ext-ui-split node scripts/test-extension.mjs` -> exit 0, `# tests 852`, `# pass 852`, `# fail 0`.
  - `pnpm --filter @fluxiq-web-extension/extension build` -> exit 0; popup/index.js 216.1kb, sidepanel/index.js 216.1kb.
  - `node scripts/structure-audit.mjs` -> `structure-audit: passed (108 warning(s), 120 baselined).`
  - `npx playwright test -c e2e/playwright.config.ts` -> `12 passed (20.3s)`.
- Coordinator changed plan: execute Workstream A from ext-ui-audit.md instead. Continued in ext-ws-a.md.

## What changed and why

Pending.

## Commands run and observed results

Pending.

## Not verified

Pending.

## Open questions or contradictions found

Pending.
