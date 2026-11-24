# t994 W4: apps/web sweep failures (worker)

Goal: the two apps/web failures from the 2026-11-23 sweep pass for the right reason: fix the product code the guard tests exist to protect. Never weaken the guard tests, add allow-list exceptions, delete or skip them.
Code: `C:/Users/osrs_/FluxStuff/fxwork/t994/!FluxIQ` (Core, HEAD 2dba34613). Rules: Core `AGENTS.md` (code structure, one token system, Repository Boundary).

Failures (apps/web, sweep log `C:/Users/osrs_/AppData/Local/Temp/claude/bc302d3e1bd85154/b9e846ce-920f-4917-ba85-cff713b3e423/scratchpad/sweep/core-test-clean.txt` lines 16072-16110):
1. `apps/web/src/tests/panel-tokens.test.ts` "holds no colour literal and no gradient": found `app/plans/plans.css: #d4d4d8`, two `rgb(` in `features/panel-shell/panel-shell.css`, one `rgb(` in `features/security/security.css`, a `radial-gradient(` in `features/settings-page/ui/settings-page.css`. Replace each with the package's tokens (`@fluxiq/ui-components/styles/tokens.css`) or a panel-defined custom property that itself resolves to package tokens without literals; keep the rendered intent (read what each literal does). If a needed token truly does not exist in the package, report it rather than adding a literal: token changes belong in `packages/ui-components` and are not yours.
2. `apps/web/src/lib/platform/tests/scope-boundary.test.ts` "lets no app file or lib/auth.ts import the primary instance accessors": `app/api/platform/v1/environments/server/with-environments-route.ts` imports a primary-instance accessor. Read the test to learn the allowed scoped accessor and route that file through it, keeping behaviour.
For each, name the commit that introduced the violation (`git log -p -- <file>`; no checkout, no git mutations).

Owned (may edit): `apps/web/src/**` except the two test files.
Must not touch: `packages/**`, the two guard tests, anything outside apps/web.

Run tests only like this (from `apps/web`), named files only, one heavy job at a time:
`node C:/Users/osrs_/FluxStuff/fxwork/.heavy-slots/heavy-slot.mjs run t994-w4 -- pnpm exec vitest run <files> --maxWorkers=1 --minWorkers=1 --fileParallelism=false`
Also run the tests beside every file you change, and apps/web's own typecheck if it has a `check`/`typecheck` script (through the heavy slot). No `node -e`, no browsers, no paid calls.

Acceptance: both test files pass; tests beside changed files pass; apps/web typecheck passes (or say why not run); `node scripts/structure-audit.mjs` from the Core root passes.
Report: `C:/Users/osrs_/FluxStuff/fxwork/t994/!FluxIQWebExtension/docs/working/data-first-simplification-plan/reports/t994-sweep-fix-core/w4-web.md`: per failure: cause, introducing commit, fix, files changed, exact commands with observed counts. End with the return contract.
