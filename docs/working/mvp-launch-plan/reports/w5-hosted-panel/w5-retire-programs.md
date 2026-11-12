# w5-retire-programs (lane t901, W5 P4)

## Outcome
Partial-complete: the legacy /programs UI, its CSS and its e2e routes are retired, redirects are in, Settings no longer links to /programs. Not everything the brief hoped for could move: the shared UI library and program-api layer must stay at `features/programs/` because features I must not touch (automation-studio, chat-widget, flows) import them by that path. Three links to /programs remain in files I do not own (see Open questions).

## What changed and why
Removed:
- `apps/web/src/app/programs/[programId]/**` (page, ProgramWorkspace, ProgramLiveViews, error, loading, 2 tests).
- `features/programs/`: `live-views/**` and `live-views.tsx`, `ProgramLiveViews.tsx`, `database-records/`, `documentation-tree/`, `documentation-workspace/`, `operational-payloads/`, `operational-refresh/`, `production-parameters/`, `secret-scope-catalog/`, `program-selection.ts` (+ test). Proof: import closure from every non-programs file; nothing outside the removed UI imported them.
- `features/programs/tests/global-request-contract.test.ts` cut to its one surviving assertion (program-api coordinator); `phase7-responsive-contract.test.ts` no longer reads the deleted global-programs CSS.

Kept in place (not moved), because a move needs edits in must-not-touch features: `components/**` (+tests), `shared-ui.tsx`, `program-api.ts`, `program-auth-recovery.ts`, `program-request-coordinator.ts`, `types.ts`, `ui-performance*.ts`, `overlay-environment.ts`, `use-operation-lock.ts`, `css-manifest-test-helper.ts` and the contract tests. Importers: AuthShell, GlobalClientGatewayPairing, layout, session-reauthentication, automation-studio (about 60 files), chat-widget, flows, settings-page, e2e/support/performance.ts. Follow-up: once those lanes are free, move this library (it is now the shared UI + program-API client, not "programs") per code-structure.md.

CSS: rule-level pruning by class-usage proof (a rule goes only when every selector names a class that appears in no remaining non-test source string). Deleted whole: 07-program-launcher, 11-totp-enrollment, 14-json-and-callouts, 17-database-explorer, global-secret-management, global-programs/01..05 (and the 06 file stays with its 3 used rules). Pruned in part: 02, 03, 04, 05, 06, 08, 09, 10, 12, 13, 15, 16, 18, global-responsive-certification, global-shared-controls. `app/globals.css` imports updated. A global `* { max-width: 100% }` rule that sat inside 16-docs-workspace.css has no class and was kept as is (file name is now a misnomer).

Redirects (`next.config.ts`, non-permanent, query kept by Next): existing four kept; added `/programs/identity-access` and `/programs/secret-keys` -> `/security`, `/programs/:path*` -> `/settings` (after automation-studio entries, so bare `/programs` and every other id land on Settings). Comment updated.

Settings: `ENGINE_TOOLS` was nine /programs links; now one entry, Security -> `/security` (identity-access and secret-keys' new home). The other seven have no screen, so their links are removed. `engineToolHref` removed; test updated. AuthShell's "Account and access" menu item now points to `/security`.

e2e (not run): panel-redirects (new redirects, KEPT list cut to /setup /welcome /reset, two signed-in tests for Security and Settings), surface-matrix (program pages replaced by /security and /settings; Technical Details test removed), accessibility-baseline (loops /security and /settings), panel-settings (Advanced shows one Security link). Test fixtures: AuthShell/AuthStatus/SessionReauthentication tests no longer use /programs paths; `app/tests/route-recovery.test.ts` dropped the deleted program error/loading files (outside the owned list, but it asserted removed files).

Structure baseline: `pnpm structure:baseline` (52 entries removed, 1 lowered).

## What of each program's UI is no longer in the panel
| Program | Old page | Now |
| --- | --- | --- |
| background-tasks | /programs/background-tasks | Gone (redirect to /settings); no screen |
| compute-control | /programs/compute-control | Gone; no screen |
| database-manager | /programs/database-manager | Gone; no screen (Data screen is separate) |
| deployment-sync | /programs/deployment-sync | Gone; no screen |
| docs | /programs/docs | Gone; no screen |
| runtime | /programs/runtime | Gone; no screen |
| production-runner | /programs/production-runner | Gone; no screen |
| identity-access | /programs/identity-access | Gone; redirect to /security (Security screen owns people/roles/sessions) |
| secret-keys | /programs/secret-keys | Gone; redirect to /security (keys live in Security and Settings) |
| automation-studio | /programs/automation-studio | Unchanged redirects (/flows, /?chat=open) |
All their `/api/programs/**` routes stay.

## Commands run and observed results
- `pnpm structure:baseline` -> "baseline written: 917 entries across 13 rules (1 lowered, 52 removed)".
- `pnpm structure:check` -> "structure-audit: passed (526 warning(s), 917 baselined)".
- `grep -rn "/programs/" apps/web/src --include=*.ts --include=*.tsx` (excluding `/api/programs`, package-internal and import paths) -> no link in files I own. Remaining hits listed below.
- `pnpm --filter @fluxiq/web exec vitest run src/app src/features/settings-page src/lib src/features/programs` (free memory 2896 MB) -> 88 files passed, 2 failed: route-recovery (fixed, see above) and `lib/workspaces/tests/web-workspaces.test.ts` (timeouts and EBUSY unlinking a temp sqlite file under load).
- `vitest run src/app/tests src/lib/workspaces` rerun -> 9 files, 94 tests passed.
- chat-widget-tokens test was not in these paths, so not seen.

## Not verified
e2e (not run per brief); apps/web typecheck (supervisor); a Next build with the new redirects; that the pruned CSS leaves no visual change (no browser run). `/security` h1 text "Security" assumed in the e2e assertions. The chat-widget.spec.ts steps that go to `/programs/secret-keys` now follow the redirect to /security; I did not check that the key-snapshot poll they wait on fires there.

## Open questions or contradictions found
- Still linking to /programs (redirects cover them, but they are not panel links I may edit): `features/automation-studio/authorization/PinRequirementNotice.tsx` (identity-access), `features/automation-studio/settings/ai-provider-model.ts` (secret-keys; its test and `app/product/tests/OnboardingCards.test.tsx` assert it, and OnboardingCards' "Add your model key" card uses it), `features/chat-widget/navigation/panel-open-control.ts` (secret-keys, automation-studio). Point them at /security and /flows to finish.
- The shared UI/program-API library should move out of `features/programs/` (see above).
- `app/auth-navigation/tests/localAuthDestination.test.ts` still uses /programs/... strings as arbitrary local destinations (not owned).

Outcome: Partial
Changed: apps/web/src/app/programs (deleted), apps/web/src/features/programs (pruned), apps/web/src/features/settings-page/{model,ui}, apps/web/src/app/styles/**, apps/web/src/app/globals.css, apps/web/next.config.ts, apps/web/src/app/{AuthShell.tsx,tests,session-reauthentication/tests}, apps/web/src/lib/resolve-setup-domain.ts, apps/web/e2e/{panel-redirects,surface-matrix,accessibility-baseline,panel-settings}.spec.ts, .structure-baseline.json
