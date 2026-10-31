# t814 E/D5 resumed verification

Outcome: Done within the assigned resume scope. Final fixes verified; no git mutations.

Changed in paired Core checkout: `packages/fluxiq/src/platform/panel/host-modules/load-platform-host-modules.ts`, `loaded-host-modules-store.ts`, `tests/host-modules.test.ts`; `apps/web/src/app/session-reauthentication/tests/SessionReauthentication.test.tsx`; `docs/architecture/platform.md`. Downstream source unchanged; this own report is in the main checkout as requested.

## Changes and review

- Verified the existing registry test's corrected provisioning import through passing registry tests (11 tests).
- The SessionReauthentication provider nesting fix was correct, but rerunning uncovered another stale assertion: it invoked `GlobalTopbar` directly after that component gained a branding hook. Changed the test to render through React and inspect the rendered tree instead, with Next Link mocked as an anchor to avoid browser-only idle callbacks in this Node unit test. All eight owning tests now pass.
- Added a regression proving simultaneous host-module loads previously registered twice. The regression failed before the fix. The loader now stores its in-flight promise globally before imports resume; concurrent callers share one result and a failed load remains failed rather than repeating partial registrations. Added failure-retention coverage and updated Core's authored platform architecture.
- Reviewed the product asset route and registry boundary: only manifest-declared files can be served; the contracts schema rejects paths and unsupported extensions; the registry validates the directory and declared files at registration. SVG responses carry CSP and all asset responses use nosniff. Route tests cover declared/undeclared names, traversal strings and missing files.
- Confirmed the existing Next build artifact lists `/product/assets/[name]/route` in `apps/web/.next/server/app-paths-manifest.json`. No Next build was run.

## Validation observed so far

Commands run in `fxwork/t814/!FluxIQ` unless stated otherwise. Use `pnpm.cmd` because this PowerShell session refuses `pnpm.ps1`.

- `pnpm.cmd --filter fluxiq exec vitest run src/platform/panel/host-modules/tests/host-modules.test.ts` before fix: 7 passed, 1 failed (concurrent callers received different results).
- `pnpm.cmd --filter fluxiq exec vitest run src/platform/panel` after fix: 4 files / 32 tests passed.
- `pnpm.cmd --filter fluxiq check` after loader fix: exited 0 (64,593 ms, stamped). An earlier run passed but was unstamped because test input changed during execution.
- `pnpm.cmd --filter @fluxiq/web check`: final rerun after recovery-test correction exited 0 (69,378 ms, stamped). Earlier passes included a stable-output run and an unstamped run while source/dist changed.
- `pnpm.cmd structure:check`: downstream exited 0 (234 warnings, 616 baselined). Final Core `node scripts/structure-audit.mjs 2>&1 | Select-String 'FAIL|structure-audit:'; exit $LASTEXITCODE`: exited 0 (469 warnings, 1152 baselined). An intermediate Core audit caught statement-packing in the new regression test; reformatted, then passed.
- `pnpm.cmd docs:check` after architecture update: passed (reference current).
- `pnpm.cmd --filter fluxiq test src/platform`: parallel group passed 46 files / 422 tests; real-SQL group passed 17 tests and failed one timeout in `IamAuditStore > keeps 10,000 polling-like allow rows under 80 bytes each` (test and cleanup exceeded 15 seconds). No storage source or timeout changed.
- `pnpm.cmd --filter fluxiq test src/platform/iam/audit/tests/store.test.ts` isolated rerun: all 7 passed (2.28 seconds); the former failing case took 1.89 seconds, stored 29.9 bytes/row and read the expected 500 rows in 9.2 ms. Timeout did not reproduce.
- Downstream `node scripts/check/model-text.mjs`: passed (208 scenario tokens, 384 model-facing Core files, 11989 string literals).
- `pnpm.cmd --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/client-gateway-websocket build`: final stable-input refresh passed and stamped (141,081 ms for Core; contracts and gateway reused). First rebuild completed successfully (169,107 ms), but subsequent product gate detected the regression-test formatting drift; the final refresh resolved it.
- Downstream `pnpm.cmd --filter @fluxiq-web-extension/product test`: all 11 tests passed; freshness gate explicitly confirmed paired Core current with source.
- Downstream `pnpm.cmd --filter @fluxiq-web-extension/product check`: exited 0; freshness gate confirmed current Core, then TypeScript passed.
- First affected web test batch passed 7 tests in 2 files, then 4 suites failed to import a compiled module while Core's library rebuild was running; this first run is not acceptance evidence.
- `pnpm.cmd --filter @fluxiq/web exec vitest run src/app/product src/app/session-reauthentication src/app/tests/HomePage.test.tsx` after complete library build: 5 files passed; 1 failed (26/27 tests passed). The remaining failure was the direct component invocation described above; its owning file subsequently passed after correction.
- `pnpm.cmd --filter @fluxiq/web exec vitest run src/app/session-reauthentication/tests/SessionReauthentication.test.tsx` after correction and scoped Link mock: all 8 tests passed. Intermediate render attempt exposed `self is not defined` in Next Link's idle callback, fixed by the mock. Product/HomePage files passed their 19 tests in the preceding batch; together these cover all 27 affected web tests.
- `node scripts/structure-audit.mjs --rule statement-packing` after the final recovery-test change: passed (0 warnings, 450 baselined).
- `git diff --check` in paired Core: passed (only standard LF/CRLF conversion warnings).

## Remaining boundaries

- No full suites, Next build, browser render, paid calls, panel management, git mutations or shared working-document edits.
- Later t813-dependent host/provisioning/email/discovery wiring was deliberately not implemented, as instructed.
- Existing seed-project owner assignment still needs the Core public ownership seam identified in the previous report; this resume did not change that API or claim the owner is assigned.
- Acquired `lab-slots/heavy-check.lock` for the heavy batch, checked its owner marker, released it after final library refresh and notified the lead. No checks/processes remain running from this resume.

## Lead completion of the authored D5 requirement

The ownership limitation above was a worker scope boundary, not a phase deferral. The lead commissioned a second review and completed the required owned seed through an additive public trusted-host Core helper (db4192ca) and serialized product initialization (eea545f0). The helper reuses creator persistence, needs no fabricated session and cannot replace another recorded creator. Retried initialization repairs a partial seed without duplication; concurrent callers preserve their own outcomes.

Independent lead acceptance: Core ownership36 and product18 passed, including real service-IAM owner/non-owner checks; Core/product/web typechecks passed after the public export; earlier panel32 and web27 passed after parent integration. Models remain provider-free; browser render, later C2/C3 lifecycle wiring and the final full sweep are separate. Details: `t814-ownership-fix-result.md`.
