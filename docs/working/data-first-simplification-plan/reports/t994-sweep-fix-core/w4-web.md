# t994 W4: apps/web sweep failures

Outcome: Done. Both guard tests pass; no test, allow-list or token file touched.

## 1. panel-tokens "holds no colour literal and no gradient"
Cause: five literals in panel CSS. Introducing commits: plans.css `#d4d4d8` 92f45c26f (2026-11-18); panel-shell.css and security.css `rgb(` dee11cc75 (2026-11-17); settings-page.css radial-gradient 6fd230cb9 (2026-11-18).
Fix (all use package tokens in `packages/ui-components/src/theme/tokens.css`, none added):
- plans.css: `var(--border, #d4d4d8)` -> `var(--divider)` (`--border` is not a defined token; the fallback was what rendered).
- panel-shell.css: menu shadow `0 6px 20px rgb(0 0 0 / .18)` -> `var(--shadow)`; hover `var(--hover, rgb(...))` -> `var(--hover)`.
- security.css: tab hover fallback removed -> `var(--hover)`.
- settings-page.css: radio dot gradient -> `background: var(--accent); box-shadow: inset 0 0 0 3px var(--surface-muted)` (same ring-and-dot look, ~9px dot).
Note: panel-shell menu shadow is now the token's larger/stronger shadow (theme-aware) rather than a fixed black one: a small visual change.

## 2. scope-boundary
Cause: `with-environments-route.ts` dynamically imported `getFluxIQAfterReload` from lib/fluxiq to find the platform root for the environment store. Introduced by f5da86d31 (2026-11-19).
Environments are platform-scope (store lives at primary root), so the workspace context's `fluxiq` would be wrong for non-primary workspaces; the route now asks a server module instead.
Fix: new `apps/web/src/server/environments/platform-environment-store.ts` (`getPlatformEnvironmentStore()`, lazy import of lib/fluxiq, same behaviour), exported from `server/environments/index.ts`; the route calls it. `src/server` is outside the test's scan, as the other primary-instance users already are.

## Files changed
apps/web/src: app/plans/plans.css, features/panel-shell/panel-shell.css, features/security/security.css, features/settings-page/ui/settings-page.css, server/environments/index.ts, server/environments/platform-environment-store.ts (new), app/api/platform/v1/environments/server/with-environments-route.ts.

## Commands (all via heavy slot)
- vitest on panel-tokens, scope-boundary, environment-routes, panel-shell-css, no-pin, SettingsPage, server/environments/tests: 9 files, 33 tests passed.
- `pnpm run check` (apps/web tsc): exited clean, no errors (build-cache did not stamp because packages/fluxiq changed meanwhile by other workers).
- `node scripts/structure-audit.mjs` from Core root: "passed (569 warning(s), 903 baselined)".

## Not verified
No browser look at the radio dot or menu shadow. No new test for the new helper (covered by environment-routes test).
