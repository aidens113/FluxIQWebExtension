# t813 C1 adversarial lifecycle review

Status: Done; implementation and every requested narrow acceptance check passed. Worker `resume_t813`; implementation was confined to the existing t813 Core worktree. No git mutations, paid calls, panel management, tenant migration, full suites or Next build.

## Confirmed findings and repairs

- An acquire waiting on an eviction could resume after shutdown/delete began and open a new instance outside the shutdown snapshot. Lifecycle checks now run after both close and construction waits; closed managers cannot create or replace a primary.
- A failed eviction/delete close previously allowed the same root to reopen. Its rejected close now remains a barrier and is reported by shutdown; cap-triggered close failures have an observed rejection handler.
- Background close returned before admitted runs or storage loading settled and did not save terminal task state. Close now shares one drain, waits admitted runs and loading, and serially flushes final state. Concurrent loads share one promise; stopped schedulers do not pin workspaces. Flush callers join a chain before waiting, preventing overlapping writes after a shared predecessor.
- The platform audit store was never closed and was opened again on primary reload. One root-owned audit store/sink now survives reload and is flushed/closed after workspace shutdown. The ownership maps live on globalThis so separate Next instrumentation/route bundles share them. Temporary-directory cleanup no longer tolerates EBUSY.
- The synchronous primary factory dropped its domain probe. Domain discovery now awaits full probe closure during asynchronous startup/reload before constructing the real primary. Concurrent reloads share one operation and shutdown prevents replacement.
- Membership selection now uses oldest active membership, then workspace id, independently of repository order.
- A caller-supplied NaN or infinite deferred-audit limit defeated the bounded buffer. Limits now must be positive safe integers; seven invalid values have regressions.
- Platform composition waits for an in-flight primary reload, avoiding new operations on the old storage root during domain-probe disposal. Cold audit resolution opens only the root-owned audit, never identity services or shared listeners during shutdown; ordinary platform composition refuses shutdown.
- Reload refuses a changed host root before closing the primary, so existing and recreated tenants cannot diverge across roots. Changing roots requires a runtime restart.
- Startup shares its asynchronous preparation promise with shutdown, so shutdown arriving during domain-probe cleanup cannot miss a primary that has not been created yet.

## Changed files in the t813 Core tree

- `apps/web/src/lib/fluxiq.ts`
- `apps/web/src/lib/tests/fluxiq.test.ts`
- `apps/web/src/lib/workspaces/deferred-audit-sink.ts`
- `apps/web/src/lib/workspaces/session-workspace.ts`
- `apps/web/src/lib/workspaces/workspace-manager.ts`
- `apps/web/src/lib/workspaces/tests/deferred-audit-sink.test.ts`
- `apps/web/src/lib/workspaces/tests/web-workspaces.test.ts`
- `apps/web/src/lib/workspaces/tests/workspace-manager.test.ts`
- `apps/web/src/server/provisioning-listener/platform-services.ts`
- `packages/fluxiq/src/programs/background-tasks/runtime/service.ts`
- `packages/fluxiq/src/programs/background-tasks/tests/index.test.ts`
- `docs/architecture/platform.md`
- `docs/operations/data-and-state.md`

## Validation

- `pnpm.cmd --filter fluxiq test src/programs/background-tasks/tests/index.test.ts` -> parallel: 1 file / 8 tests passed; real-sql: no matching files; all groups passed.
- `pnpm.cmd --filter fluxiq exec vitest run src/programs/background-tasks/tests/index.test.ts` -> final source: 1 file / 9 tests passed.
- `pnpm.cmd --filter fluxiq test src/framework src/platform src/programs/_shared src/programs/background-tasks src/programs/secret-keys` -> parallel: 79 files / 646 tests passed; real-sql: 16 files / 86 tests passed; all groups passed. Parity mismatches 0, escalations 0, forbidden targets `reached: []`. Its parallel group loaded the earlier 8-test background file, which is covered again above on final source.
- `pnpm.cmd structure:check` -> final frozen source: passed (469 warnings, 1152 baselined).
- `pnpm.cmd docs:check` -> docs-links passed (0 warnings), deterministic framework reference current.
- `pnpm.cmd --filter @fluxiq/contracts --filter fluxiq build` -> passed; contracts stamp reused, fluxiq rebuilt (112668 ms).
- `pnpm.cmd --filter fluxiq check` -> passed; actual `tsc --noEmit` check executed (76420 ms).
- `pnpm.cmd --filter @fluxiq/web check` -> passed; actual `tsc --noEmit` check executed (38069 ms).
- `pnpm.cmd --filter @fluxiq/web exec vitest run src/lib/workspaces src/lib/tests/fluxiq.test.ts src/server/provisioning-listener --maxWorkers=2 --minWorkers=1` -> initial run: 14 files: 12 passed / 2 failed; 98 tests passed / 24 failed; one unhandled error. All 19 manager regressions, 11 deferred-audit cases, real tenant eviction/key proof, activity and provisioning tests passed. The first owning causes were cleanup rethrowing an already-observed initialization rejection, a pre-existing constructor fake missing paths now required by audit/root checks, an inferred-domain test now entering gateway startup without disabling it, and session-setup timeouts followed by cascading teardown errors. No timers were raised. The session helper no longer hashes an unused password, and separate-module audit ownership is exercised by re-evaluating only its owning module instead of resetting the entire Core import graph. These failures were fixed in owning files and reverified below.
- `pnpm.cmd --filter @fluxiq/web exec vitest run src/lib/tests/fluxiq.test.ts --maxWorkers=1 --minWorkers=1` -> 1 file / 30 tests passed after the owning fixes; no unhandled errors.
- `pnpm.cmd --filter @fluxiq/web exec vitest run src/lib/workspaces/tests/web-workspaces.test.ts --maxWorkers=1 --minWorkers=1` -> 1 file / 16 tests passed; unchanged 5-second test limits. Session cases finished in 3.78 / 2.45 / 2.22 seconds; the focused audit-owner re-evaluation/reload case took 0.33 seconds.
- `pnpm.cmd --filter @fluxiq/web exec vitest run src/lib/workspaces src/lib/tests/fluxiq.test.ts src/server/provisioning-listener --maxWorkers=1 --minWorkers=1` -> final combined run: 14 files / 123 tests passed, no unhandled errors (158.57 seconds). It includes the real key-custody eviction proof with fetch stubbed; provider calls and billed cost are zero.
- `pnpm.cmd structure:check` and `pnpm.cmd docs:check` -> final post-fix source passed: 469 warnings / 1152 baselined; docs-links 0 warnings; deterministic framework reference current.
- `pnpm.cmd --filter @fluxiq/web check` -> refreshed after the cleanup-await/fixture corrections: passed; actual `tsc --noEmit` check executed against final frozen source (36873 ms).
- `git diff --check` -> exit 0; only the repository's expected LF-to-CRLF conversion warnings.
- `pnpm.cmd --filter @fluxiq/web exec vitest run src/lib/workspaces/tests/workspace-manager.test.ts` -> startup refused the stale t813 Core library build; no assertions ran. Awaiting the coordinated heavy-check lock to rebuild Core and run typechecks.

## Not verified yet

No checks remain from this brief. Browser behavior, a Next production build, live provider calls, real tenant gateway sockets, POSIX, and full suites were not run, as scoped. No C2/C3 migration was attempted. Both heavy-lock acquisitions were released with exact owner verification; `claude_core` was notified after the final web check. Nothing was committed or pushed; all changes await lead review, integration and verification on merged dev.
