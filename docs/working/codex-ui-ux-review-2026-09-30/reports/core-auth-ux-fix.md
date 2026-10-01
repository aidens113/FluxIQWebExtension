# Core authenticated shell recovery fix

Status: Implementation and worker validation complete; source/report frozen for supervisor verification in isolated paired t224. No commits/live/browser/provider calls.

## Root cause and change

Generic operational routes rendered AuthStatus rather than GlobalTopbar, leaving no listener for the shared Program API's authentication-required event. An expired request awaited an unresolved recovery promise.

- AuthShell.tsx removes the existing per-topbar host; the exported recovery component now belongs to the focused app session-reauthentication directory.
- Root layout mounts exactly one recovery host only for authenticated users, across all routes.
- Host attaches to existing pending recovery, resolves cancellation on unmount and ignores a late login response after unmount, preserving the mounted workspace/drafts.
- Initial exported host left AuthShell at 280 lines but raised its baselined exported component count from three to four. No baseline increase is allowed.
- Supervisor approved exact new ownership `apps/web/src/app/session-reauthentication/{SessionReauthentication.tsx,index.ts,tests/SessionReauthentication.test.tsx}`; extraction completed, root layout imports the directory barrel. Moved only the new untracked test and restored AuthShell's three component exports. AuthShell/layout and existing AuthShell test remain owned; no additional product paths. Existing source assertion now reads the owning host while confirming AuthShell no longer mounts it.

## Validation

- Initial focused session 49411, web check 58484 and Core audit 83873 were still queued. Exact owner inspection showed other jobs owned all four slots. Only wrappers matching the three exact `codex t224 auth focused tests`, `codex t224 auth web check`, `codex t224 auth Core audit` labels were stopped to allow extraction before any own reader starts. These cancellation exits are not test/build failures. No other process/slot was changed.
- Tests already cover real GET and POST 401 -> restore -> one retry (one successful mutation), retained workspace draft, cancellation, shared waiters, unmount with late login response, pre-host pending recovery, authenticated/signed-out layout composition and no topbar duplication. They have not run yet.
- Resume: finish approved extraction and relocate imports/test; freeze source; run focused AuthShell/recovery/program-api Vitest, `pnpm --filter @fluxiq/web check`, and full `node scripts/structure-audit.mjs` via explicit Git Bash/heavy.sh. Record results; keep unrelated inherited service audit violations unchanged. Root owns authored docs, independent verification and integration. No browser behavior certified.
- Extraction is complete and final source frozen. Fresh focused Vitest session 89815, web check 43373 and Core structure audit 95077 are queued under exact `codex t224 auth final ...` labels. All use `C:/Program Files/Git/bin/bash.exe C:/Users/osrs_/FluxStuff/build-slots/heavy.sh`. Poll those existing sessions; do not repeat while queued. `git diff --check` passed before freeze.
- Audit 95077 exited 1: new extracted host's inherited JSON catch-to-undefined became an unbaselined failure-as-empty violation; unchanged Core service remains 4,506 lines against baseline 4,505. Corrected only the host: malformed login JSON now produces a fixed human-readable error, keeps the recovery open and does not publish server content. Added behavior regression for retry/cancel ownership after malformed response. No baseline change.
- Focused 89815 and check 43373 were still queued; exact-label wrappers were stopped after verifying neither held a slot. These runs were invalidated/cancelled before the scoped correction. New corrected source is frozen: focused 14460 queued; web check 63565 and Core audit 28474 acquired slots. Resume by polling these sessions. Product source must remain static until they finish.
- Corrected `pnpm --filter @fluxiq/web check` (63565) exited 0, 66,871 ms. Corrected full `node scripts/structure-audit.mjs` (28474) exited 1 with exactly one inherited file-lines violation: unchanged service.ts 4,506 vs baseline 4,505. The extracted host's failure-as-empty finding is resolved; no new structure violation remains. Focused Vitest 14460 still queued.
- Corrected focused command `pnpm exec vitest run src/app/tests/AuthShell.test.tsx src/app/session-reauthentication/tests/SessionReauthentication.test.tsx src/features/programs/tests/program-api.test.ts` (14460) exited 0: three files, 17 tests passed (4 AuthShell, 8 recovery behavior, 5 Program API), 15.33 seconds. No failures/skips/timeouts. Existing test renderer emits its deprecation warning; no product/browser execution was performed.
- `git show HEAD:packages/fluxiq/src/programs/automation-studio/runtime/service.ts` has 4,506 lines; normalized HEAD/current contents are equal. Unrelated inherited violation and baselines remain untouched. `git diff --check` passed.
- TEMP evidence: `C:/Users/osrs_/AppData/Local/Temp/codex-t224-auth-focused.log`, `codex-t224-auth-web-check.log`, `codex-t224-auth-structure.log`. Focused log includes observed full results; web-check log contains final cache summary; structure log contains the complete audit. Root's broader production build/independent checks are separate and not claimed here.

## Final changed-file inventory

Core owned paths:

- `apps/web/src/app/AuthShell.tsx`
- `apps/web/src/app/layout.tsx`
- `apps/web/src/app/tests/AuthShell.test.tsx`
- `apps/web/src/app/session-reauthentication/SessionReauthentication.tsx`
- `apps/web/src/app/session-reauthentication/index.ts`
- `apps/web/src/app/session-reauthentication/tests/SessionReauthentication.test.tsx`

Downstream only this report. The separate discovery report was finished before this brief. Supervisor owns current-system documentation, shared plan/index updates, independent verification and eventual integration; no worker commits or changes to those files.
