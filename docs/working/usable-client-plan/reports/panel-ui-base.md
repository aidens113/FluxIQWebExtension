# Panel UI base layer (brief 1 of 4, task t915)

## Outcome
Done for the code; screenshot matrix PARTIAL (see Not verified). All paths in CORE = C:/Users/osrs_/FluxStuff/fxwork/t915/!FluxIQ, W = apps/web/src/app.

## What changed and why
- `W/styles/global-foundation/01-tokens-and-reset.css`: replaced the bare `font: inherit` rule with a zero-specificity (`:where`) base layer for `button, input, select, textarea`: token border (`--edge`), `--radius-control`, `--surface` fill, `--text`, placeholder colour, hover (`--hover`, `--accent-edge`), disabled state, custom select chevron (data-URI SVG, mid-grey that reads on both themes; the panel-tokens test bans colour literals and hex, the URI uses an encoded `%23` so it passes), checkbox/radio/range/colour/file excluded. Classed components still win (0,0,0 specificity).
- `09-panels-and-pagination.css`: `.workspace-panel` no longer carries a column span; spans now live under `.program-workspace-grid >`. Cause of defects 1, 2, 7: the spans created 6 to 12 implicit tracks in plain blocks.
- `global-shared-controls.css` (mobile block): the second source of the same bug, `.workspace-panel { grid-column: span 12 }` at narrow widths, re-scoped to `.program-workspace-grid >` (plus `.deployment-sync-shell .workspace-panel` so its halves stack). This is what crushed the Settings/Security header at 390 (measured: `.security` had 12 tracks, 0px most).
- `03-auth-and-fields.css`: (a) `.auth-form label` rules now exclude `.field-label`, so the Password label no longer becomes a grid that pushes the `*` onto its own line (defect 8); (b) a stray `@media (max-width: 480px) {` opened mid-file swallowed the whole tail (topbar, auth-role, 640px rules) and the mobile login rules; I closed it where it belonged and gave the mobile login block its own query, now top-aligned (`place-items: start stretch`) so there is no large empty gap above the card at 390.
- `AuthShell.tsx`, `not-found.tsx`: no change needed.

## Commands run and observed results
- `pnpm --filter @fluxiq/web exec vitest run src/tests src/app/tests` (maxWorkers flag errors with this vitest config: "minThreads and maxThreads must not conflict", so ran without it) -> 8 files, 59 tests passed (includes panel-tokens, AuthShell). After the last CSS edit: panel-tokens + AuthShell -> 30 passed.
- `pnpm --filter @fluxiq/web check` (tsc) -> exit 0 (before the last shared-controls edit, CSS only).
- `node scripts/structure-audit.mjs` in CORE -> "passed (550 warning(s), 914 baselined)"; note "2 baseline entries can be lowered" (not mine to run `structure:baseline`).

## Screenshots (test-runs/panel-ui-fixes/base/, script shoot-base.mjs)
After: `login-dark-1440.png` (asterisk inline, card styled), `set-runtime-dark-1440.png`, `sec-signin-dark-1440.png`, `set-bg-dark-1440.png`, `set-db-dark-1440.png`, `chats-dark-1440.png` (search field themed), `settings-dark-1440.png`, `home-dark-1440.png`, `sec-signin-dark-390.png` (taken before the last fix, still crushed), `set-db-dark-390.png` (fixed header), `set-bg-dark-390.png`, `chats-light-390.png`, `sec-signin-light-390.png`.
Before (audit): panel-ui-audit/set-runtime-dark-1440.png, sec-signin-dark-1440.png, set-bg-dark-1440.png, set-db-dark-1440.png, chats-dark-1440.png, probe.png, m-login-error-light-390.png.
Observed: header row no longer crushed; ghost 5px block gone on Security sign-in; project switcher and Chats search now themed (switcher is partly the shell worker's change).

## Not verified
- The full matrix (light/dark x 1440/390 for defects 1, 2, 5, 6, 8) is incomplete: the shared dev server took 40 to 90+ s per route under load, `/flows` timed out repeatedly, so Flows and most light-theme shots are missing. Light 1440 and login 390 not captured.
- Native select arrow and hover/disabled states not looked at in a screenshot; no AuthShell 390 shot after the fix.
- A client-pairing modal from a real extension overlaid `set-bg-dark-1440.png`; not approved or rejected.

## Open questions
- Other `.workspace-panel` selectors (`global-responsive-certification.css` 7, 81, 120, 151) are padding/min-height only; left as is.
