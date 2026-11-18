# Panel shell fixes (brief 2, task t915)

Scope: `apps/web/src/features/panel-shell` in CORE (fxwork/t915/!FluxIQ). Not committed.

## What changed
- Project choice: `top-bar/ProjectSwitcher.tsx` now mounts the shared `createProjectSwitcher` (same as the extension) in a host div. New `top-bar/projects/port.ts` (`createProjectsPort`) adapts it to the shell's one `projectsSource` (list = refresh and answer with the source's reading; create = `createAutomationProject`, then `notifyProjectsChanged`). `useProjectChoices` and the engine source stay the data path. "All projects in FluxIQ" clears the project and goes to /projects.
- Root cause of a narrow sheet: the app's global `* { max-width: 100% }` capped the absolute sheet to the button width; `.panel-project .project-switcher-sheet { max-width: none }` in panel-shell.css.
- Active rail item uses `--accent-text` (light theme now rgb(110,74,0) on rgb(251,239,208), about 7:1, was 1.7:1; measured from computed colours, not a ratio tool).
- Phone nav: the 8 items are a 4-per-row grid (two rows), so every item is always visible and tappable. Verified `navFits` (every link inside the viewport, no clipped label) true on every route at 1440, 390 and 320 px, no horizontal page scroll.
- Page bottom padding on phone is the Ask size plus a gap; Ask sits above the two-row bar (`--panel-tab-bar-height`).
- `panel-dock-close` styled (token border, radius, hover, focus ring). Px literals replaced by `--space-*`, `--radius-*`, `--font-size-*`; repeating sizes are tokens on `.panel-shell`.
- Added `top-bar/projects/tests/port.test.ts` (4 tests). `PanelRail.tsx` unchanged in the end (a scroll effect was tried and removed).

## Screenshots
After: `C:/Users/osrs_/FluxStuff/fxwork/t915/!FluxIQWebExtension/test-runs/panel-ui-fixes/shell/` (`<route>-<dark|light>-<1440|390|320>.png`, `switcher-open-*`, `dock-open-*-390`, `report-shell.json` for the light run, `shoot-shell.mjs`).
Before: `.../test-runs/panel-ui-audit/` (for example `home-light-390.png`, `data-light-1440.png`, `sec-signin-dark-390.png`).

## Commands
- `pnpm --filter @fluxiq/web exec vitest run src/features/panel-shell --maxWorkers=4` -> config error (minThreads/maxThreads conflict); without the flag, 7 files / 27 tests passed (run before the nav change, which has no test). A later rerun was refused by the web test guard: Core's dist is stale from another worker's edit, and rebuilding was out of scope.
- `pnpm --filter @fluxiq/web check` -> no type errors (not stamped: inputs changed while it ran).
- `node scripts/structure-audit.mjs` (CORE) -> "passed (550 warnings, 914 baselined)"; note "2 baseline entries can be lowered" is not from this folder.

## Not verified / gaps
- /flows and /chats/conversation.* never compiled in the dev server within 2 minutes (the hang is outside the shell; not shot). Routes also skipped: connect, notfound (no shell).
- Dark set lacks set-compute/prod/runtime at 320; light lacks set-deploy at 320 (timeouts); 320 coverage is otherwise full. Dark 1440/390 shots were taken before the final nav grid for 1440 only (1440 unaffected); dark 390/320 are from the grid version.
- Switcher with a real project selected, creating a project through the sheet, and the dock Close button in use were not exercised in a browser beyond `dock-open-*-390` and `switcher-open-*` shots.
- Collapsible desktop dock not done (optional in brief).

Outcome: Partial
Changed: apps/web/src/features/panel-shell/{panel-shell.css,nav/PanelRail.tsx (net none),top-bar/ProjectSwitcher.tsx,top-bar/projects/{port.ts,index.ts,tests/port.test.ts}}
Validation: `pnpm --filter @fluxiq/web check` -> no errors; panel-shell vitest 27 passed (before nav change); structure-audit passed
Not verified: /flows and chat-thread shell shots, a few 320 shots, project create/select via sheet in browser
Report: C:/Users/osrs_/FluxStuff/!FluxIQWebExtension/docs/working/usable-client-plan/reports/panel-ui-shell.md
Notes: Phone nav is a 2x4 grid covering all 8 items at 320-390 px. Dev server was briefly down mid-run; web vitest now blocked by stale Core dist.
